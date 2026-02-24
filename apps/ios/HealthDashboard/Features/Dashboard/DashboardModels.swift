import Foundation

// MARK: - ChartDataPoint

/// A single date + value pair consumed by Swift Charts.
/// Used across all chart views in the dashboard and metric detail screens.
struct ChartDataPoint: Identifiable, Sendable {
    /// Composite key: `{metricType}:{YYYY-MM-DD}`.
    let id: String
    let date: Date
    /// Primary display value — sum for additive metrics (steps, calories),
    /// daily average for non-additive metrics (heart rate, weight).
    let value: Double
    /// Per-day minimum — used for heart rate range-area charts.
    var minValue: Double?
    /// Per-day maximum — used for heart rate range-area charts.
    var maxValue: Double?
}

// MARK: - WorkoutRow

/// Summary of a single workout session for the workout log list.
struct WorkoutRow: Identifiable, Sendable {
    let id: String
    let date: Date
    let workoutType: String
    let durationMins: Double
    let distanceKm: Double?
    let activeEnergyKcal: Double?

    /// Human-readable duration, e.g. "45m" or "1h 12m".
    var durationLabel: String {
        let total = Int(durationMins.rounded())
        if total < 60 { return "\(total)m" }
        let h = total / 60
        let m = total % 60
        return m > 0 ? "\(h)h \(m)m" : "\(h)h"
    }
}

// MARK: - DashboardSnapshot

/// Most-recent metric values shown in the overview card grid at the top of the dashboard.
struct DashboardSnapshot: Sendable {
    var todaySteps: Double?
    var latestRestingHR: Double?
    var latestRestingHRDate: String?
    var lastSleepMins: Double?
    var lastSleepDate: String?
    var latestWeight: Double?
    var latestWeightDate: String?
}

// MARK: - MetricDetailDestination

/// Navigation destination values pushed onto the `DashboardView` NavigationStack.
enum MetricDetailDestination: Hashable, Sendable {
    case metric(type: String, category: MetricCategory, title: String)
    case workoutLog
}
