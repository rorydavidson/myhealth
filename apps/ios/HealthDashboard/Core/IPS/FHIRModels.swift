import Foundation

// MARK: - FHIR R4 Codable Models
//
// Lightweight Codable structs for the subset of FHIR R4 resources needed
// to produce an IPS (International Patient Summary) Bundle.
//
// Reference: https://hl7.org/fhir/R4/ and https://hl7.org/fhir/uv/ips/

// MARK: - Base Types

struct FHIRCoding: Codable, Sendable {
    var system: String
    var code: String
    var display: String?
}

struct FHIRCodeableConcept: Codable, Sendable {
    var coding: [FHIRCoding]
    var text: String?
}

struct FHIRReference: Codable, Sendable {
    var reference: String
    var display: String?
}

struct FHIRQuantity: Codable, Sendable {
    var value: Double
    var unit: String
    var system: String?
    var code: String?
}

struct FHIRPeriod: Codable, Sendable {
    var start: String?
    var end: String?
}

struct FHIRMeta: Codable, Sendable {
    var profile: [String]?
}

struct FHIRIdentifier: Codable, Sendable {
    var system: String?
    var value: String
}

struct FHIRNarrative: Codable, Sendable {
    var status: String   // "generated", "additional", "empty"
    var div: String      // XHTML fragment
}

// MARK: - Patient

struct FHIRPatient: Codable, Sendable {
    var resourceType: String = "Patient"
    var id: String
    var meta: FHIRMeta?
    var identifier: [FHIRIdentifier]?
    var name: [FHIRHumanName]?
    var gender: String?
    var birthDate: String?
}

struct FHIRHumanName: Codable, Sendable {
    var use: String?       // "official"
    var text: String?
    var family: String?
    var given: [String]?
}

// MARK: - Observation

struct FHIRObservation: Codable, Sendable {
    var resourceType: String = "Observation"
    var id: String
    var meta: FHIRMeta?
    var status: String = "final"
    var category: [FHIRCodeableConcept]?
    var code: FHIRCodeableConcept
    var subject: FHIRReference?
    var effectiveDateTime: String?
    var effectivePeriod: FHIRPeriod?
    var valueQuantity: FHIRQuantity?
    var valueCodeableConcept: FHIRCodeableConcept?
    var valueString: String?
    var component: [FHIRObservationComponent]?
    var dataAbsentReason: FHIRCodeableConcept?
    var note: [FHIRAnnotation]?
}

struct FHIRObservationComponent: Codable, Sendable {
    var code: FHIRCodeableConcept
    var valueQuantity: FHIRQuantity?
    var valueString: String?
}

struct FHIRAnnotation: Codable, Sendable {
    var text: String
}

// MARK: - Condition

struct FHIRCondition: Codable, Sendable {
    var resourceType: String = "Condition"
    var id: String
    var meta: FHIRMeta?
    var clinicalStatus: FHIRCodeableConcept
    var code: FHIRCodeableConcept
    var subject: FHIRReference
    var onsetDateTime: String?
    var note: [FHIRAnnotation]?
    var category: [FHIRCodeableConcept]?
}

// MARK: - Medication / MedicationStatement

struct FHIRMedication: Codable, Sendable {
    var resourceType: String = "Medication"
    var id: String
    var code: FHIRCodeableConcept
}

struct FHIRMedicationStatement: Codable, Sendable {
    var resourceType: String = "MedicationStatement"
    var id: String
    var meta: FHIRMeta?
    var status: String   // "active", "stopped", "on-hold"
    var medicationCodeableConcept: FHIRCodeableConcept
    var subject: FHIRReference
    var effectivePeriod: FHIRPeriod?
    var dosage: [FHIRDosage]?
    var note: [FHIRAnnotation]?
    var reasonCode: [FHIRCodeableConcept]?
}

struct FHIRDosage: Codable, Sendable {
    var text: String?
}

// MARK: - AllergyIntolerance

struct FHIRAllergyIntolerance: Codable, Sendable {
    var resourceType: String = "AllergyIntolerance"
    var id: String
    var meta: FHIRMeta?
    var clinicalStatus: FHIRCodeableConcept
    var type: String?        // "allergy" | "intolerance"
    var category: [String]?  // "food" | "medication" | "environment" | "biologic"
    var criticality: String? // "high" | "low" | "unable-to-assess"
    var code: FHIRCodeableConcept
    var patient: FHIRReference
    var onsetDateTime: String?
    var reaction: [FHIRAllergyReaction]?
    var note: [FHIRAnnotation]?
}

struct FHIRAllergyReaction: Codable, Sendable {
    var manifestation: [FHIRCodeableConcept]
    var description: String?
}

// MARK: - Composition

struct FHIRComposition: Codable, Sendable {
    var resourceType: String = "Composition"
    var id: String
    var meta: FHIRMeta?
    var status: String = "final"
    var type: FHIRCodeableConcept        // LOINC 60591-5 — Patient summary document
    var subject: FHIRReference
    var date: String                     // ISO 8601
    var author: [FHIRReference]
    var title: String
    var confidentiality: String?
    var section: [FHIRCompositionSection]
}

struct FHIRCompositionSection: Codable, Sendable {
    var title: String
    var code: FHIRCodeableConcept
    var text: FHIRNarrative?
    var emptyReason: FHIRCodeableConcept?
    var entry: [FHIRReference]?
    var section: [FHIRCompositionSection]?   // sub-sections
}

