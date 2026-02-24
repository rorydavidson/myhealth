import Foundation
import SwiftData

/// A user-uploaded PDF lab report — mirrors the Phase 1 `labResults` IndexedDB store.
/// The PDF is stored as binary Data on-device; never uploaded to the server.
@Model
final class LabResult {
    @Attribute(.unique) var id: String

    var fileName: String

    /// Date of the lab test — ISO 8601 `YYYY-MM-DD`
    var date: String

    /// `blood_panel`, `lipid_panel`, `thyroid`, `metabolic`, or `other`
    var category: String

    /// Original PDF stored as binary data (not uploaded to server)
    @Attribute(.externalStorage) var pdfData: Data?

    /// Full text extracted from the PDF via PDFKit (client-side)
    var extractedText: String?

    /// JSON-encoded structured lab values with optional LOINC codes.
    /// e.g. `{ "HDL": { "value": 55, "unit": "mg/dL", "flag": "normal",
    ///                   "referenceRange": "40-60", "loincCode": "2085-9" } }`
    private var structuredValuesData: Data?

    var notes: String?
    var createdAt: Date

    init(
        id: String = UUID().uuidString,
        fileName: String,
        date: String,
        category: LabCategory,
        pdfData: Data? = nil,
        extractedText: String? = nil,
        structuredValues: [String: LabValue]? = nil,
        notes: String? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.fileName = fileName
        self.date = date
        self.category = category.rawValue
        self.pdfData = pdfData
        self.extractedText = extractedText
        self.notes = notes
        self.createdAt = createdAt
        if let structuredValues {
            self.structuredValuesData = try? JSONEncoder().encode(structuredValues)
        }
    }

    var structuredValues: [String: LabValue]? {
        get {
            guard let data = structuredValuesData else { return nil }
            return try? JSONDecoder().decode([String: LabValue].self, from: data)
        }
        set {
            structuredValuesData = try? JSONEncoder().encode(newValue)
        }
    }

    var labCategory: LabCategory {
        LabCategory(rawValue: category) ?? .other
    }
}

// MARK: - Supporting Types

enum LabCategory: String, CaseIterable, Codable {
    case bloodPanel = "blood_panel"
    case lipidPanel = "lipid_panel"
    case thyroid
    case metabolic
    case other

    var displayName: String {
        switch self {
        case .bloodPanel: String(localized: "lab.category.bloodPanel")
        case .lipidPanel: String(localized: "lab.category.lipidPanel")
        case .thyroid: String(localized: "lab.category.thyroid")
        case .metabolic: String(localized: "lab.category.metabolic")
        case .other: String(localized: "lab.category.other")
        }
    }
}

/// A single extracted lab value with LOINC coding.
struct LabValue: Codable, Sendable {
    var value: Double
    var unit: String
    var flag: LabFlag?
    var referenceRange: String?
    var loincCode: String?

    enum LabFlag: String, Codable {
        case normal, high, low, critical
    }
}
