import type { UserSummary, UserSummaryStore } from '../types';
import { UserSummarySchema } from '../types';
import { signAwsRequest, getAwsCredentials } from '../aws-sigv4.server';

export class AwsUserSummaryStore implements UserSummaryStore {
  public readonly id = 'aws';

  private getTableName(): string {
    return process.env.AWS_SUMMARY_TABLE_NAME || 'someonenear-ai-user-summaries';
  }

  private getRegion(): string {
    return process.env.AWS_REGION || 'us-east-1';
  }

  private async callDynamoDb(action: string, payload: Record<string, any>): Promise<any> {
    const credentials = getAwsCredentials();
    const region = this.getRegion();

    if (!credentials) {
      throw new Error('[aws-summary-store] AWS credentials are not configured.');
    }

    const url = `https://dynamodb.${region}.amazonaws.com/`;
    const body = JSON.stringify(payload);

    const signedHeaders = await signAwsRequest({
      method: 'POST',
      url,
      region,
      service: 'dynamodb',
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': `DynamoDB_20120810.${action}`,
      },
      body,
      credentials,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: signedHeaders,
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[aws-summary-store] DynamoDB ${action} failed (${response.status}):`, errText);
      throw new Error(`[aws-summary-store] Storage operation failed.`);
    }

    return response.json();
  }

  public async getSummary(subjectId: string): Promise<UserSummary | null> {
    if (!subjectId) return null;

    try {
      const data = await this.callDynamoDb('GetItem', {
        TableName: this.getTableName(),
        Key: {
          subjectId: { S: subjectId },
        },
        ConsistentRead: true,
      });

      if (!data?.Item) return null;

      const raw = {
        schemaVersion: Number(data.Item.schemaVersion?.N || 1),
        subjectId: data.Item.subjectId?.S,
        summaryVersion: Number(data.Item.summaryVersion?.N || 0),
        summaryText: data.Item.summaryText?.S || '',
        sourceConversationCount: Number(data.Item.sourceConversationCount?.N || 0),
        generatedAt: data.Item.generatedAt?.S,
        updatedAt: data.Item.updatedAt?.S,
        expiresAt: data.Item.expiresAt?.N ? Number(data.Item.expiresAt.N) : undefined,
      };

      // Strict validation against schema
      return UserSummarySchema.parse(raw);
    } catch (err: any) {
      console.error('[aws-summary-store] getSummary error:', err?.message || err);
      // Fallback: If AWS storage is unavailable, fail soft for conversation continuity
      return null;
    }
  }

  public async saveSummary(summary: UserSummary): Promise<void> {
    // 1. Strict schema validation before write (rejects unexpected or provider-specific fields)
    const validated = UserSummarySchema.parse(summary);

    const item: Record<string, { S?: string; N?: string }> = {
      subjectId: { S: validated.subjectId },
      schemaVersion: { N: String(validated.schemaVersion) },
      summaryVersion: { N: String(validated.summaryVersion) },
      summaryText: { S: validated.summaryText },
      sourceConversationCount: { N: String(validated.sourceConversationCount) },
      generatedAt: { S: validated.generatedAt },
      updatedAt: { S: validated.updatedAt },
    };

    if (validated.expiresAt !== undefined) {
      item.expiresAt = { N: String(validated.expiresAt) };
    }

    await this.callDynamoDb('PutItem', {
      TableName: this.getTableName(),
      Item: item,
    });
  }

  public async deleteUserSummary(subjectId: string): Promise<void> {
    if (!subjectId) return;

    try {
      // Idempotent delete: succeeds even if the record was already deleted
      await this.callDynamoDb('DeleteItem', {
        TableName: this.getTableName(),
        Key: {
          subjectId: { S: subjectId },
        },
      });
    } catch (err: any) {
      console.error('[aws-summary-store] deleteUserSummary error:', err?.message || err);
      throw new Error('[aws-summary-store] Failed to delete summary.');
    }
  }
}
