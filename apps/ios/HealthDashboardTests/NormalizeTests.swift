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

    // MARK: - WorkoutTypeMapping

    @Test("Running maps to 'running'")
    func workoutRunningMapping() {
        #expect(WorkoutTypeMapping.internalType(for: .running) == "running")
    }

    @Test("Walking maps to 'walking'")
    func workoutWalkingMapping() {
        #expect(WorkoutTypeMapping.internalType(for: .walking) == "walking")
    }

    @Test("Cycling maps to 'cycling'")
    func workoutCyclingMapping() {
        #expect(WorkoutTypeMapping.internalType(for: .cycling) == "cycling")
    }

    @Test("Swimming maps to 'swimming'")
    func workoutSwimmingMapping() {
        #expect(WorkoutTypeMapping.internalType(for: .swimming) == "swimming")
    }

    @Test("Both strength training types map to 'strength_training'")
    func workoutStrengthTrainingMapping() {
        #expect(WorkoutTypeMapping.internalType(for: .traditionalStrengthTraining) == "strength_training")
        #expect(WorkoutTypeMapping.internalType(for: .functionalStrengthTraining) == "strength_training")
    }

    @Test("HIIT maps to 'hiit'")
    func workoutHIITMapping() {
        #expect(WorkoutTypeMapping.internalType(for: .highIntensityIntervalTraining) == "hiit")
    }

    @Test("Unhandled workout type falls back to 'other'")
    func workoutUnknownFallback() {
        #expect(WorkoutTypeMapping.internalType(for: .archery) == "other")
    }

    @Test("All common workout types have non-empty display names")
    func workoutDisplayNamesNonEmpty() {
        let types = [
            "running", "walking", "cycling", "swimming", "yoga",
            "hiit", "strength_training", "hiking", "elliptical", "other",
        ]
        for type in types {
            let name = WorkoutTypeMapping.displayName(for: type)
            #expect(!name.isEmpty, "Empty display name for workout type '\(type)'")
        }
    }

    @Test("All common workout types have non-empty SF Symbol names")
    func workoutSFSymbolsNonEmpty() {
        let types = [
            "running", "walking", "cycling", "swimming",
            "yoga", "hiit", "strength_training", "hiking",
        ]
        for type in types {
            let symbol = WorkoutTypeMapping.sfSymbol(for: type)
            #expect(!symbol.isEmpty, "Empty SF symbol for workout type '\(type)'")
        }
    }

    // MARK: - SleepSessionGrouper

    @Test("Single continuous block becomes one session")
    func sleepSingleBlock() {
        let base = Date(timeIntervalSince1970: 0)
        let samples = [
            makeSleepSample(.asleepCore, start: base,                         end: base + 3600),
            makeSleepSample(.asleepDeep, start: base + 3600,                  end: base + 5400),
            makeSleepSample(.asleepREM,  start: base + 5400,                  end: base + 7200),
        ]
        let sessions = SleepSessionGrouper.group(samples: samples)
        #expect(sessions.count == 1)
        #expect(sessions[0].startTime == base)
        #expect(sessions[0].endTime   == base + 7200)
    }

    @Test("Gap > 30 minutes creates two sessions")
    func sleepGapOver30MinCreatesTwoSessions() {
        let base = Date(timeIntervalSince1970: 0)
        // Session 1 ends at +3600; session 2 starts at +5460 (gap = 31 min)
        let samples = [
            makeSleepSample(.asleepCore, start: base,        end: base + 3600),
            makeSleepSample(.asleepCore, start: base + 5460, end: base + 9060),
        ]
        let sessions = SleepSessionGrouper.group(samples: samples)
        #expect(sessions.count == 2)
    }

    @Test("Gap of exactly 30 minutes stays in one session")
    func sleepExact30MinGapIsSameSession() {
        let base = Date(timeIntervalSince1970: 0)
        // Gap = 5400 - 3600 = 1800 seconds = exactly 30 minutes → same session
        let samples = [
            makeSleepSample(.asleepCore, start: base,        end: base + 3600),
            makeSleepSample(.asleepREM,  start: base + 5400, end: base + 9000),
        ]
        let sessions = SleepSessionGrouper.group(samples: samples)
        #expect(sessions.count == 1)
    }

    @Test("Stage durations are tallied correctly")
    func sleepStageDurationTally() {
        let base = Date(timeIntervalSince1970: 0)
        let samples = [
            makeSleepSample(.awake,      start: base,        end: base + 600),  // 10 min
            makeSleepSample(.asleepCore, start: base + 600,  end: base + 2400), // 30 min
            makeSleepSample(.asleepDeep, start: base + 2400, end: base + 3600), // 20 min
            makeSleepSample(.asleepREM,  start: base + 3600, end: base + 4800), // 20 min
        ]
        let sessions = SleepSessionGrouper.group(samples: samples)
        #expect(sessions.count == 1)
        let s = sessions[0]
        #expect(s.awakeMins    == 10)
        #expect(s.coreMins     == 30)
        #expect(s.deepMins     == 20)
        #expect(s.remMins      == 20)
        #expect(s.totalMinutes == 80)
    }

    @Test("In-bed samples are excluded from stage totals")
    func sleepInBedExcludedFromTotal() {
        let base = Date(timeIntervalSince1970: 0)
        let samples = [
            makeSleepSample(.inBed,      start: base,        end: base + 1800), // 30 min in-bed
            makeSleepSample(.asleepCore, start: base + 1800, end: base + 5400), // 60 min core
        ]
        let sessions = SleepSessionGrouper.group(samples: samples)
        #expect(sessions.count == 1)
        // In-bed time excluded — only 60 min of actual sleep counted
        #expect(sessions[0].totalMinutes == 60)
        #expect(sessions[0].coreMins     == 60)
    }

    @Test("Unspecified sleep is treated as core sleep")
    func sleepUnspecifiedTreatedAsCore() {
        let base = Date(timeIntervalSince1970: 0)
        let samples = [
            makeSleepSample(.asleepUnspecified, start: base, end: base + 3600), // 60 min
        ]
        let sessions = SleepSessionGrouper.group(samples: samples)
        #expect(sessions.count == 1)
        #expect(sessions[0].coreMins     == 60)
        #expect(sessions[0].totalMinutes == 60)
    }

    @Test("Empty input returns empty output")
    func sleepEmptyInputReturnsEmpty() {
        let sessions = SleepSessionGrouper.group(samples: [])
        #expect(sessions.isEmpty)
    }

    @Test("Unsorted samples are sorted before grouping")
    func sleepUnsortedSamplesGroupedCorrectly() {
        let base = Date(timeIntervalSince1970: 0)
        // Deliberately reversed order
        let samples = [
            makeSleepSample(.asleepREM,  start: base + 3600, end: base + 5400),
            makeSleepSample(.asleepCore, start: base,        end: base + 3600),
        ]
        let sessions = SleepSessionGrouper.group(samples: samples)
        #expect(sessions.count == 1)
        #expect(sessions[0].startTime == base)
        #expect(sessions[0].endTime   == base + 5400)
    }

    @Test("Three separate nightly sessions are grouped independently")
    func sleepThreeNightsSeparate() {
        let day = TimeInterval(24 * 3600)
        let base = Date(timeIntervalSince1970: 0)
        // Night 1, 2, 3 — each 8 hours apart with 16-hour gaps
        let samples = [
            makeSleepSample(.asleepCore, start: base,          end: base + 3600),
            makeSleepSample(.asleepCore, start: base + day,    end: base + day + 3600),
            makeSleepSample(.asleepCore, start: base + 2*day,  end: base + 2*day + 3600),
        ]
        let sessions = SleepSessionGrouper.group(samples: samples)
        #expect(sessions.count == 3)
    }

    // MARK: - Helpers

    private func makeSleepSample(
        _ value: HKCategoryValueSleepAnalysis,
        start: Date,
        end: Date
    ) -> HKCategorySample {
        HKCategorySample(
            type: HKCategoryType(.sleepAnalysis),
            value: value.rawValue,
            start: start,
            end: end
        )
    }
}
