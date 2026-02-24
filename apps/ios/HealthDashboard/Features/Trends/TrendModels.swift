import Foundation

// MARK: - TrendDirection

/// Direction of a metric's trend over the most recent period,
/// already accounting for metric polarity (e.g. resting HR falling = improving).
enum TrendDirection: String, Sendable {
    case improving
    case declining
    case stable
    case insufficient   // < 4 days of data; cannot determine direction
}

// MARK: - SparklinePoint

/// A single (date, value) pair for the 30-day sparkline chart.
/// Sendable so it can be safely passed across actor boundaries.
struct SparklinePoint: Identifiable, Sendable {
    /// Composite key: `{metricType}:{YYYY-MM-DD}`
    let id: String
    let date: Date
    let value: Double
}

// MARK: - TrendResult

/// Computed trend data for a single metric over a 30-day window.
struct TrendResult: Identifiable, Sendable {
    let metricType: String
    let category: MetricCategory
    let title: String
    let unit: String

    /// Last 30 days of data, sorted ascending by date.
    let sparkline: [SparklinePoint]

    /// Most-recent value (last day in the sparkline window).
    let latestValue: Double?

    /// Percentage change: (mean of past 7 days − mean of prior 7 days) / prior 7-day mean × 100.
    /// Positive = metric went up; negative = metric went down.
    let weekDelta: Double?

    /// Ordinary-least-squares slope (units/day) over the sparkline window.
    let regressionSlope: Double?

    /// Semantic direction, accounting for metric polarity (higherIsBetter).
    let direction: TrendDirection

    var id: String { metricType }

    /// `true` when |weekDelta| > 10 % — used to draw an amber attention border on the TrendCard.
    var isSignificant: Bool {
        guard let d = weekDelta else { return false }
        return abs(d) > 10
    }
}

// MARK: - TrendMetric

/// Static metadata describing a trackable metric on the Trends screen.
struct TrendMetric: Identifiable, Hashable, Sendable {
    let metricType: String
    let category: MetricCategory
    let title: String
    let unit: String

    var id: String { metricType }

    /// `true` when a higher value represents a better outcome (e.g. steps, HRV, sleep duration).
    /// `false` when lower is better (e.g. resting heart rate, respiratory rate).
    let higherIsBetter: Bool

    /// Additive metrics (steps, distance, calories, flights, sleep) sum their daily values;
    /// all other metrics use daily average.
    let isAdditive: Bool
}

// MARK: - All trend metrics — free function keeps String(localized:) fresh on every call

/// Returns metadata for every metric shown on the Trends screen, in category order.
///
/// Declared as a free function rather than a `static let` so that `String(localized:)`
/// calls are evaluated against the current locale on every invocation instead of
/// being captured once at first access.
func allTrendMetrics() -> [TrendMetric] {
    [
        // Activity
        TrendMetric(metricType: "step_count",        category: .activity, title: String(localized: "dashboard.metric.steps"),          unit: String(localized: "unit.steps"),   higherIsBetter: true,  isAdditive: true),
        TrendMetric(metricType: "distance",          category: .activity, title: String(localized: "dashboard.metric.distance"),        unit: "km",                              higherIsBetter: true,  isAdditive: true),
        TrendMetric(metricType: "active_energy",     category: .activity, title: String(localized: "dashboard.metric.activeEnergy"),    unit: String(localized: "unit.kcal"),    higherIsBetter: true,  isAdditive: true),
        TrendMetric(metricType: "flights_climbed",   category: .activity, title: String(localized: "dashboard.metric.flightsClimbed"), unit: String(localized: "unit.flights"), higherIsBetter: true,  isAdditive: true),
        // Heart
        TrendMetric(metricType: "heart_rate",        category: .heart,    title: String(localized: "dashboard.metric.heartRate"),       unit: String(localized: "unit.bpm"),     higherIsBetter: false, isAdditive: false),
        TrendMetric(metricType: "resting_heart_rate",category: .heart,    title: String(localized: "dashboard.metric.restingHeartRate"),unit: String(localized: "unit.bpm"),     higherIsBetter: false, isAdditive: false),
        TrendMetric(metricType: "hrv",               category: .heart,    title: String(localized: "dashboard.metric.hrv"),             unit: "ms",                              higherIsBetter: true,  isAdditive: false),
        // Sleep
        TrendMetric(metricType: "sleep_session",     category: .sleep,    title: String(localized: "dashboard.metric.sleep"),           unit: "min",                             higherIsBetter: true,  isAdditive: true),
        // Body
        TrendMetric(metricType: "body_mass",         category: .body,     title: String(localized: "dashboard.metric.weight"),          unit: String(localized: "unit.kg"),      higherIsBetter: false, isAdditive: false),
        TrendMetric(metricType: "body_fat",          category: .body,     title: String(localized: "dashboard.metric.bodyFat"),         unit: "%",                               higherIsBetter: false, isAdditive: false),
        // Vitals
        TrendMetric(metricType: "oxygen_saturation", category: .vitals,   title: String(localized: "dashboard.metric.bloodOxygen"),     unit: "%",                               higherIsBetter: true,  isAdditive: false),
        TrendMetric(metricType: "respiratory_rate",  category: .vitals,   title: String(localized: "dashboard.metric.respiratoryRate"), unit: "brpm",                            higherIsBetter: false, isAdditive: false),
    ]
}

// MARK: - CorrelationStrength

/// Bucketed strength label derived from |Pearson r|.
enum CorrelationStrength: String, Sendable {
    case strong     // |r| ≥ 0.7
    case moderate   // 0.4 ≤ |r| < 0.7
    case weak       // |r| < 0.4
}

// MARK: - AlignedPair

/// A single date-aligned pair of real and normalised (0–1) values for two metrics.
///
/// Named struct instead of tuple so Sendable conformance is synthesised automatically
/// and the type can safely cross actor boundaries.
struct AlignedPair: Identifiable, Sendable {
    /// ISO date string, e.g. `"2026-01-15"` — unique within a correlation result.
    let id: String
    let date: Date
    /// Metric A value, normalised to [0, 1] within the 90-day window.
    let normA: Double
    /// Metric B value, normalised to [0, 1] within the 90-day window.
    let normB: Double
    /// Real (un-normalised) value for metric A.
    let rawA: Double
    /// Real (un-normalised) value for metric B.
    let rawB: Double
}

// MARK: - CorrelationResult

/// Full correlation computation result for a pair of metrics over 90 days.
struct CorrelationResult: Sendable {
    let metricA: TrendMetric
    let metricB: TrendMetric

    /// Pearson r, or `nil` when fewer than 7 date-aligned pairs exist.
    let pearsonR: Double?

    /// Semantic strength bucket, or `nil` when `pearsonR` is `nil`.
    let strength: CorrelationStrength?

    /// Date-aligned pairs sorted ascending. Used for both overlay chart and scatter plot.
    let alignedPairs: [AlignedPair]

    /// Min-max normalised [0–1] series for metric A, one point per aligned date.
    let normSeriesA: [SparklinePoint]

    /// Min-max normalised [0–1] series for metric B, one point per aligned date.
    let normSeriesB: [SparklinePoint]
}
