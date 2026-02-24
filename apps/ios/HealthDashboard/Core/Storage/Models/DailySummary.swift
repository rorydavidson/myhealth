import Foundation
import SwiftData

/// Pre-aggregated daily summary for a single metric — mirrors the Phase 1 `dailySummaries` IndexedDB store.
/// The id format is `{metricType}:{YYYY-MM-DD}` matching Phase 1.
@Model
final class DailySummary {
    /// Composite key: `{metricType}:{YYYY-MM-DD}`, e.g. `step_count:2025-03-01`
    @Attribute(.unique) var id: String

    var metricType: String

    /// ISO 8601 date string: `YYYY-MM-DD`
    var date: String

    var avg: Double?
    var min: Double?
    var max: Double?

    /// Sum for additive metrics (steps, calories, distance); nil for non-additive (heart rate, weight)
    var sum: Double?

    var count: Int

    init(
        metricType: String,
        date: String,
        avg: Double? = nil,
        min: Double? = nil,
        max: Double? = nil,
        sum: Double? = nil,
        count: Int = 0
    ) {
        self.id = "\(metricType):\(date)"
        self.metricType = metricType
        self.date = date
        self.avg = avg
        self.min = min
        self.max = max
        self.sum = sum
        self.count = count
    }

    /// Returns the primary display value for this metric.
    /// Additive metrics (steps, calories) use sum; others use avg.
    var displayValue: Double? {
        let additiveMetrics = ["step_count", "distance", "active_energy", "flights_climbed"]
        if additiveMetrics.contains(metricType) {
            return sum
        }
        return avg
    }
}
