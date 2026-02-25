import SwiftData

// MARK: - Versioned Schemas

/// Schema v1.0.0 — initial Phase 2 release.
/// Seven model types: health records, clinical data, lab results, imports.
enum SchemaV1: VersionedSchema {
    static let versionIdentifier = Schema.Version(1, 0, 0)

    static var models: [any PersistentModel.Type] {
        [
            HealthRecord.self,
            DailySummary.self,
            LabResult.self,
            ClinicalCondition.self,
            Medication.self,
            Allergy.self,
            HealthImport.self,
        ]
    }
}

/// Schema v2.0.0 — Milestone 19/20.
/// Adds `InsightMessage` for persisted LLM conversation history.
enum SchemaV2: VersionedSchema {
    static let versionIdentifier = Schema.Version(2, 0, 0)

    static var models: [any PersistentModel.Type] {
        [
            HealthRecord.self,
            DailySummary.self,
            LabResult.self,
            ClinicalCondition.self,
            Medication.self,
            Allergy.self,
            HealthImport.self,
            InsightMessage.self,
        ]
    }
}

// MARK: - Migration Plan

/// Add new `VersionedSchema` cases here as new schema versions are introduced.
/// Each stage transforms from the previous version to the next.
enum HealthDashboardMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self, SchemaV2.self]
    }

    static var stages: [MigrationStage] {
        // v1 → v2: InsightMessage is a new table — lightweight migration (additive only).
        [MigrationStage.lightweight(fromVersion: SchemaV1.self, toVersion: SchemaV2.self)]
    }
}
