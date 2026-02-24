import Foundation
import SwiftData

/// Tracks a single import batch — mirrors the Phase 1 `imports` IndexedDB store.
/// Created automatically on initial HealthKit load and on manual file imports.
@Model
final class HealthImport {
    @Attribute(.unique) var id: String

    /// `apple_health`, `health_connect`, or `json_backup`
    var platform: String

    /// Original file name (for user reference; nil for HealthKit live sync)
    var fileName: String?

    /// Date the original export was generated (from Apple Health <ExportDate> or equivalent)
    var exportDate: String?

    var startedAt: Date
    var completedAt: Date?
    var recordCount: Int

    /// `processing`, `completed`, or `failed`
    var status: String

    /// Earliest record timestamp in this import
    var dateRangeStart: Date?

    /// Latest record timestamp in this import
    var dateRangeEnd: Date?

    init(
        id: String = UUID().uuidString,
        platform: ImportPlatform,
        fileName: String? = nil,
        exportDate: String? = nil,
        startedAt: Date = .now,
        completedAt: Date? = nil,
        recordCount: Int = 0,
        status: ImportStatus = .processing,
        dateRangeStart: Date? = nil,
        dateRangeEnd: Date? = nil
    ) {
        self.id = id
        self.platform = platform.rawValue
        self.fileName = fileName
        self.exportDate = exportDate
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.recordCount = recordCount
        self.status = status.rawValue
        self.dateRangeStart = dateRangeStart
        self.dateRangeEnd = dateRangeEnd
    }

    var importPlatform: ImportPlatform {
        ImportPlatform(rawValue: platform) ?? .appleHealth
    }

    var importStatus: ImportStatus {
        ImportStatus(rawValue: status) ?? .processing
    }
}

enum ImportPlatform: String, Codable {
    case appleHealth = "apple_health"
    case healthConnect = "health_connect"
    case jsonBackup = "json_backup"

    var displayName: String {
        switch self {
        case .appleHealth: "Apple Health"
        case .healthConnect: "Health Connect"
        case .jsonBackup: String(localized: "import.platform.backup")
        }
    }
}

enum ImportStatus: String, Codable {
    case processing
    case completed
    case failed

    var displayName: String {
        switch self {
        case .processing: String(localized: "import.status.processing")
        case .completed: String(localized: "import.status.completed")
        case .failed: String(localized: "import.status.failed")
        }
    }
}
