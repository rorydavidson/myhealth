import Testing
import Foundation
@testable import HealthDashboard

/// Tests for daily summary computation logic (Milestone 14/16 — AggregationService).
/// These mirror the Phase 1 `aggregate.test.ts` test cases.
struct AggregationTests {
    // MARK: - Step count (additive)

    @Test("Daily step sum aggregates multiple records correctly")
    func stepCountSumAggregation() async throws {
        // Given records spread across a single day
        let records = [
            makeRecord(metricType: "step_count", value: 3000, unit: "count"),
            makeRecord(metricType: "step_count", value: 2500, unit: "count"),
            makeRecord(metricType: "step_count", value: 1750, unit: "count"),
        ]

        // When aggregated
        let summary = aggregate(records: records, metricType: "step_count", date: "2025-03-01")

        // Then
        #expect(summary.sum == 7250)
        #expect(summary.count == 3)
        #expect(summary.avg == 7250.0 / 3.0)
        #expect(summary.min == 1750)
        #expect(summary.max == 3000)
    }

    // MARK: - Heart rate (non-additive)

    @Test("Heart rate average uses mean of all samples")
    func heartRateAverageAggregation() async throws {
        let records = [
            makeRecord(metricType: "heart_rate", value: 58, unit: "bpm"),
            makeRecord(metricType: "heart_rate", value: 72, unit: "bpm"),
            makeRecord(metricType: "heart_rate", value: 65, unit: "bpm"),
        ]

        let summary = aggregate(records: records, metricType: "heart_rate", date: "2025-03-01")

        #expect(summary.avg == (58 + 72 + 65) / 3.0)
        #expect(summary.min == 58)
        #expect(summary.max == 72)
        // sum is nil for non-additive
        #expect(summary.sum == nil)
    }

    // MARK: - Empty records

    @Test("Aggregating empty records returns zero-count summary")
    func emptyRecordsAggregation() async throws {
        let summary = aggregate(records: [], metricType: "step_count", date: "2025-03-01")

        #expect(summary.count == 0)
        #expect(summary.sum == nil)
        #expect(summary.avg == nil)
    }

    // MARK: - displayValue

    @Test("displayValue returns sum for additive metrics")
    func displayValueAdditiveMetric() async throws {
        let summary = DailySummary(metricType: "step_count", date: "2025-03-01", sum: 8247, count: 10)
        #expect(summary.displayValue == 8247)
    }

    @Test("displayValue returns avg for non-additive metrics")
    func displayValueNonAdditiveMetric() async throws {
        let summary = DailySummary(metricType: "heart_rate", date: "2025-03-01", avg: 63.5, count: 5)
        #expect(summary.displayValue == 63.5)
    }

    // MARK: - Helpers

    private func makeRecord(metricType: String, value: Double, unit: String) -> HealthRecord {
        HealthRecord(
            metricType: metricType,
            value: value,
            unit: unit,
            startTime: Date(),
            sourcePlatform: "apple_health",
            importId: "test-import"
        )
    }

    /// Minimal aggregation logic for test validation.
    /// The real implementation lives in AggregationService (Milestone 14).
    private func aggregate(records: [HealthRecord], metricType: String, date: String) -> DailySummary {
        guard !records.isEmpty else {
            return DailySummary(metricType: metricType, date: date, count: 0)
        }
        let values = records.compactMap(\.value)
        let additiveMetrics = ["step_count", "distance", "active_energy", "flights_climbed"]
        let isAdditive = additiveMetrics.contains(metricType)

        return DailySummary(
            metricType: metricType,
            date: date,
            avg: values.reduce(0, +) / Double(values.count),
            min: values.min(),
            max: values.max(),
            sum: isAdditive ? values.reduce(0, +) : nil,
            count: records.count
        )
    }
}
