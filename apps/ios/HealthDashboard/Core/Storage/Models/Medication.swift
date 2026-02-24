import Foundation
import SwiftData

/// A user-entered medication coded with SNOMED CT.
/// Used in the IPS Medication Summary section (LOINC 10160-0).
@Model
final class Medication {
    @Attribute(.unique) var id: String

    var snomedCode: String
    var snomedDisplay: String

    /// Free-text dose, e.g. "10 mg daily"
    var dose: String?

    /// ISO 8601 `YYYY-MM-DD`
    var startDate: String?

    /// nil = ongoing
    var endDate: String?

    /// `active`, `stopped`, or `on_hold`
    var status: String

    /// Free-text reason / indication
    var reason: String?
    var notes: String?
    var createdAt: Date

    init(
        id: String = UUID().uuidString,
        snomedCode: String,
        snomedDisplay: String,
        dose: String? = nil,
        startDate: String? = nil,
        endDate: String? = nil,
        status: MedicationStatus = .active,
        reason: String? = nil,
        notes: String? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.snomedCode = snomedCode
        self.snomedDisplay = snomedDisplay
        self.dose = dose
        self.startDate = startDate
        self.endDate = endDate
        self.status = status.rawValue
        self.reason = reason
        self.notes = notes
        self.createdAt = createdAt
    }

    var medicationStatus: MedicationStatus {
        MedicationStatus(rawValue: status) ?? .active
    }

    var isOngoing: Bool { endDate == nil }
}

enum MedicationStatus: String, CaseIterable, Codable {
    case active
    case stopped
    case onHold = "on_hold"

    var displayName: String {
        switch self {
        case .active: String(localized: "clinical.status.active")
        case .stopped: String(localized: "medication.status.stopped")
        case .onHold: String(localized: "medication.status.onHold")
        }
    }
}
