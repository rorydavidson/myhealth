import SwiftData

// MARK: - Versioned Schema

/// Schema v1.0.0 — initial Phase 2 release.
/// All seven model types registered here.
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

// MARK: - Migration Plan

/// Add new `VersionedSchema` cases here as new schema versions are introduced.
/// Each stage transforms from the previous version to the next.
enum HealthDashboardMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [SchemaV1.self]
    }

    static var stages: [MigrationStage] {
        // No migrations needed from v1 → v1 (initial release)
        []
    }
}
