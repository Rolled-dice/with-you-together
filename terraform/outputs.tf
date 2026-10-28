output "aws_region" {
  description = "Configured AWS Region"
  value       = var.aws_region
}

output "bedrock_guardrail_id" {
  description = "Amazon Bedrock Guardrail ID"
  value       = aws_bedrock_guardrail.companion_guardrail.guardrail_id
}

output "bedrock_guardrail_version" {
  description = "Published Bedrock Guardrail Version"
  value       = aws_bedrock_guardrail_version.companion_guardrail_v1.version
}

output "dynamodb_summary_table" {
  description = "DynamoDB Table for User Summaries"
  value       = aws_dynamodb_table.user_summaries.name
}

output "dynamodb_safety_table" {
  description = "DynamoDB Table for Safety Audits"
  value       = aws_dynamodb_table.safety_audits.name
}

output "aws_access_key_id" {
  description = "AWS IAM Access Key ID for Cloudflare Worker"
  value       = aws_iam_access_key.ai_worker_key.id
}

output "aws_secret_access_key" {
  description = "AWS IAM Secret Access Key for Cloudflare Worker"
  value       = aws_iam_access_key.ai_worker_key.secret
  sensitive   = true
}

output "quick_setup_instructions" {
  description = "Run these commands to wire the outputs into Cloudflare Wrangler"
  value       = <<EOT

1. Set Secrets in Cloudflare Worker:
   npx wrangler secret put AWS_ACCESS_KEY_ID
   npx wrangler secret put AWS_SECRET_ACCESS_KEY
   npx wrangler secret put AWS_BEDROCK_GUARDRAIL_ID

2. Add to wrangler.json vars:
   "AWS_REGION": "${var.aws_region}",
   "AWS_BEDROCK_GUARDRAIL_VERSION": "${aws_bedrock_guardrail_version.companion_guardrail_v1.version}",
   "AWS_SUMMARY_TABLE_NAME": "${aws_dynamodb_table.user_summaries.name}",
   "AWS_SAFETY_TABLE_NAME": "${aws_dynamodb_table.safety_audits.name}"
EOT
}
