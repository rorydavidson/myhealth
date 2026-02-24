import Foundation
import SwiftData
import SwiftUI
import Observation

/// Main-actor view model for the Dashboard screen.
///
/// Reads `DailySummary` and `HealthRecord` data from SwiftData, computes snapshot
/// values for the overview grid, and builds time-series `[ChartDataPoint]` arrays
/// for each metric category according to the selected date range.
///
/// Data loading is synchronous on the main actor — daily summary records are few
/// in number and fetching them from SwiftData takes well under 1 ms in typical datasets.
/// `Task.yield()` is inserted before the fetch so the skeleton UI can render first.
@Observable
@MainActor
final class DashboardViewModel {

    // MARK: - Input

    /// Currently selected date range; changing it triggers an automatic reload.
    var selectedRange: DateRange = .week {
        didSet { guard oldValue != selectedRange else { return }; reload() }
    }

    // MARK: - Loading state

    var isLoading: Bool = false

    // MARK: - Snapshot (overview grid)

    var snapshot = DashboardSnapshot()

    // MARK: - Activity charts

    var stepData:         [ChartDataPoint] = []
    var distanceData:     [ChartDataPoint] = []
    var activeEnergyData: [ChartDataPoint] = []
    var flightsData:      [ChartDataPoint] = []

    // MARK: - Heart charts

    /// Daily average heart rate with optional per-day min/max for range visualisation.
    var heartRateData: [ChartDataPoint] = []
    var restingHRData: [ChartDataPoint] = []
    var hrvData:       [ChartDataPoint] = []

    // MARK: - Sleep charts

    /// Total sleep minutes per night (sum of all sleep stage durations).
    var sleepData: [ChartDataPoint] = []

    // MARK: - Body charts

    var weightData:  [ChartDataPoint] = []
    var bodyFatData: [ChartDataPoint] = []

    // MARK: - Vitals charts

    var spo2Data:              [ChartDataPoint] = []
    var respiratoryRateData:   [ChartDataPoint] = []

    // MARK: - Workout log

    var workoutRows: [WorkoutRow] = []

    // MARK: - Private

