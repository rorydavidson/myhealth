import Testing
import HealthKit
import Foundation
@testable import HealthDashboard

/// Tests for HealthKit → HealthRecord normalisation (Milestone 14 — initial data load).
struct NormalizeTests {
    // MARK: - MetricTypeMapping

    @Test("Step count maps to correct internal type")
    func stepCountMapping() {
        #expect(MetricTypeMapping.metricType(for: .stepCount) == "step_count")
    }

    @Test("Heart rate maps to correct internal type")
    func heartRateMapping() {
        #expect(MetricTypeMapping.metricType(for: .heartRate) == "heart_rate")
    }

    @Test("Sleep analysis maps to correct internal type")
    func sleepAnalysisMapping() {
        #expect(MetricTypeMapping.metricType(for: .sleepAnalysis) == "sleep_session")
    }

    @Test("All quantity identifiers have a mapping entry")
    func allQuantityIdentifiersHaveMapping() {
        let identifiers: [HKQuantityTypeIdentifier] = [
            .stepCount, .distanceWalkingRunning, .activeEnergyBurned, .flightsClimbed,
            .heartRate, .restingHeartRate, .heartRateVariabilitySDNN,
            .bodyMass, .bodyFatPercentage,
            .oxygenSaturation, .bloodPressureSystolic, .bloodPressureDiastolic, .respiratoryRate,
        ]
        for id in identifiers {
            #expect(MetricTypeMapping.metricType(for: id) != nil, "Missing mapping for \(id.rawValue)")
        }
    }

    // MARK: - Unit strings

    @Test("Step count unit string is 'count'")
    func stepCountUnitString() {
        #expect(MetricTypeMapping.unitString(for: .stepCount) == "count")
    }

    @Test("Heart rate unit string is 'bpm'")
    func heartRateUnitString() {
        #expect(MetricTypeMapping.unitString(for: .heartRate) == "bpm")
    }

    @Test("Body mass unit string is 'kg'")
    func bodyMassUnitString() {
        #expect(MetricTypeMapping.unitString(for: .bodyMass) == "kg")
    }

    // MARK: - MetricCategory lookup

    @Test("Step count resolves to activity category")
    func stepCountCategory() {
        #expect(MetricTypeMapping.metricCategory(for: "step_count") == .activity)
    }

    @Test("Heart rate resolves to heart category")
    func heartRateCategory() {
        #expect(MetricTypeMapping.metricCategory(for: "heart_rate") == .heart)
    }

    @Test("Sleep session resolves to sleep category")
    func sleepSessionCategory() {
        #expect(MetricTypeMapping.metricCategory(for: "sleep_session") == .sleep)
    }
}
