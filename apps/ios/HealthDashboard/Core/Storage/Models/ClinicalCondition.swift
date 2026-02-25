import Foundation
import SwiftData

/// A user-entered clinical condition coded with SNOMED CT.
/// Used in the IPS Problem List section (LOINC 11450-4).
@Model
final class ClinicalCondition {
    @Attribute(.unique) var id: String

    var snomedCode: String
    var snomedDisplay: String

    /// `active`, `resolved`, or `inactive`
    var status: String

    /// ISO 8601 `YYYY-MM-DD` — nil if unknown
    var onsetDate: String?

    var notes: String?
    var createdAt: Date

    /// AI-generated plain-language summary (nil while pending, empty string if generation failed).
    var aiSummary: String?

    init(
        id: String = UUID().uuidString,
        snomedCode: String,
        snomedDisplay: String,
        status: ConditionStatus = .active,
        onsetDate: String? = nil,
        notes: String? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.snomedCode = snomedCode
        self.snomedDisplay = snomedDisplay
        self.status = status.rawValue
        self.onsetDate = onsetDate
        self.notes = notes
        self.createdAt = createdAt
        self.aiSummary = nil
    }

    var conditionStatus: ConditionStatus {
        ConditionStatus(rawValue: status) ?? .active
    }
}

enum ConditionStatus: String, CaseIterable, Codable {
    case active
    case resolved
    case inactive

    var displayName: String {
        switch self {
        case .active: String(localized: "clinical.status.active")
        case .resolved: String(localized: "clinical.status.resolved")
        case .inactive: String(localized: "clinical.status.inactive")
        }
    }

    var badgeColor: some Hashable {
        switch self {
        case .active: DesignTokens.Colors.positive
        case .resolved: DesignTokens.Colors.neutral
        case .inactive: DesignTokens.Colors.warning
        }
    }
}
