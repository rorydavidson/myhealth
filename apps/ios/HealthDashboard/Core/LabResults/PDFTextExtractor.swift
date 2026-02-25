import Foundation
import PDFKit

/// Extracts text and structured lab values from a PDF on-device using PDFKit.
///
/// Runs entirely client-side — no network calls, no server involvement.
/// Mirrors the Phase 1 `pdf-extractor.worker.ts` pipeline.
struct PDFTextExtractor {

    // MARK: - Public API

    /// Extracts full text from all pages of the PDF.
    static func extractText(from data: Data) -> String? {
        guard let document = PDFDocument(data: data) else { return nil }
        var pages: [String] = []
        for i in 0..<document.pageCount {
            guard let page = document.page(at: i) else { continue }
            if let text = page.string, !text.isEmpty {
                pages.append(text)
            }
        }
        let combined = pages.joined(separator: "\n")
        return combined.isEmpty ? nil : combined
    }

    /// Parses extracted text into structured `[testName: LabValue]` pairs
    /// and auto-assigns LOINC codes via `labCoding`.
    ///
    /// The parser uses a set of regex patterns that match the most common
    /// lab report formats (English and French):
    ///
    ///   `TestName   12.3   mg/dL   10.0 – 20.0   N`
    ///   `TestName: 12.3 mg/dL (ref: 10.0-20.0)`
    ///
    /// Any line that doesn't match is silently skipped — the user can add
    /// values manually in the review step.
    static func extractStructuredValues(from text: String) -> [String: LabValue] {
        var result: [String: LabValue] = [:]

        for line in text.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { continue }

            if let parsed = parseLine(trimmed) {
                // De-duplicate: prefer the first occurrence of each test name.
                if result[parsed.name] == nil {
                    result[parsed.name] = parsed.value
                }
            }
        }

