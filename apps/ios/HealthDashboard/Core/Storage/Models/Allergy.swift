import Foundation
import SwiftData

/// A user-entered allergy or intolerance coded with SNOMED CT.
/// Used in the IPS Allergies and Intolerances section (LOINC 48765-2).
@Model
final class Allergy {
    @Attribute(.unique) var id: String

    var snomedCode: String
    var snomedDisplay: String

    /// `allergy` or `intolerance`
    var type: String

    /// `food`, `medication`, `environment`, or `biologic`
    var category: String

    /// `high`, `low`, or `unable_to_assess`
    var criticality: String

    /// Free-text reaction description
    var reaction: String?

    /// ISO 8601 `YYYY-MM-DD`
    var onsetDate: String?

    var notes: String?
    var createdAt: Date

    /// AI-generated plain-language summary (nil while pending, empty string if generation failed).
    var aiSummary: String?

    init(
        id: String = UUID().uuidString,
        snomedCode: String,
        snomedDisplay: String,
        type: AllergyType = .allergy,
        category: AllergyCategory = .medication,
        criticality: AllergyCriticality = .unableToAssess,
        reaction: String? = nil,
        onsetDate: String? = nil,
        notes: String? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.snomedCode = snomedCode
        self.snomedDisplay = snomedDisplay
        self.type = type.rawValue
        self.category = category.rawValue
        self.criticality = criticality.rawValue
        self.reaction = reaction
        self.onsetDate = onsetDate
        self.notes = notes
        self.createdAt = createdAt
        self.aiSummary = nil
    }

    var allergyType: AllergyType { AllergyType(rawValue: type) ?? .allergy }
    var allergyCategory: AllergyCategory { AllergyCategory(rawValue: category) ?? .medication }
    var allergyCriticality: AllergyCriticality { AllergyCriticality(rawValue: criticality) ?? .unableToAssess }
}

enum AllergyType: String, CaseIterable, Codable {
    case allergy
    case intolerance

    var displayName: String {
        switch self {
        case .allergy: String(localized: "allergy.type.allergy")
        case .intolerance: String(localized: "allergy.type.intolerance")
        }
    }
}

enum AllergyCategory: String, CaseIterable, Codable {
    case food
    case medication
    case environment
    case biologic

    var displayName: String {
        switch self {
        case .food: String(localized: "allergy.category.food")
        case .medication: String(localized: "allergy.category.medication")
        case .environment: String(localized: "allergy.category.environment")
        case .biologic: String(localized: "allergy.category.biologic")
        }
    }
}

enum AllergyCriticality: String, CaseIterable, Codable {
    case high
    case low
    case unableToAssess = "unable_to_assess"

    var displayName: String {
        switch self {
        case .high: String(localized: "allergy.criticality.high")
        case .low: String(localized: "allergy.criticality.low")
        case .unableToAssess: String(localized: "allergy.criticality.unableToAssess")
        }
    }
}
