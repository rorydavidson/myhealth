import SwiftUI
import Charts
import SwiftData

// MARK: - MetricDetailView

/// Full-screen metric detail: a taller chart with tooltip, all date-range options,
/// a stats summary row, and an accessible data table.
///
/// Loads its own data from SwiftData using `@Environment(\.modelContext)`.
struct MetricDetailView: View {
    let metricType: String
    let category: MetricCategory
    let title: String

    @Environment(\.modelContext) private var modelContext
    @State private var selectedRange: DateRange = .month
    @State private var chartData: [ChartDataPoint] = []
    @State private var allTimeData: [ChartDataPoint] = []
    @State private var isLoading = true
    @State private var selectedDate: Date? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                // Date range picker
                dateRangePicker

                // Large chart
                chartSection

                // Stats summary
                if !chartData.isEmpty {
                    statsSection
                }

                // Data table (accessible alternative)
                if !chartData.isEmpty {
                    dataTableSection
                }
            }
            .padding(DesignTokens.Spacing.md)
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .background(Color(.systemGroupedBackground))
        .task { await loadData() }
        .onChange(of: selectedRange) { _, _ in
            Task { await loadData() }
        }
    }

    // MARK: - Date range picker

    private var dateRangePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                ForEach(DateRange.allCases) { range in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedRange = range
                        }
                    } label: {
                        Text(range.rawValue)
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                selectedRange == range
                                    ? category.color
                                    : Color.secondary.opacity(0.12)
                            )
                            .foregroundStyle(selectedRange == range ? .white : .primary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Chart section

    @ViewBuilder
    private var chartSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if isLoading {
                ChartCardSkeleton(height: 260)
            } else if chartData.isEmpty {
                EmptyStateView(
                    icon: category.primaryIcon,
                    title: String(localized: "dashboard.chart.noData"),
                    message: String(localized: "dashboard.detail.noData.message"),
                    category: category
                )
                .frame(height: 260)
            } else {
                detailChart
                    .transition(.opacity.animation(.easeInOut(duration: 0.3)))
            }
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
        .padding(.bottom, DesignTokens.Spacing.xs)
    }

    /// Large chart (260 pt) with iOS 17 chartXSelection tooltip.
    private var detailChart: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tooltip callout (visible when a point is selected)
            if let date = selectedDate, let point = nearestPoint(to: date) {
                tooltipCallout(for: point)
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.top, DesignTokens.Spacing.sm)
                    .transition(.opacity.animation(.easeInOut(duration: 0.15)))
            } else {
                // Reserve space so chart doesn't jump
                Color.clear.frame(height: 44)
            }

            metricChart(data: chartData, range: selectedRange, height: 220)
                .chartXSelection(value: $selectedDate)
                .padding(.horizontal, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.sm)
        }
    }

    private func tooltipCallout(for point: ChartDataPoint) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                Text(point.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(formatValue(point.value))
                    .font(.title3.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(category.color)
            }
            Spacer()
            Image(systemName: category.primaryIcon)
                .font(.title3)
                .foregroundStyle(category.color.opacity(0.6))
        }
        .padding(DesignTokens.Spacing.sm)
        .background(category.color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))
    }

    // MARK: - Stats section

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(String(localized: "dashboard.detail.stats.title"))
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, DesignTokens.Spacing.xs)

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())],
                spacing: DesignTokens.Spacing.sm
            ) {
                statCard(
                    label: String(localized: "dashboard.detail.stats.current"),
                    value: formatValue(chartData.last?.value ?? 0)
                )
                statCard(
                    label: String(localized: "dashboard.detail.stats.avg"),
                    value: formatValue(average(of: chartData))
                )
                statCard(
                    label: String(localized: "dashboard.detail.stats.allTimeMin"),
                    value: formatValue(allTimeData.map(\.value).min() ?? 0)
                )
            }
            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())],
                spacing: DesignTokens.Spacing.sm
            ) {
                statCard(
                    label: String(localized: "dashboard.detail.stats.allTimeMax"),
                    value: formatValue(allTimeData.map(\.value).max() ?? 0)
                )
                statCard(
                    label: String(localized: "dashboard.detail.stats.days"),
                    value: "\(chartData.count)"
                )
                Color.clear  // spacer for grid alignment
            }
        }
    }

    private func statCard(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(.primary)
                .minimumScaleFactor(0.7)
        }
        .padding(DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.button)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
    }

    // MARK: - Data table (accessible alternative)

    private var dataTableSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(String(localized: "dashboard.detail.table.title"))
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, DesignTokens.Spacing.xs)

            VStack(spacing: 0) {
                // Header
                HStack {
                    Text(String(localized: "chart.axis.date"))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, DesignTokens.Spacing.md)
                .padding(.vertical, DesignTokens.Spacing.xs)
                .background(Color.secondary.opacity(0.06))

                Divider()

                // Rows — most recent first
                ForEach(chartData.reversed()) { point in
                    HStack {
                        Text(point.date.formatted(date: .abbreviated, time: .omitted))
                            .font(.footnote)
                            .foregroundStyle(.primary)
                        Spacer()
                        Text(formatValue(point.value))
                            .font(.footnote.weight(.medium))
                            .monospacedDigit()
                            .foregroundStyle(.primary)
                    }
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.vertical, DesignTokens.Spacing.xs)

                    if point.id != chartData.first?.id {
                        Divider().padding(.leading, DesignTokens.Spacing.md)
                    }
                }
            }
            .background(.background)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                    .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
        }
    }

    // MARK: - Metric-type dispatch

    /// Returns the correct chart view for the current `metricType`.
    @ViewBuilder
    private func metricChart(data: [ChartDataPoint], range: DateRange, height: CGFloat) -> some View {
        switch metricType {
        case "step_count":
            StepsBarChart(data: data, range: range, height: height)
        case "distance":
            DistanceBarChart(data: data, range: range, height: height)
        case "active_energy":
            ActiveEnergyBarChart(data: data, range: range, height: height)
        case "flights_climbed":
            StepsBarChart(data: data, range: range, height: height)  // same style
        case "heart_rate":
            HeartRateRangeChart(data: data, range: range, height: height)
        case "resting_heart_rate":
            RestingHRLineChart(data: data, range: range, height: height)
        case "hrv":
            HRVLineChart(data: data, range: range, height: height)
        case "sleep_session":
            SleepDurationBarChart(data: data, range: range, height: height)
        case "body_mass":
            WeightLineChart(data: data, range: range, height: height)
        case "body_fat":
            BodyFatLineChart(data: data, range: range, height: height)
        case "oxygen_saturation":
            SpO2LineChart(data: data, range: range, height: height)
        case "respiratory_rate":
            RespiratoryRateLineChart(data: data, range: range, height: height)
        default:
            RestingHRLineChart(data: data, range: range, height: height)
        }
    }

    // MARK: - Data loading

    private func loadData() async {
        isLoading = true
        let container = modelContext.container
        let metricType = self.metricType
        let startStr   = selectedRange.startDateString

        // All-time start for global stats
        let allTimeStart = DateRange.all.startDateString

        let isAdditive = ["step_count", "distance", "active_energy", "flights_climbed"].contains(metricType)

        let (rangeData, allData) = await Task.detached(priority: .userInitiated) {
            // DateFormatter must be created inside the task — it is not Sendable
            let fmt = DateFormatter()
            fmt.dateFormat = "yyyy-MM-dd"
            fmt.timeZone = TimeZone(identifier: "UTC")!

            let ctx = ModelContext(container)
            func fetch(_ start: String) -> [ChartDataPoint] {
                let desc = FetchDescriptor<DailySummary>(
                    predicate: #Predicate { $0.metricType == metricType && $0.date >= start },
                    sortBy: [SortDescriptor(\.date)]
                )
                guard let summaries = try? ctx.fetch(desc) else { return [] }
                return summaries.compactMap { s in
                    guard let date = fmt.date(from: s.date) else { return nil }
                    if metricType == "heart_rate" {
                        guard let avg = s.avg else { return nil }
                        return ChartDataPoint(id: s.id, date: date, value: avg, minValue: s.min, maxValue: s.max)
                    }
                    let value: Double = isAdditive ? (s.sum ?? 0) : (s.avg ?? 0)
                    guard value > 0 else { return nil }
                    return ChartDataPoint(id: s.id, date: date, value: value)
                }
            }
            return (fetch(startStr), fetch(allTimeStart))
        }.value

        await MainActor.run {
            self.chartData   = rangeData
            self.allTimeData = allData
            withAnimation(.easeInOut(duration: 0.3)) {
                self.isLoading = false
            }
        }
    }

    // MARK: - Helpers

    private func nearestPoint(to date: Date) -> ChartDataPoint? {
        chartData.min(by: { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) })
    }

    private func average(of data: [ChartDataPoint]) -> Double {
        guard !data.isEmpty else { return 0 }
        return data.map(\.value).reduce(0, +) / Double(data.count)
    }

    /// Formats the raw value for display with appropriate unit suffix.
    private func formatValue(_ value: Double) -> String {
        switch metricType {
        case "step_count", "flights_climbed":
            return value >= 1_000
                ? String(format: "%.1fK", value / 1_000)
                : String(format: "%.0f", value)
        case "distance":
            return String(format: "%.1f km", value / 1_000)
        case "active_energy":
            return String(format: "%.0f kcal", value)
        case "heart_rate", "resting_heart_rate":
            return String(format: "%.0f bpm", value)
        case "hrv":
            return String(format: "%.0f ms", value)
        case "sleep_session":
            let h = Int(value / 60)
            let m = Int(value.truncatingRemainder(dividingBy: 60))
            return m > 0 ? "\(h)h \(m)m" : "\(h)h"
        case "body_mass":
            return String(format: "%.1f kg", value)
        case "body_fat":
            return String(format: "%.1f%%", value)
        case "oxygen_saturation":
            return String(format: "%.1f%%", value)
        case "respiratory_rate":
            return String(format: "%.0f br/m", value)
        default:
            return String(format: "%.1f", value)
        }
    }
}
