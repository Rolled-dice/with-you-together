variable "aws_region" {
  description = "AWS Region for Bedrock and DynamoDB storage"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (production, staging, dev)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name prefix for AWS resources"
  type        = string
  default     = "someonenear"
}

variable "summary_table_name" {
  description = "DynamoDB table name for encrypted user summaries"
  type        = string
  default     = "someonenear-ai-user-summaries"
}

variable "safety_table_name" {
  description = "DynamoDB table name for safety audit events"
  type        = string
  default     = "someonenear-ai-safety-audits"
}
