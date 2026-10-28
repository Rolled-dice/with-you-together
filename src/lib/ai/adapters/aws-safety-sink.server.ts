import { z } from "zod";
import type { SafetyAuditEvent, SafetyLogSink } from "../types";
import { SafetyAuditEventSchema } from "../types";
import { signAwsRequest, getAwsCredentials } from "../aws-sigv4.server";

export class AwsSafetyLogSink implements SafetyLogSink {
  public readonly id = "aws";

  private getTableName(): string {
    return process.env.AWS_SAFETY_TABLE_NAME || "someonenear-ai-safety-audits";
  }

  private getRegion(): string {
    return process.env.AWS_REGION || "us-east-1";
  }

  private async callDynamoDb(action: string, payload: Record<string, unknown>): Promise<unknown> {
    const credentials = getAwsCredentials();
    const region = this.getRegion();

    if (!credentials) {
      throw new Error("AWS safety storage credentials are not configured");
    }

    const url = `https://dynamodb.${region}.amazonaws.com/`;
    const body = JSON.stringify(payload);

    const signedHeaders = await signAwsRequest({
      method: "POST",
      url,
      region,
      service: "dynamodb",
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        "X-Amz-Target": `DynamoDB_20120810.${action}`,
      },
      body,
      credentials,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: signedHeaders,
      body,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[aws-safety-sink] DynamoDB ${action} failed (${response.status}):`, err);
      throw new Error("[aws-safety-sink] Failed to record safety audit event.");
    }

    return response.json();
  }

  public async write(event: SafetyAuditEvent): Promise<void> {
    // 1. Strict schema validation (rejects unauthorized fields and verifies schemaVersion: 1)
    const validated = SafetyAuditEventSchema.parse(event);

    const item: Record<string, { S?: string; N?: string }> = {
      subjectId: { S: validated.subjectId },
      eventId: { S: validated.eventId },
      schemaVersion: { N: String(validated.schemaVersion) },
      occurredAt: { S: validated.occurredAt },
      direction: { S: validated.direction },
      category: { S: validated.category },
      action: { S: validated.action },
    };

    if (validated.inputCharacters !== undefined)
      item.inputCharacters = { N: String(validated.inputCharacters) };
    if (validated.outputCharacters !== undefined)
      item.outputCharacters = { N: String(validated.outputCharacters) };
    if (validated.estimatedTextUnits !== undefined)
      item.estimatedTextUnits = { N: String(validated.estimatedTextUnits) };
    if (validated.estimatedCostUsd !== undefined)
      item.estimatedCostUsd = { N: String(validated.estimatedCostUsd) };
    if (validated.providerLatencyMs !== undefined)
      item.providerLatencyMs = { N: String(validated.providerLatencyMs) };
    if (validated.sanitizedErrorCode !== undefined)
      item.sanitizedErrorCode = { S: validated.sanitizedErrorCode };

    try {
      await this.callDynamoDb("PutItem", {
        TableName: this.getTableName(),
        Item: item,
      });
    } catch (err) {
      // Non-blocking log to ensure user conversation flow is not disrupted by audit sink issues
      console.error("[aws-safety-sink] Error writing safety audit event:", err);
    }
  }

  public async deleteUserEvents(subjectId: string): Promise<void> {
    if (!subjectId) return;

    let cursor: Record<string, { S: string }> | undefined;
    do {
      const result = await this.callDynamoDb("Query", {
        TableName: this.getTableName(),
        KeyConditionExpression: "subjectId = :s",
        ExpressionAttributeValues: { ":s": { S: subjectId } },
        ProjectionExpression: "subjectId, eventId",
        ...(cursor ? { ExclusiveStartKey: cursor } : {}),
      });
      const page = z
        .object({
          Items: z.array(z.object({ eventId: z.object({ S: z.string() }) })).default([]),
          LastEvaluatedKey: z.record(z.string(), z.object({ S: z.string() })).optional(),
        })
        .parse(result);
      for (const item of page.Items) {
        await this.callDynamoDb("DeleteItem", {
          TableName: this.getTableName(),
          Key: { subjectId: { S: subjectId }, eventId: { S: item.eventId.S } },
        });
      }
      cursor = page.LastEvaluatedKey;
    } while (cursor && Object.keys(cursor).length > 0);
  }
}
