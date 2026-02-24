import Foundation
import SwiftData

/// Computes and upserts `DailySummary` records from `HealthRecord` data.
///
/// Public methods accept a `ModelContainer` (which is `Sendable`) so they can be
/// called safely from other actors. Each method creates its own `ModelContext`
/// on the `AggregationService` executor — no context is ever sent across actor boundaries.
///
/// Mirrors the Phase 1 aggregation logic in `web/src/services/aggregate.ts`.
actor AggregationService {
    static let shared = AggregationService()
    private init() {}

    /// Metrics whose daily value is a sum (additive), not an average.
    private let additiveMetrics: Set<String> = [
        "step_count", "distance", "active_energy", "flights_climbed",
    ]

    private static let utcCalendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }()

    private static let dateFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = TimeZone(identifier: "UTC")!
        return fmt
    }()

    // MARK: - Full recompute

    /// Recomputes ALL daily summaries from scratch.
    /// Called once after the initial 5-year HealthKit load completes.
    ///
    /// Creates its own `ModelContext` so the container can be passed across actor
    /// boundaries without triggering Swift 6 sendability diagnostics.
    func recomputeAll(in container: ModelContainer) throws {
        let context = ModelContext(container)

        let descriptor = FetchDescriptor<HealthRecord>(
            sortBy: [SortDescriptor(\.startTime)]
        )
        let allRecords = try context.fetch(descriptor)

        // Group by (metricType, date) in a single pass
        var buckets: [AffectedDay: [HealthRecord]] = [:]
        for record in allRecords {
            let dateStr = Self.dateFormatter.string(from: record.startTime)
            let key = AffectedDay(metricType: record.metricType, date: dateStr)
            buckets[key, default: []].append(record)
        }

        for (day, records) in buckets {
            let summary = buildSummary(from: records, metricType: day.metricType, date: day.date)
            try upsertSummary(summary, in: context)
        }

        try context.save()
    }

    // MARK: - Incremental recompute

    /// Recomputes daily summaries for only the given (metricType, date) pairs.
    /// The incremental path — called after each observer-query update so that
    /// only the affected days are touched.
    ///
    /// Creates its own `ModelContext` so the container can be passed across actor
    /// boundaries without triggering Swift 6 sendability diagnostics.
    func recompute(
        affectedDays: [(metricType: String, date: String)],
        in container: ModelContainer
    ) throws {
        let context = ModelContext(container)

        let unique = Set(
            affectedDays.map { AffectedDay(metricType: $0.metricType, date: $0.date) }
        )
        for day in unique {
            try recomputeDay(metricType: day.metricType, date: day.date, in: context)
        }

        try context.save()
    }

    // MARK: - Private helpers

    private func recomputeDay(metricType: String, date: String, in context: ModelContext) throws {
        let records = try fetchRecords(metricType: metricType, date: date, in: context)
        let summary = buildSummary(from: records, metricType: metricType, date: date)
        try upsertSummary(summary, in: context)
    }

    private func fetchRecords(
        metricType: String,
        date: String,
        in context: ModelContext
    ) throws -> [HealthRecord] {
        guard
            let dayStart = Self.dateFormatter.date(from: date),
            let dayEnd = Self.utcCalendar.date(byAdding: .day, value: 1, to: dayStart)
        else { return [] }

        let descriptor = FetchDescriptor<HealthRecord>(
            predicate: #Predicate<HealthRecord> {
                $0.metricType == metricType
                    && $0.startTime >= dayStart
                    && $0.startTime < dayEnd
            }
        )
        return try context.fetch(descriptor)
    }

    /// Upserts a `DailySummary`: deletes the existing row for the same id, then inserts fresh.
    /// Swift Data has no native upsert, so delete+insert is the standard approach.
    private func upsertSummary(_ summary: DailySummary, in context: ModelContext) throws {
        let id = summary.id
        var existing = FetchDescriptor<DailySummary>(
            predicate: #Predicate { $0.id == id }
        )
        existing.fetchLimit = 1
        if let old = try context.fetch(existing).first {
            context.delete(old)
        }
        context.insert(summary)
    }

    private func buildSummary(
        from records: [HealthRecord],
        metricType: String,
        date: String
    ) -> DailySummary {
        guard !records.isEmpty else {
            return DailySummary(metricType: metricType, date: date, count: 0)
        }
        let values = records.compactMap(\.value)
        guard !values.isEmpty else {
            return DailySummary(metricType: metricType, date: date, count: records.count)
        }
        let total = values.reduce(0, +)
        let isAdditive = additiveMetrics.contains(metricType)
        return DailySummary(
            metricType: metricType,
            date: date,
            avg: total / Double(values.count),
            min: values.min(),
            max: values.max(),
            sum: isAdditive ? total : nil,
            count: records.count
        )
    }
}

// MARK: - AffectedDay (private key type)

private struct AffectedDay: Hashable {
    let metricType: String
    let date: String
}
