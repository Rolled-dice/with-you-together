terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ==============================================================================
# 1. Amazon Bedrock Guardrail
# ==============================================================================

resource "aws_bedrock_guardrail" "companion_guardrail" {
  name                      = "${var.project_name}-safety-guardrail"
  description               = "Safety guardrail for SomeoneNear Companion AI (Self-Harm, Crisis, and Medical Boundaries)"
  blocked_input_messaging   = "I hear how much pain you are carrying. Please reach out to 988 or findahelpline.com for immediate support."
  blocked_outputs_messaging = "I am here as an emotional support companion, but I cannot give medical advice or diagnosis. How are you feeling emotionally?"

  # Content Filters (Violence, Hate, Sexual, Insults)
  content_policy_config {
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "HATE"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "INSULTS"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "SEXUAL"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "VIOLENCE"
    }
  }

  # Denied Topics: Medical Diagnosis, Prescriptions, and Suicide/Self-Harm
  topic_policy_config {
    topics_config {
      name       = "MedicalDiagnosisAndPrescriptions"
      definition = "Requests asking for medical diagnoses, medication dosages, prescription recommendations, or interpreting clinical lab tests."
      examples = [
        "What dosage of sertraline should I take?",
        "Diagnose my chest pain symptoms",
        "Can you prescribe me sleeping pills?",
        "Do I have clinical depression?"
      ]
      type = "DENY"
    }
    topics_config {
      name       = "SelfHarmAndActiveCrisis"
      definition = "Expressions of active suicide plans, intent to harm oneself, cutting, overdosing, or urgent medical emergencies."
      examples = [
        "I want to kill myself tonight",
        "How can I overdose on my pills?",
        "I have a plan to end my life",
        "I don't want to live anymore"
      ]
      type = "DENY"
    }
  }

  # Sensitive Information Policy (PII protection)
  sensitive_information_policy_config {
    pii_entities_config {
      action = "ANONYMIZE"
      type   = "EMAIL"
    }
    pii_entities_config {
      action = "ANONYMIZE"
      type   = "PHONE"
    }
    pii_entities_config {
      action = "BLOCK"
      type   = "US_SOCIAL_SECURITY_NUMBER"
    }
    pii_entities_config {
      action = "BLOCK"
      type   = "CREDIT_DEBIT_CARD_NUMBER"
    }
  }
}

# Publish Guardrail Version
resource "aws_bedrock_guardrail_version" "companion_guardrail_v1" {
  guardrail_arn = aws_bedrock_guardrail.companion_guardrail.guardrail_arn
  description   = "Version 1.0 Production Guardrail"
}

# ==============================================================================
# 2. DynamoDB Tables (On-Demand, Encrypted, Pay-Per-Request)
# ==============================================================================

# User Continuity Summaries Table
resource "aws_dynamodb_table" "user_summaries" {
  name         = var.summary_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "subjectId"

  attribute {
    name = "subjectId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# Safety Audit Logs Table
resource "aws_dynamodb_table" "safety_audits" {
  name         = var.safety_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "subjectId"
  range_key    = "eventId"

  attribute {
    name = "subjectId"
    type = "S"
  }

  attribute {
    name = "eventId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}

# ==============================================================================
# 3. Least-Privilege IAM User & Access Keys
# ==============================================================================

resource "aws_iam_user" "ai_worker" {
  name = "${var.project_name}-ai-worker"
}

resource "aws_iam_policy" "ai_worker_policy" {
  name        = "${var.project_name}-ai-worker-least-privilege"
  description = "Allows Cloudflare Worker to execute Bedrock Guardrails and access AI DynamoDB tables"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BedrockApplyGuardrailOnly"
        Effect = "Allow"
        Action = [
          "bedrock:ApplyGuardrail"
        ]
        Resource = [
          aws_bedrock_guardrail.companion_guardrail.guardrail_arn,
          "${aws_bedrock_guardrail.companion_guardrail.guardrail_arn}/*"
        ]
      },
      {
        Sid    = "DynamoDbUserSummariesAndAudits"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.user_summaries.arn,
          aws_dynamodb_table.safety_audits.arn
        ]
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "ai_worker_attach" {
  user       = aws_iam_user.ai_worker.name
  policy_arn = aws_iam_policy.ai_worker_policy.arn
}

resource "aws_iam_access_key" "ai_worker_key" {
  user = aws_iam_user.ai_worker.name
}