    private let container: ModelContainer

    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")!
        return f
    }()

    // MARK: - Init

    init(container: ModelContainer) {
        self.container = container
    }

    // MARK: - Public entry points

    /// Fetches all data for the current `selectedRange`.
    /// Shows skeleton immediately, then performs the fetch and animates the charts in.
    func load() {
        isLoading = true
        Task { @MainActor [weak self] in
            guard let self else { return }
            await Task.yield()          // let UI render skeleton before blocking
            self.fetchAll()
            withAnimation(.easeInOut(duration: 0.3)) {
                self.isLoading = false
            }
        }
    }

    // MARK: - Private: orchestration

    private func reload() { load() }

    private func fetchAll() {
        let context   = ModelContext(container)
        let startStr  = selectedRange.startDateString
        let todayStr  = Self.isoFormatter.string(from: .now)

        do {
            snapshot            = try loadSnapshot(context: context, todayStr: todayStr)

            stepData            = try fetchSummaries("step_count",         additive: true,  startStr: startStr, context: context)
            distanceData        = try fetchSummaries("distance",           additive: true,  startStr: startStr, context: context)
            activeEnergyData    = try fetchSummaries("active_energy",      additive: true,  startStr: startStr, context: context)
            flightsData         = try fetchSummaries("flights_climbed",    additive: true,  startStr: startStr, context: context)

            heartRateData       = try fetchHeartRateRange(startStr: startStr, context: context)
            restingHRData       = try fetchSummaries("resting_heart_rate", additive: false, startStr: startStr, context: context)
            hrvData             = try fetchSummaries("hrv",                additive: false, startStr: startStr, context: context)

            sleepData           = try fetchSummaries("sleep_session",      additive: true,  startStr: startStr, context: context)

            weightData          = try fetchSummaries("body_mass",          additive: false, startStr: startStr, context: context)
            bodyFatData         = try fetchSummaries("body_fat",           additive: false, startStr: startStr, context: context)

            spo2Data            = try fetchSummaries("oxygen_saturation",  additive: false, startStr: startStr, context: context)
            respiratoryRateData = try fetchSummaries("respiratory_rate",   additive: false, startStr: startStr, context: context)

            workoutRows         = try fetchWorkouts(startDate: selectedRange.startDate, context: context)

        } catch {
            // Silently swallow fetch errors — empty state in each card handles nil data
        }
    }

    // MARK: - Snapshot

    private func loadSnapshot(context: ModelContext, todayStr: String) throws -> DashboardSnapshot {
        var snap = DashboardSnapshot()

        snap.todaySteps          = try fetchDisplayValue("step_count",         preferDate: todayStr, context: context)
        snap.latestRestingHR     = try fetchDisplayValue("resting_heart_rate", preferDate: todayStr, context: context)
        snap.latestRestingHRDate = try fetchMostRecentDate("resting_heart_rate", context: context)
        snap.lastSleepMins       = try fetchDisplayValue("sleep_session",      preferDate: todayStr, context: context)
        snap.lastSleepDate       = try fetchMostRecentDate("sleep_session",    context: context)
        snap.latestWeight        = try fetchDisplayValue("body_mass",          preferDate: todayStr, context: context)
        snap.latestWeightDate    = try fetchMostRecentDate("body_mass",        context: context)

        return snap
    }

    // MARK: - Low-level helpers

    /// Returns the `displayValue` for `metricType` on `preferDate`, falling back to the most recent.
    private func fetchDisplayValue(_ metricType: String, preferDate: String, context: ModelContext) throws -> Double? {
        var todayDesc = FetchDescriptor<DailySummary>(
            predicate: #Predicate { $0.metricType == metricType && $0.date == preferDate }
        )
        todayDesc.fetchLimit = 1
        if let summary = try context.fetch(todayDesc).first {
            return summary.displayValue
        }
        // Fall back to most recent
        var recentDesc = FetchDescriptor<DailySummary>(
            predicate: #Predicate { $0.metricType == metricType },
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )
        recentDesc.fetchLimit = 1
        return try context.fetch(recentDesc).first?.displayValue
    }

    /// Returns the `date` string of the most recent `DailySummary` for `metricType`.
    private func fetchMostRecentDate(_ metricType: String, context: ModelContext) throws -> String? {
        var desc = FetchDescriptor<DailySummary>(
            predicate: #Predicate { $0.metricType == metricType },
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )
        desc.fetchLimit = 1
        return try context.fetch(desc).first?.date
    }

    /// Converts `DailySummary` records for one metric into `ChartDataPoint` values within the range.
    private func fetchSummaries(
        _ metricType: String,
        additive: Bool,
        startStr: String,
        context: ModelContext
    ) throws -> [ChartDataPoint] {
        let descriptor = FetchDescriptor<DailySummary>(
            predicate: #Predicate { $0.metricType == metricType && $0.date >= startStr },
            sortBy: [SortDescriptor(\.date)]
        )
        let summaries = try context.fetch(descriptor)
        return summaries.compactMap { s in
            guard let date = Self.isoFormatter.date(from: s.date) else { return nil }
            let value: Double = additive ? (s.sum ?? 0) : (s.avg ?? 0)
            guard value > 0 else { return nil }
            return ChartDataPoint(id: s.id, date: date, value: value)
        }
    }

    /// Fetches heart rate summaries with per-day `min` and `max` for range-area charts.
    private func fetchHeartRateRange(startStr: String, context: ModelContext) throws -> [ChartDataPoint] {
        let descriptor = FetchDescriptor<DailySummary>(
            predicate: #Predicate { $0.metricType == "heart_rate" && $0.date >= startStr },
            sortBy: [SortDescriptor(\.date)]
        )
        let summaries = try context.fetch(descriptor)
        return summaries.compactMap { s in
            guard
                let date = Self.isoFormatter.date(from: s.date),
                let avg  = s.avg
            else { return nil }
            return ChartDataPoint(id: s.id, date: date, value: avg, minValue: s.min, maxValue: s.max)
        }
    }

    /// Fetches workout `HealthRecord`s and maps them to `WorkoutRow` value types.
    private func fetchWorkouts(startDate: Date, context: ModelContext) throws -> [WorkoutRow] {
        var descriptor = FetchDescriptor<HealthRecord>(
            predicate: #Predicate { $0.metricType == "workout" && $0.startTime >= startDate },
            sortBy: [SortDescriptor(\.startTime, order: .reverse)]
        )
        descriptor.fetchLimit = 100
        let records = try context.fetch(descriptor)
        return records.compactMap { record in
            guard let meta = record.decodeMetadata(as: WorkoutMetadata.self) else { return nil }
            return WorkoutRow(
                id: record.id,
                date: record.startTime,
                workoutType: formatWorkoutType(meta.workoutType),
                durationMins: meta.durationSeconds / 60.0,
                distanceKm: meta.distanceMeters.map { $0 / 1_000.0 },
                activeEnergyKcal: meta.activeEnergyKcal
            )
        }
    }

    /// Strips HealthKit prefixes and converts camelCase to a display name.
    /// e.g. `"HKWorkoutActivityTypeRunning"` → `"Running"`
    private func formatWorkoutType(_ raw: String) -> String {
        var name = raw
        for prefix in ["HKWorkoutActivityType", "com.apple.health."] {
            if name.hasPrefix(prefix) { name = String(name.dropFirst(prefix.count)) }
        }
        // camelCase → space-separated words
        var result = ""
        for ch in name {
            if ch.isUppercase, !result.isEmpty { result += " " }
            result.append(ch)
        }
        return result.isEmpty ? raw : result
    }
}
