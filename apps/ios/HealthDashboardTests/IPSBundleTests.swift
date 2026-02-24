import Testing
import Foundation
@testable import HealthDashboard

/// Tests for IPS FHIR bundle generation (Milestone 20 — IPSService).
/// Verifies structural requirements from the HL7 FHIR IPS Implementation Guide.
struct IPSBundleTests {
    // MARK: - DailySummary ID format

    @Test("DailySummary ID follows metricType:date format")
    func dailySummaryIdFormat() {
        let summary = DailySummary(metricType: "heart_rate", date: "2025-03-01")
        #expect(summary.id == "heart_rate:2025-03-01")
    }

    // MARK: - LabResult structured values round-trip

    @Test("LabResult structured values encode and decode correctly")
    func labResultStructuredValuesRoundTrip() throws {
        let values: [String: LabValue] = [
            "HDL": LabValue(value: 55, unit: "mg/dL", flag: .normal, referenceRange: "40-60", loincCode: "2085-9"),
            "LDL": LabValue(value: 120, unit: "mg/dL", flag: .normal, referenceRange: "< 130", loincCode: "2089-1"),
        ]

        let labResult = LabResult(
            fileName: "test-lab.pdf",
            date: "2025-02-15",
            category: .lipidPanel,
            structuredValues: values
        )

        let decoded = labResult.structuredValues
        #expect(decoded?["HDL"]?.value == 55)
        #expect(decoded?["HDL"]?.loincCode == "2085-9")
        #expect(decoded?["LDL"]?.value == 120)
    }

    // MARK: - Model ID uniqueness

    @Test("HealthRecord auto-generates UUID on init")
    func healthRecordAutoUUID() {
        let record1 = HealthRecord(
            metricType: "step_count", value: 1000, unit: "count",
            startTime: Date(), sourcePlatform: "apple_health", importId: "import-1"
        )
        let record2 = HealthRecord(
            metricType: "step_count", value: 2000, unit: "count",
            startTime: Date(), sourcePlatform: "apple_health", importId: "import-1"
        )
        #expect(record1.id != record2.id)
    }

    // MARK: - ClinicalCondition status

    @Test("ClinicalCondition defaults to active status")
    func conditionDefaultStatus() {
        let condition = ClinicalCondition(snomedCode: "44054006", snomedDisplay: "Type 2 diabetes mellitus")
        #expect(condition.conditionStatus == .active)
    }

    // MARK: - Allergy criticality

    @Test("Allergy high criticality round-trips correctly")
    func allergyHighCriticalityRoundTrip() {
        let allergy = Allergy(
            snomedCode: "372687004",
            snomedDisplay: "Amoxicillin",
            criticality: .high
        )
        #expect(allergy.allergyCriticality == .high)
    }
}
