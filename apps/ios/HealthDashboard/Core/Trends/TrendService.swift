import Foundation
import SwiftData

/// Computes trend and correlation data from `DailySummary` records stored in SwiftData.
///
/// Actor isolation ensures all SwiftData access happens on a consistent executor.
/// `ModelContainer` (which is `Sendable`) is passed in from the call site so callers
/// on other actors can invoke these methods safely without triggering Swift 6
/// sendability diagnostics.
actor TrendService {
    static let shared = TrendService()
    private init() {}

    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")!
        return f
    }()

    // MARK: - Public API

    /// Computes a `TrendResult` for every metric in `allTrendMetrics()`.
    ///
    /// Each result contains a 30-day sparkline, week-over-week delta,
    /// linear regression slope, and a direction classification.
    func computeAllTrends(container: ModelContainer) throws -> [TrendResult] {
        let context = ModelContext(container)
        return try allTrendMetrics().map { try computeTrend(for: $0, context: context) }
    }

    /// Computes the Pearson cross-correlation between two metrics over the last 90 days.
    ///
    /// Returns a `CorrelationResult` with date-aligned pairs, normalised series,
    /// and the Pearson r (nil when fewer than 7 shared data points exist).
    func computeCorrelation(
        metricA: TrendMetric,
        metricB: TrendMetric,
        container: ModelContainer
    ) throws -> CorrelationResult {
        let context = ModelContext(container)
        let startStr = dateString(daysAgo: 90)

        let seriesA = try fetchValues(
            metricType: metricA.metricType,
            startStr: startStr,
            isAdditive: metricA.isAdditive,
            context: context
        )
        let seriesB = try fetchValues(
            metricType: metricB.metricType,
            startStr: startStr,
            isAdditive: metricB.isAdditive,
            context: context
        )

        let pairs = buildAlignedPairs(seriesA: seriesA, seriesB: seriesB)

        let pearsonR: Double? = pairs.count >= 7 ? pearson(pairs: pairs) : nil
        let strength: CorrelationStrength? = pearsonR.map { r in
            let mag = abs(r)
            if mag >= 0.7 { return .strong }
            if mag >= 0.4 { return .moderate }
            return .weak
        }

        let (normA, normB) = buildNormSeries(
            pairs: pairs,
            metricTypeA: metricA.metricType,
            metricTypeB: metricB.metricType
        )

        return CorrelationResult(
            metricA: metricA,
            metricB: metricB,
            pearsonR: pearsonR,
            strength: strength,
            alignedPairs: pairs,
            normSeriesA: normA,
            normSeriesB: normB
        )
    }

    // MARK: - Private: per-metric trend computation

    private func computeTrend(for metric: TrendMetric, context: ModelContext) throws -> TrendResult {
        let startStr = dateString(daysAgo: 30)
        let values = try fetchValues(
            metricType: metric.metricType,
            startStr: startStr,
            isAdditive: metric.isAdditive,
            context: context
        )

        let sparkline = values.map { date, value -> SparklinePoint in
            SparklinePoint(
                id: "\(metric.metricType):\(Self.isoFormatter.string(from: date))",
                date: date,
                value: value
            )
        }

        let weekDelta = computeWeekDelta(values: values)
        let slope: Double? = sparkline.count >= 4 ? linearRegressionSlope(sparkline) : nil
        let direction = classify(
            weekDelta: weekDelta,
            slope: slope,
            higherIsBetter: metric.higherIsBetter,
            hasSufficientData: sparkline.count >= 4
        )

        return TrendResult(
            metricType: metric.metricType,
            category: metric.category,
            title: metric.title,
            unit: metric.unit,
            sparkline: sparkline,
            latestValue: sparkline.last?.value,
            weekDelta: weekDelta,
            regressionSlope: slope,
            direction: direction
        )
    }

    // MARK: - Private: data fetching

    /// Returns `(Date, value)` pairs sorted ascending by date.
    /// Uses `sum` for additive metrics and `avg` for all others; skips zero-valued rows.
    private func fetchValues(
        metricType: String,
        startStr: String,
        isAdditive: Bool,
        context: ModelContext
    ) throws -> [(Date, Double)] {
        let descriptor = FetchDescriptor<DailySummary>(
            predicate: #Predicate { $0.metricType == metricType && $0.date >= startStr },
            sortBy: [SortDescriptor(\.date)]
        )
        let rows = try context.fetch(descriptor)
        return rows.compactMap { row in
            guard let date = Self.isoFormatter.date(from: row.date) else { return nil }
            let v: Double = isAdditive ? (row.sum ?? 0) : (row.avg ?? 0)
            return v > 0 ? (date, v) : nil
        }
    }

    // MARK: - Private: maths

    /// Week-over-week delta: compares mean of [today−6 … today] with [today−13 … today−7].
    ///
    /// Returns `nil` when either window has no data.
    private func computeWeekDelta(values: [(Date, Double)]) -> Double? {
        guard values.count >= 2 else { return nil }
        let now = Date.now
        let cal = Calendar.current

        let thisWeek = values.filter {
            let diff = cal.dateComponents([.day], from: $0.0, to: now).day ?? Int.max
            return diff >= 0 && diff < 7
        }.map(\.1)

        let lastWeek = values.filter {
            let diff = cal.dateComponents([.day], from: $0.0, to: now).day ?? Int.max
            return diff >= 7 && diff < 14
        }.map(\.1)

        guard !thisWeek.isEmpty, !lastWeek.isEmpty else { return nil }

        let thisAvg = thisWeek.reduce(0, +) / Double(thisWeek.count)
        let lastAvg = lastWeek.reduce(0, +) / Double(lastWeek.count)
        guard lastAvg != 0 else { return nil }

        return ((thisAvg - lastAvg) / lastAvg) * 100
    }

    /// Ordinary-least-squares slope: value units per day index (not per calendar day).
    private func linearRegressionSlope(_ points: [SparklinePoint]) -> Double {
        let n = Double(points.count)
        let xs = (0..<points.count).map { Double($0) }
        let ys = points.map(\.value)
        let xMean = xs.reduce(0, +) / n
        let yMean = ys.reduce(0, +) / n
        let num = zip(xs, ys).map { ($0 - xMean) * ($1 - yMean) }.reduce(0, +)
        let den = xs.map { pow($0 - xMean, 2) }.reduce(0, +)
        return den == 0 ? 0 : num / den
    }

    /// Classifies trend direction using the weekly delta (primary) or slope (fallback).
    ///
    /// - `±2 %` stable threshold for weekly delta.
    /// - Polarity inversion: a rising delta for a `higherIsBetter = false` metric = declining.
    private func classify(
        weekDelta: Double?,
        slope: Double?,
        higherIsBetter: Bool,
        hasSufficientData: Bool
    ) -> TrendDirection {
        guard hasSufficientData else { return .insufficient }

        // Use weekDelta; fall back to slope-projected-over-7-days if weekDelta is nil
        let signalPercent: Double?
        if let d = weekDelta {
            signalPercent = d
        } else if let s = slope {
            // Convert slope (units/day) to a rough %-change using the slope * 7
            // We don't have a mean reference here so just use sign
            signalPercent = s > 0 ? 5 : -5   // Proxy: non-zero slope implies movement
        } else {
            signalPercent = nil
        }

        guard let pct = signalPercent else { return .insufficient }

        let stableThreshold = 2.0
        if abs(pct) < stableThreshold { return .stable }

        let isIncreasing = pct > 0
        return (isIncreasing == higherIsBetter) ? .improving : .declining
    }

    // MARK: - Private: correlation helpers

    /// Aligns two date-keyed value series to their intersection, normalises to [0, 1],
    /// and returns sorted `AlignedPair` array.
    private func buildAlignedPairs(
        seriesA: [(Date, Double)],
        seriesB: [(Date, Double)]
    ) -> [AlignedPair] {
        let dictA = Dictionary(
            seriesA.map { (Self.isoFormatter.string(from: $0.0), $0.1) },
            uniquingKeysWith: { first, _ in first }
        )
        let dictB = Dictionary(
            seriesB.map { (Self.isoFormatter.string(from: $0.0), $0.1) },
            uniquingKeysWith: { first, _ in first }
        )

        let commonDates = Set(dictA.keys).intersection(Set(dictB.keys)).sorted()

        // Compute global min/max for normalisation over the intersection window
        let rawAs = commonDates.compactMap { dictA[$0] }
        let rawBs = commonDates.compactMap { dictB[$0] }
        let minA = rawAs.min() ?? 0, maxA = rawAs.max() ?? 1
        let minB = rawBs.min() ?? 0, maxB = rawBs.max() ?? 1
        let rangeA = maxA > minA ? maxA - minA : 1
        let rangeB = maxB > minB ? maxB - minB : 1

        return commonDates.compactMap { dateStr in
            guard
                let date = Self.isoFormatter.date(from: dateStr),
                let a = dictA[dateStr],
                let b = dictB[dateStr]
            else { return nil }

            return AlignedPair(
                id: dateStr,
                date: date,
                normA: (a - minA) / rangeA,
                normB: (b - minB) / rangeB,
                rawA: a,
                rawB: b
            )
        }
    }

    /// Pearson r for `AlignedPair.rawA` vs `AlignedPair.rawB`.
    private func pearson(pairs: [AlignedPair]) -> Double {
        let n = Double(pairs.count)
        let xs = pairs.map(\.rawA), ys = pairs.map(\.rawB)
        let xMean = xs.reduce(0, +) / n
        let yMean = ys.reduce(0, +) / n
        let num = zip(xs, ys).map { ($0 - xMean) * ($1 - yMean) }.reduce(0, +)
        let denX = sqrt(xs.map { pow($0 - xMean, 2) }.reduce(0, +))
        let denY = sqrt(ys.map { pow($0 - yMean, 2) }.reduce(0, +))
        guard denX * denY > 0 else { return 0 }
        return num / (denX * denY)
    }

    /// Converts `AlignedPair` normalised values into `SparklinePoint` series for the overlay chart.
    private func buildNormSeries(
        pairs: [AlignedPair],
        metricTypeA: String,
        metricTypeB: String
    ) -> ([SparklinePoint], [SparklinePoint]) {
        let normA = pairs.map { p in
            SparklinePoint(id: "\(metricTypeA):\(p.id)", date: p.date, value: p.normA)
        }
        let normB = pairs.map { p in
            SparklinePoint(id: "\(metricTypeB):\(p.id)", date: p.date, value: p.normB)
        }
        return (normA, normB)
    }

    // MARK: - Private: date helpers

    private func dateString(daysAgo: Int) -> String {
        let date = Calendar.current.date(byAdding: .day, value: -daysAgo, to: .now) ?? .now
        return Self.isoFormatter.string(from: date)
    }
}
