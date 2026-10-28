# ==============================================================================
# SomeoneNear AWS Bedrock & DynamoDB One-Click Provisioning Script
# Uses the installed AWS CLI (aws-cli v2) to configure all resources.
# ==============================================================================

$ErrorActionPreference = "Stop"
$Region = "us-east-1"
$Project = "someonenear"

Write-Host "Checking AWS CLI authentication..." -ForegroundColor Cyan
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "Authenticated as AWS Account: $($identity.Account) ($($identity.Arn))`n" -ForegroundColor Green
} catch {
    Write-Host "AWS CLI is not authenticated. Please run 'aws configure' first." -ForegroundColor Red
    exit 1
}

# 1. Create DynamoDB Tables
Write-Host "1. Creating DynamoDB table 'someonenear-ai-user-summaries'..." -ForegroundColor Cyan
try {
    aws dynamodb describe-table --table-name someonenear-ai-user-summaries --region $Region 2>$null | Out-Null
    Write-Host "   Table 'someonenear-ai-user-summaries' already exists." -ForegroundColor Yellow
} catch {
    aws dynamodb create-table `
        --table-name someonenear-ai-user-summaries `
        --attribute-definitions AttributeName=subjectId,AttributeType=S `
        --key-schema AttributeName=subjectId,KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --region $Region | Out-Null
    Write-Host "   Table created successfully." -ForegroundColor Green
}

Write-Host "2. Creating DynamoDB table 'someonenear-ai-safety-audits'..." -ForegroundColor Cyan
try {
    aws dynamodb describe-table --table-name someonenear-ai-safety-audits --region $Region 2>$null | Out-Null
    Write-Host "   Table 'someonenear-ai-safety-audits' already exists." -ForegroundColor Yellow
} catch {
    aws dynamodb create-table `
        --table-name someonenear-ai-safety-audits `
        --attribute-definitions AttributeName=subjectId,AttributeType=S AttributeName=eventId,AttributeType=S `
        --key-schema AttributeName=subjectId,KeyType=HASH AttributeName=eventId,KeyType=RANGE `
        --billing-mode PAY_PER_REQUEST `
        --region $Region | Out-Null
    Write-Host "   Table created successfully." -ForegroundColor Green
}

# 2. Create Bedrock Guardrail
Write-Host "`n3. Creating Bedrock Guardrail 'someonenear-safety-guardrail'..." -ForegroundColor Cyan

$GuardrailConfig = @{
    name = "someonenear-safety-guardrail"
    description = "SomeoneNear AI Companion Safety Guardrail"
    blockedInputMessaging = "I hear how much pain you are carrying. Please reach out to 988 or findahelpline.com for immediate support."
    blockedOutputsMessaging = "I am here as an emotional support companion, but I cannot give medical advice or diagnosis."
    contentPolicyConfig = @{
        filtersConfig = @(
            @{ type = "HATE"; inputStrength = "HIGH"; outputStrength = "HIGH" },
            @{ type = "INSULTS"; inputStrength = "HIGH"; outputStrength = "HIGH" },
            @{ type = "SEXUAL"; inputStrength = "HIGH"; outputStrength = "HIGH" },
            @{ type = "VIOLENCE"; inputStrength = "HIGH"; outputStrength = "HIGH" }
        )
    }
    topicPolicyConfig = @{
        topicsConfig = @(
            @{
                name = "MedicalDiagnosisAndPrescriptions"
                definition = "Requests asking for medical diagnoses, medication dosages, prescription recommendations, or interpreting clinical lab tests."
                examples = @("What dosage of sertraline should I take?", "Diagnose my symptoms", "Prescribe me medication")
                type = "DENY"
            },
            @{
                name = "SelfHarmAndCrisis"
                definition = "Expressions of active suicide plans, intent to harm oneself, cutting, overdosing, or urgent medical emergencies."
                examples = @("I want to kill myself", "How to overdose on my pills", "I plan to end my life")
                type = "DENY"
            }
        )
    }
    sensitiveInformationPolicyConfig = @{
        piiEntitiesConfig = @(
            @{ type = "EMAIL"; action = "ANONYMIZE" },
            @{ type = "PHONE"; action = "ANONYMIZE" },
            @{ type = "US_SOCIAL_SECURITY_NUMBER"; action = "BLOCK" },
            @{ type = "CREDIT_DEBIT_CARD_NUMBER"; action = "BLOCK" }
        )
    }
} | ConvertTo-Json -Depth 10

$TempFile = [System.IO.Path]::GetTempFileName()
$GuardrailConfig | Out-File -FilePath $TempFile -Encoding utf8

