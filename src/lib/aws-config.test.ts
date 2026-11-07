import { describe, expect, it } from "vitest";
import { awsCredentials, companionAwsConfiguration } from "./aws-config.server";
const lower = {
  aws_region: "us-east-1",
  aws_access_key_id: "test-access",
  aws_secret_access_key: "test-secret",
  bedrock_guardrail_id: "guard",
  bedrock_guardrail_version: "1",
  dynamodb_summary_table: "memory",
  dynamodb_safety_table: "safety",
};
describe("AWS hybrid configuration", () => {
  it("uses lowercase credentials and requires no Bedrock inference model", () => {
    expect(companionAwsConfiguration(lower)).toMatchObject({
      summaryTable: "memory",
      safetyTable: "safety",
      guardrailIdentifier: "guard",
    });
  });
  it("honors uppercase configuration and temporary session tokens", () => {
    expect(
      awsCredentials({ ...lower, AWS_REGION: "eu-west-1", AWS_SESSION_TOKEN: "temporary" }),
    ).toMatchObject({ region: "eu-west-1", sessionToken: "temporary" });
  });
  it("rejects incomplete safety configuration", () => {
    expect(() => companionAwsConfiguration({ ...lower, bedrock_guardrail_version: "" })).toThrow(
      /incomplete/,
    );
    expect(() => companionAwsConfiguration({ ...lower, bedrock_guardrail_version: "0" })).toThrow(
      /invalid/,
    );
  });
  it("rejects an invalid region", () =>
    expect(() => awsCredentials({ ...lower, aws_region: "https://other-host" })).toThrow(
      /region is invalid/,
    ));
});