        return result
    }

    // MARK: - Line parser

    private struct ParsedEntry {
        let name: String
        let value: LabValue
    }

    /// Attempts to parse a single line into a test-name / value pair.
    ///
    /// Tries three patterns in order of specificity:
    /// 1. Tabular: `Name  value  unit  ref-range  flag` (space/tab separated)
    /// 2. Colon:   `Name: value unit (ref: low-high)`
    /// 3. Label=value: `Name = value unit`
    private static func parseLine(_ line: String) -> ParsedEntry? {
        // Skip lines that are clearly headers or page markers
        guard line.count > 4,
              line.contains(try! Regex("[0-9]")) else { return nil }

        // Skip lines that look like page headers / dates / totals
        let skipPrefixes = ["page", "date", "patient", "médecin", "doctor", "laboratory", "laboratoire", "ref", "norme", "valeur", "result", "examen"]
        let lower = line.lowercased()
        if skipPrefixes.contains(where: { lower.hasPrefix($0) }) { return nil }

        // Pattern 1: tabular — test name followed by a numeric value, optional unit, optional range, optional flag
        // Captures: (name) (value) (unit)? (range)? (flag)?
        if let entry = parseTabular(line) { return entry }

        // Pattern 2: colon separator — "Name: 12.3 mg/dL"
        if let entry = parseColon(line) { return entry }

        return nil
    }

    // MARK: - Pattern 1: tabular

    // Regex: (test name text) (number with optional comma decimal) (optional unit) (optional ref range)
    // Example: "HDL Cholesterol    1.45    mmol/L    1.00 – 2.50    N"
    // Example: "Hemoglobin    13,4    g/dL    12.0-16.0"
    private static let tabularRegex = try! NSRegularExpression(
        pattern: #"^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 \.\-\/\(\)%#]{2,40}?)\s{2,}([0-9]+[,\.][0-9]+|[0-9]+)\s*([A-Za-z%\/µ]+(?:\/[A-Za-z]+)?)?\s*([0-9<>][0-9\.,\-–\s]*[0-9])?\s*(H|L|N|A|high|low|normal|abnormal|élevé|bas|normal)?"#,
        options: .caseInsensitive
    )

    private static func parseTabular(_ line: String) -> ParsedEntry? {
        let range = NSRange(line.startIndex..., in: line)
        guard let match = tabularRegex.firstMatch(in: line, range: range),
              match.numberOfRanges >= 3 else { return nil }

        guard
            let nameRange   = Range(match.range(at: 1), in: line),
            let valueRange  = Range(match.range(at: 2), in: line)
        else { return nil }

        let rawName  = String(line[nameRange]).trimmingCharacters(in: .whitespaces)
        let rawValue = String(line[valueRange]).replacingOccurrences(of: ",", with: ".")

        guard let numericValue = Double(rawValue), numericValue > 0 else { return nil }

        let unit: String? = {
            guard match.numberOfRanges > 3,
                  let r = Range(match.range(at: 3), in: line) else { return nil }
            let u = String(line[r]).trimmingCharacters(in: .whitespaces)
            return u.isEmpty ? nil : u
        }()

        let refRange: String? = {
            guard match.numberOfRanges > 4,
                  let r = Range(match.range(at: 4), in: line) else { return nil }
            let s = String(line[r]).trimmingCharacters(in: .whitespaces)
            return s.isEmpty ? nil : s
        }()

        let flag: LabValue.LabFlag? = {
            guard match.numberOfRanges > 5,
                  let r = Range(match.range(at: 5), in: line) else { return nil }
            return flagFrom(String(line[r]))
        }()

        let loinc = lookupLoincCode(for: rawName)
        return ParsedEntry(
            name: rawName,
            value: LabValue(
                value: numericValue,
                unit: unit ?? "",
                flag: flag,
                referenceRange: refRange,
                loincCode: loinc?.code
            )
        )
    }

    // MARK: - Pattern 2: colon separator

    // Example: "TSH: 2.35 mIU/L"
    // Example: "Glucose: 5,1 mmol/L (ref: 3.9-5.6)"
    private static let colonRegex = try! NSRegularExpression(
        pattern: #"^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 \.\-\/\(\)%#]{2,40}?)\s*:\s*([0-9]+[,\.][0-9]+|[0-9]+)\s*([A-Za-z%\/µ]+(?:\/[A-Za-z]+)?)?"#,
        options: .caseInsensitive
    )

    private static func parseColon(_ line: String) -> ParsedEntry? {
        let range = NSRange(line.startIndex..., in: line)
        guard let match = colonRegex.firstMatch(in: line, range: range),
              match.numberOfRanges >= 3,
              let nameRange  = Range(match.range(at: 1), in: line),
              let valueRange = Range(match.range(at: 2), in: line)
        else { return nil }

        let rawName  = String(line[nameRange]).trimmingCharacters(in: .whitespaces)
        let rawValue = String(line[valueRange]).replacingOccurrences(of: ",", with: ".")

        guard let numericValue = Double(rawValue), numericValue > 0 else { return nil }

        let unit: String? = {
            guard match.numberOfRanges > 3,
                  let r = Range(match.range(at: 3), in: line) else { return nil }
            let u = String(line[r]).trimmingCharacters(in: .whitespaces)
            return u.isEmpty ? nil : u
        }()

        let loinc = lookupLoincCode(for: rawName)
        return ParsedEntry(
            name: rawName,
            value: LabValue(
                value: numericValue,
                unit: unit ?? "",
                flag: nil,
                referenceRange: nil,
                loincCode: loinc?.code
            )
        )
    }

    // MARK: - Flag normalisation

    private static func flagFrom(_ raw: String) -> LabValue.LabFlag? {
        switch raw.lowercased().trimmingCharacters(in: .whitespaces) {
        case "h", "high", "élevé", "elevé":    return .high
        case "l", "low", "bas":                return .low
        case "n", "normal":                    return .normal
        case "a", "abnormal":                  return .high   // conservative: abnormal → high
        default:                               return nil
        }
    }
}