$GuardrailId = ""
try {
    $createResult = aws bedrock create-guardrail --cli-input-json file://$TempFile --region $Region | ConvertFrom-Json
    $GuardrailId = $createResult.guardrailId
    Write-Host "   Guardrail created with ID: $GuardrailId" -ForegroundColor Green
} catch {
    # If already exists, retrieve it
    $list = aws bedrock list-guardrails --region $Region | ConvertFrom-Json
    $existing = $list.guardrailSummaries | Where-Object { $_.name -eq "someonenear-safety-guardrail" }
    if ($existing) {
        $GuardrailId = $existing.id
        Write-Host "   Guardrail already exists with ID: $GuardrailId" -ForegroundColor Yellow
    } else {
        Write-Host "   Error creating guardrail: $_" -ForegroundColor Red
    }
} finally {
    Remove-Item -Force $TempFile -ErrorAction SilentlyContinue
}

# Publish Guardrail Version
$GuardrailVersion = "1"
if ($GuardrailId) {
    try {
        $versionResult = aws bedrock create-guardrail-version --guardrail-identifier $GuardrailId --description "Production Version 1" --region $Region | ConvertFrom-Json
        $GuardrailVersion = $versionResult.version
        Write-Host "   Published Guardrail Version: $GuardrailVersion" -ForegroundColor Green
    } catch {
        Write-Host "   Using version: $GuardrailVersion" -ForegroundColor Yellow
    }
}

# 3. Create IAM User and Policy
Write-Host "`n4. Configuring IAM User & Least-Privilege Policy..." -ForegroundColor Cyan
$UserName = "someonenear-ai-worker"
try {
    aws iam get-user --user-name $UserName 2>$null | Out-Null
    Write-Host "   User '$UserName' already exists." -ForegroundColor Yellow
} catch {
    aws iam create-user --user-name $UserName | Out-Null
    Write-Host "   User '$UserName' created." -ForegroundColor Green
}

$PolicyDocument = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Sid = "BedrockApplyGuardrailOnly"
            Effect = "Allow"
            Action = @("bedrock:ApplyGuardrail")
            Resource = "arn:aws:bedrock:*:$($identity.Account):guardrail/*"
        },
        @{
            Sid = "DynamoDbUserSummariesAndAudits"
            Effect = "Allow"
            Action = @("dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query")
            Resource = @(
                "arn:aws:dynamodb:$Region:$($identity.Account):table/someonenear-ai-user-summaries",
                "arn:aws:dynamodb:$Region:$($identity.Account):table/someonenear-ai-safety-audits"
            )
        }
    )
} | ConvertTo-Json -Depth 5

$PolicyName = "someonenear-ai-worker-policy"
$PolicyArn = "arn:aws:iam::$($identity.Account):policy/$PolicyName"

try {
    aws iam get-policy --policy-arn $PolicyArn 2>$null | Out-Null
    Write-Host "   Policy '$PolicyName' already exists." -ForegroundColor Yellow
} catch {
    $TempPolicy = [System.IO.Path]::GetTempFileName()
    $PolicyDocument | Out-File -FilePath $TempPolicy -Encoding utf8
    aws iam create-policy --policy-name $PolicyName --policy-document file://$TempPolicy | Out-Null
    Remove-Item -Force $TempPolicy
    Write-Host "   Policy created." -ForegroundColor Green
}

aws iam attach-user-policy --user-name $UserName --policy-arn $PolicyArn 2>$null

# Create Access Key
Write-Host "`n5. Creating Access Key..." -ForegroundColor Cyan
$AccessKey = aws iam create-access-key --user-name $UserName | ConvertFrom-Json

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "   AWS PROVISIONING COMPLETE! READY FOR WRANGLER" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "`nCopy and run these commands to wire credentials into Cloudflare:`n" -ForegroundColor Yellow

Write-Host "npx wrangler secret put AWS_ACCESS_KEY_ID" -ForegroundColor White
Write-Host "(Enter: $($AccessKey.AccessKey.AccessKeyId))`n" -ForegroundColor Gray

Write-Host "npx wrangler secret put AWS_SECRET_ACCESS_KEY" -ForegroundColor White
Write-Host "(Enter: $($AccessKey.AccessKey.SecretAccessKey))`n" -ForegroundColor Gray

Write-Host "npx wrangler secret put AWS_BEDROCK_GUARDRAIL_ID" -ForegroundColor White
Write-Host "(Enter: $GuardrailId)`n" -ForegroundColor Gray

Write-Host "Variables to confirm in wrangler.json vars:" -ForegroundColor Yellow
Write-Host "`"AWS_REGION`": `"$Region`","
Write-Host "`"AWS_BEDROCK_GUARDRAIL_VERSION`": `"$GuardrailVersion`","
Write-Host "`"AWS_SUMMARY_TABLE_NAME`": `"someonenear-ai-user-summaries`","
Write-Host "`"AWS_SAFETY_TABLE_NAME`": `"someonenear-ai-safety-audits`"`n"
