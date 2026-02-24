import SwiftUI
import Charts

// MARK: - HeartSection

/// Dashboard section showing Heart charts: Heart Rate (range), Resting HR, HRV.
@MainActor
struct HeartSection: View {
    let viewModel: DashboardViewModel
    let onNavigate: (MetricDetailDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(
                title: MetricCategory.heart.displayName,
                category: .heart
            )

            ChartCard(
                title: String(localized: "dashboard.metric.heartRate"),
                category: .heart,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.heartRateData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "heart_rate", category: .heart, title: String(localized: "dashboard.metric.heartRate"))) }
            ) {
                HeartRateRangeChart(data: viewModel.heartRateData, range: viewModel.selectedRange)
            }

            ChartCard(
                title: String(localized: "dashboard.metric.restingHR"),
                category: .heart,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.restingHRData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "resting_heart_rate", category: .heart, title: String(localized: "dashboard.metric.restingHR"))) }
            ) {
                RestingHRLineChart(data: viewModel.restingHRData, range: viewModel.selectedRange)
            }

            ChartCard(
                title: String(localized: "dashboard.metric.hrv"),
                category: .heart,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.hrvData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "hrv", category: .heart, title: String(localized: "dashboard.metric.hrv"))) }
            ) {
                HRVLineChart(data: viewModel.hrvData, range: viewModel.selectedRange)
            }
        }
    }
}

// MARK: - HeartRateRangeChart

/// Line chart for daily average heart rate with a translucent min/max range band.
struct HeartRateRangeChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    private let color = MetricCategory.heart.color

    var body: some View {
        Chart(data) { point in
            // Range band (min–max)
            if let lo = point.minValue, let hi = point.maxValue {
                AreaMark(
                    x: .value(String(localized: "chart.axis.date"), point.date),
                    yStart: .value(String(localized: "chart.axis.min"), lo),
                    yEnd:   .value(String(localized: "chart.axis.max"), hi)
                )
                .foregroundStyle(color.opacity(0.12))
                .interpolationMethod(.catmullRom)
            }
            // Average line
            LineMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.heartRate"), point.value)
            )
            .foregroundStyle(color)
            .lineStyle(StrokeStyle(lineWidth: 2))
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { countAxis(unit: "bpm") }
        .frame(height: height)
    }
}

// MARK: - RestingHRLineChart

/// Line + area chart for daily resting heart rate.
struct RestingHRLineChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    private let color = MetricCategory.heart.color

    var body: some View {
        Chart(data) { point in
            AreaMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.restingHR"), point.value)
            )
            .foregroundStyle(color.chartGradient())
            .interpolationMethod(.catmullRom)

            LineMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.restingHR"), point.value)
            )
            .foregroundStyle(color)
            .lineStyle(StrokeStyle(lineWidth: 2))
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { countAxis(unit: "bpm") }
        .frame(height: height)
    }
}

// MARK: - HRVLineChart

/// Line + area chart for daily heart rate variability (HRV SDNN in ms).
struct HRVLineChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    private let color = MetricCategory.heart.color

    var body: some View {
        Chart(data) { point in
            AreaMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.hrv"), point.value)
            )
            .foregroundStyle(color.chartGradient())
            .interpolationMethod(.catmullRom)

            LineMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.hrv"), point.value)
            )
            .foregroundStyle(color)
            .lineStyle(StrokeStyle(lineWidth: 2))
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { countAxis(unit: "ms") }
        .frame(height: height)
    }
}

// MARK: - Preview

#Preview {
    let now = Date.now
    let cal = Calendar.current
    let data: [ChartDataPoint] = (0..<14).map { i in
        let d = cal.date(byAdding: .day, value: -i, to: now)!
        let avg = Double.random(in: 60...85)
        return ChartDataPoint(id: "hr:\(i)", date: d, value: avg, minValue: avg - 10, maxValue: avg + 15)
    }.reversed()

    return ScrollView {
        VStack(spacing: 16) {
            HeartRateRangeChart(data: data, range: .month)
            RestingHRLineChart(data: data, range: .month)
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
