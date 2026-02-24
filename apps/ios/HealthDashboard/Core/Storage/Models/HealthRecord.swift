import Foundation
import SwiftData

/// A single normalised health measurement — mirrors the Phase 1 `healthRecords` IndexedDB store.
///
/// Complex metadata (sleep stages, workout stats) is stored as JSON `Data`
/// and decoded on demand via typed helpers.
@Model
final class HealthRecord {
    @Attribute(.unique) var id: String

    /// Internal metric type, e.g. `step_count`, `heart_rate`, `sleep_session`.
    var metricType: String

    /// Measured value in SI units (nil for category records like sleep sessions).
    var value: Double?

    /// Unit string, e.g. `count`, `bpm`, `kg`, `m`.
    var unit: String

    var startTime: Date
    var endTime: Date?

    /// `apple_health` or `health_connect`
    var sourcePlatform: String

    /// HKSource.name or equivalent
    var sourceDevice: String?

    /// Original type identifier, e.g. `HKQuantityTypeIdentifierStepCount`
    var sourceType: String?

    /// FK to HealthImport.id — links record to its import batch
    var importId: String

    /// JSON-encoded metadata: sleep stages, workout details, etc.
    private var metadataData: Data?

    init(
        id: String = UUID().uuidString,
        metricType: String,
        value: Double? = nil,
        unit: String,
        startTime: Date,
        endTime: Date? = nil,
        sourcePlatform: String,
        sourceDevice: String? = nil,
        sourceType: String? = nil,
        importId: String,
        metadata: (any Encodable)? = nil
    ) {
        self.id = id
        self.metricType = metricType
        self.value = value
        self.unit = unit
        self.startTime = startTime
        self.endTime = endTime
        self.sourcePlatform = sourcePlatform
        self.sourceDevice = sourceDevice
        self.sourceType = sourceType
        self.importId = importId
        if let metadata {
            self.metadataData = try? JSONEncoder().encode(metadata)
        }
    }

    /// Decodes the stored metadata as a typed `Decodable` value.
    func decodeMetadata<T: Decodable>(as type: T.Type) -> T? {
        guard let data = metadataData else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    /// Encodes and stores new metadata.
    func setMetadata<T: Encodable>(_ value: T) {
        metadataData = try? JSONEncoder().encode(value)
    }
}

// MARK: - Metadata payloads

/// Sleep stage breakdown stored in HealthRecord.metadata for sleep_session records.
struct SleepMetadata: Codable, Sendable {
    var awakeMins: Double
    var coreMins: Double
    var deepMins: Double
    var remMins: Double
}

/// Workout details stored in HealthRecord.metadata for workout records.
struct WorkoutMetadata: Codable, Sendable {
    var workoutType: String
    var durationSeconds: Double
    var distanceMeters: Double?
    var activeEnergyKcal: Double?
}