// MARK: - Bundle

struct FHIRBundle: Codable, Sendable {
    var resourceType: String = "Bundle"
    var id: String
    var meta: FHIRMeta?
    var identifier: FHIRIdentifier?
    var type: String = "document"
    var timestamp: String
    var entry: [FHIRBundleEntry]
}

struct FHIRBundleEntry: Codable, Sendable {
    var fullUrl: String
    var resource: FHIRResource
}

// MARK: - Resource Wrapper (discriminated union for Bundle entries)

/// Wraps the heterogeneous FHIR resources that appear in a Bundle.
/// Each case corresponds to one FHIR resource type.
enum FHIRResource: Codable, Sendable {
    case patient(FHIRPatient)
    case composition(FHIRComposition)
    case observation(FHIRObservation)
    case condition(FHIRCondition)
    case medicationStatement(FHIRMedicationStatement)
    case allergyIntolerance(FHIRAllergyIntolerance)

    // MARK: Codable

    init(from decoder: Decoder) throws {
        // Peek at resourceType to discriminate
        let container = try decoder.singleValueContainer()
        struct TypePeek: Decodable { let resourceType: String }
        let peek = try container.decode(TypePeek.self)
        switch peek.resourceType {
        case "Patient":
            self = .patient(try container.decode(FHIRPatient.self))
        case "Composition":
            self = .composition(try container.decode(FHIRComposition.self))
        case "Observation":
            self = .observation(try container.decode(FHIRObservation.self))
        case "Condition":
            self = .condition(try container.decode(FHIRCondition.self))
        case "MedicationStatement":
            self = .medicationStatement(try container.decode(FHIRMedicationStatement.self))
        case "AllergyIntolerance":
            self = .allergyIntolerance(try container.decode(FHIRAllergyIntolerance.self))
        default:
            throw DecodingError.dataCorruptedError(in: container,
                debugDescription: "Unknown FHIR resourceType: \(peek.resourceType)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .patient(let r):              try container.encode(r)
        case .composition(let r):          try container.encode(r)
        case .observation(let r):          try container.encode(r)
        case .condition(let r):            try container.encode(r)
        case .medicationStatement(let r):  try container.encode(r)
        case .allergyIntolerance(let r):   try container.encode(r)
        }
    }
}

// MARK: - LOINC / SNOMED Constants

enum LOINC {
    // Document type
    static let patientSummary = FHIRCoding(system: "http://loinc.org", code: "60591-5", display: "Patient summary Document")

    // Section codes
    static let vitalSigns        = FHIRCoding(system: "http://loinc.org", code: "8716-3",  display: "Vital signs")
    static let labResults        = FHIRCoding(system: "http://loinc.org", code: "30954-2", display: "Relevant diagnostic tests/laboratory data Narrative")
    static let medications       = FHIRCoding(system: "http://loinc.org", code: "10160-0", display: "History of Medication use Narrative")
    static let allergies         = FHIRCoding(system: "http://loinc.org", code: "48765-2", display: "Allergies and adverse reactions Document")
    static let problemList       = FHIRCoding(system: "http://loinc.org", code: "11450-4", display: "Problem list - Reported")

    // Vital sign observation codes
    static let heartRate         = FHIRCoding(system: "http://loinc.org", code: "8867-4",  display: "Heart rate")
    static let restingHeartRate  = FHIRCoding(system: "http://loinc.org", code: "40443-4", display: "Resting heart rate")
    static let bloodPressure     = FHIRCoding(system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel")
    static let systolicBP        = FHIRCoding(system: "http://loinc.org", code: "8480-6",  display: "Systolic blood pressure")
    static let diastolicBP       = FHIRCoding(system: "http://loinc.org", code: "8462-4",  display: "Diastolic blood pressure")
    static let oxygenSaturation  = FHIRCoding(system: "http://loinc.org", code: "2708-6",  display: "Oxygen saturation")
    static let respiratoryRate   = FHIRCoding(system: "http://loinc.org", code: "9279-1",  display: "Respiratory rate")
    static let bodyWeight        = FHIRCoding(system: "http://loinc.org", code: "29463-7", display: "Body weight")
    static let hrv               = FHIRCoding(system: "http://loinc.org", code: "80404-7", display: "R-R interval standard deviation")
}

enum SNOMED {
    static let active         = FHIRCoding(system: "http://snomed.info/sct", code: "55561003", display: "Active")
    static let resolved       = FHIRCoding(system: "http://snomed.info/sct", code: "73425007", display: "Resolved")
    static let inactive       = FHIRCoding(system: "http://snomed.info/sct", code: "73425007", display: "Inactive")

    // Allergy clinical status
    static let allergyActive  = FHIRCoding(system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active", display: "Active")
}

/// Section-level "no information" code — used in required IPS sections with no data.
enum DataAbsentReason {
    static let noInformation = FHIRCoding(
        system: "http://terminology.hl7.org/CodeSystem/data-absent-reason",
        code: "not-applicable",
        display: "No information"
    )
    static let noKnownAllergies = FHIRCoding(
        system: "http://snomed.info/sct",
        code: "716186003",
        display: "No known allergy"
    )
    static let noKnownMedications = FHIRCoding(
        system: "http://snomed.info/sct",
        code: "182849000",
        display: "No known medications"
    )
    static let noKnownProblems = FHIRCoding(
        system: "http://snomed.info/sct",
        code: "160245001",
        display: "No current problems or disability"
    )
}
