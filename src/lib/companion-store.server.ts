import { AwsClient } from "aws4fetch";
import { z } from "zod";
import { companionAwsConfiguration, type AwsEnvironment } from "./aws-config.server";
const subjectSchema = z.string().uuid();
const summarySchema = z.object({ summary: z.string().max(1800), updatedAt: z.string().datetime() });
export type ContinuitySummary = z.infer<typeof summarySchema>;
export class CompanionServiceError extends Error {
  constructor(readonly code: string) {
    super("Companion services are unavailable. Please try again shortly.");
    this.name = "CompanionServiceError";
  }
}
export function createCompanionStore(environment: AwsEnvironment) {
  const config = companionAwsConfiguration(environment);
  const ddb = new AwsClient({ ...config.credentials, service: "dynamodb", retries: 0 });
  const guardrail = new AwsClient({ ...config.credentials, service: "bedrock", retries: 0 });
  async function json(
    client: AwsClient,
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) {
    const response = await client.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const code =
        String(data.__type ?? data.code ?? "AWS_REQUEST_FAILED")
          .split("#")
          .at(-1) ?? "AWS_REQUEST_FAILED";
      throw new CompanionServiceError(code);
    }
    return data;
  }
  const query = (operation: string, body: unknown) =>
    json(ddb, `https://dynamodb.${config.credentials.region}.amazonaws.com`, body, {
      "Content-Type": "application/x-amz-json-1.0",
      "X-Amz-Target": `DynamoDB_20120810.${operation}`,
    });
  const key = (subjectId: string) => ({ subjectId: { S: subjectSchema.parse(subjectId) } });
  return {
    async loadSummary(subjectId: string): Promise<ContinuitySummary | null> {
      const data = await query("GetItem", {
        TableName: config.summaryTable,
        Key: key(subjectId),
        ConsistentRead: true,
      });
      if (!data.Item) return null;
      const item = data.Item as Record<string, { S?: string }>;
      return summarySchema.parse({ summary: item.summary?.S, updatedAt: item.updatedAt?.S });
    },
    async saveSummary(subjectId: string, summary: string, previous: ContinuitySummary | null) {
      const updatedAt = new Date().toISOString();
      await query("PutItem", {
        TableName: config.summaryTable,
        Item: {
          ...key(subjectId),
          summary: { S: z.string().min(1).max(1800).parse(summary) },
          updatedAt: { S: updatedAt },
          schemaVersion: { N: "1" },
        },
        ConditionExpression: previous ? "updatedAt = :previous" : "attribute_not_exists(subjectId)",
        ...(previous
          ? { ExpressionAttributeValues: { ":previous": { S: previous.updatedAt } } }
          : {}),
      });
    },
    async clearSummary(subjectId: string) {
      // Retain an empty marker so an in-flight first summary cannot resurrect cleared text.
      await query("PutItem", {
        TableName: config.summaryTable,
        Item: {
          ...key(subjectId),
          summary: { S: "" },
          updatedAt: { S: new Date().toISOString() },
          schemaVersion: { N: "1" },
        },
      });
    },
    async check(
      subjectId: string,
      text: string,
      source: "INPUT" | "OUTPUT",
      purpose: "message" | "summary" = "message",
    ) {
      subjectSchema.parse(subjectId);
      const data = await json(
        guardrail,
        `https://bedrock-runtime.${config.credentials.region}.amazonaws.com/guardrail/${encodeURIComponent(config.guardrailIdentifier)}/version/${encodeURIComponent(config.guardrailVersion)}/apply`,
        {
          source,
          content: [{ text: { text: z.string().min(1).max(100_000).parse(text) } }],
          outputScope: "INTERVENTIONS",
        },
      );
      const action = z.enum(["NONE", "GUARDRAIL_INTERVENED"]).parse(data.action);
      const createdAt = new Date().toISOString();
      const policyTypes = Array.isArray(data.assessments)
        ? [
            ...new Set(
              data.assessments.flatMap((value) =>
                Object.keys(value as object).filter((k) => k.endsWith("Policy")),
              ),
            ),
          ]
        : [];
      await query("PutItem", {
        TableName: config.safetyTable,
        Item: {
          ...key(subjectId),
          eventId: { S: `${createdAt}#${crypto.randomUUID()}` },
          createdAt: { S: createdAt },
          source: { S: source },
          purpose: { S: purpose },
          action: { S: action },
          policyTypes: { L: policyTypes.map((value) => ({ S: value })) },
          schemaVersion: { N: "1" },
        },
        ConditionExpression: "attribute_not_exists(subjectId) AND attribute_not_exists(eventId)",
      });
      return action === "GUARDRAIL_INTERVENED";
    },
  };
}
