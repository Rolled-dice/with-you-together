import type { UserSummary, UserSummaryStore, ExportedUserSummary } from './types';
import { ExportedUserSummarySchema, UserSummarySchema } from './types';

export interface MigrationReport {
  success: boolean;
  subjectId: string;
  sourceProvider: string;
  targetProvider: string;
  sourceVersion: number;
  targetVersion: number;
  migratedAt: string;
  error?: string;
}

export class AiPortabilityManager {
  /**
   * Exports a user summary to a clean, provider-neutral, versioned JSON object.
   * Guaranteed to contain zero AWS, Bedrock, Gemini, table name, or internal credentials.
   */
  public static exportSummary(summary: UserSummary): ExportedUserSummary {
    const exported: ExportedUserSummary = {
      schemaVersion: 1,
      subjectId: summary.subjectId,
      summaryVersion: summary.summaryVersion,
      summaryText: summary.summaryText,
      sourceConversationCount: summary.sourceConversationCount,
      generatedAt: summary.generatedAt,
      updatedAt: summary.updatedAt,
      exportedAt: new Date().toISOString(),
    };

    return ExportedUserSummarySchema.parse(exported);
  }

  /**
   * Imports an exported summary into a target store after validation.
   */
  public static async importSummary(
    targetStore: UserSummaryStore,
    exported: ExportedUserSummary
  ): Promise<UserSummary> {
    const validatedExport = ExportedUserSummarySchema.parse(exported);

    const record: UserSummary = {
      schemaVersion: 1,
      subjectId: validatedExport.subjectId,
      summaryVersion: validatedExport.summaryVersion,
      summaryText: validatedExport.summaryText,
      sourceConversationCount: validatedExport.sourceConversationCount,
      generatedAt: validatedExport.generatedAt,
      updatedAt: validatedExport.updatedAt,
    };

    const validated = UserSummarySchema.parse(record);
    await targetStore.saveSummary(validated);
    return validated;
  }

  /**
   * Migrates a user summary from a source store to a target store.
   * Follows strict verification sequence:
   * 1. Read source
   * 2. Validate schema
   * 3. Write to target store
   * 4. Verify target record matches
   * 5. Delete from source ONLY AFTER successful verification
   * 6. Return sanitized migration report
   */
  public static async migrateUserSummary({
    subjectId,
    sourceStore,
    targetStore,
    adminAuthorized,
  }: {
    subjectId: string;
    sourceStore: UserSummaryStore;
    targetStore: UserSummaryStore;
    adminAuthorized: boolean;
  }): Promise<MigrationReport> {
    if (!adminAuthorized) {
      throw new Error('[ai-portability] Migration requires explicit administrator authorization.');
    }

    const report: MigrationReport = {
      success: false,
      subjectId,
      sourceProvider: sourceStore.id,
      targetProvider: targetStore.id,
      sourceVersion: 0,
      targetVersion: 0,
      migratedAt: new Date().toISOString(),
    };

    try {
      // 1. Read current source record
      const sourceRecord = await sourceStore.getSummary(subjectId);
      if (!sourceRecord) {
        report.error = 'Source record not found.';
        return report;
      }

      // 2. Validate source schema
      const validatedSource = UserSummarySchema.parse(sourceRecord);
      report.sourceVersion = validatedSource.summaryVersion;

      // 3. Write to target store
      await targetStore.saveSummary(validatedSource);

      // 4. Verify target record
      const targetRecord = await targetStore.getSummary(subjectId);
      if (
        !targetRecord ||
        targetRecord.summaryText !== validatedSource.summaryText ||
        targetRecord.summaryVersion !== validatedSource.summaryVersion
      ) {
        throw new Error('Target verification failed: target record does not match source.');
      }

      report.targetVersion = targetRecord.summaryVersion;

      // 5. Delete source record only AFTER verification passes
      await sourceStore.deleteUserSummary(subjectId);

      report.success = true;
      return report;
    } catch (err: any) {
      report.error = err?.message || 'Migration failed.';
      report.success = false;
      return report;
    }
  }
}
