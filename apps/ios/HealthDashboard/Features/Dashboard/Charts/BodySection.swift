import SwiftUI
import Charts

// MARK: - BodySection

/// Dashboard section showing Body charts: Weight and Body Fat percentage.
@MainActor
struct BodySection: View {
    let viewModel: DashboardViewModel
    let onNavigate: (MetricDetailDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(
                title: MetricCategory.body.displayName,
                category: .body
            )

            ChartCard(
                title: String(localized: "dashboard.metric.weight"),
                category: .body,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.weightData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "body_mass", category: .body, title: String(localized: "dashboard.metric.weight"))) }
            ) {
                WeightLineChart(data: viewModel.weightData, range: viewModel.selectedRange)
            }

            if !viewModel.bodyFatData.isEmpty || viewModel.isLoading {
                ChartCard(
                    title: String(localized: "dashboard.metric.bodyFat"),
                    category: .body,
                    isLoading: viewModel.isLoading,
                    isEmpty: viewModel.bodyFatData.isEmpty,
                    onDetailTap: { onNavigate(.metric(type: "body_fat", category: .body, title: String(localized: "dashboard.metric.bodyFat"))) }
                ) {
                    BodyFatLineChart(data: viewModel.bodyFatData, range: viewModel.selectedRange)
                }
            }
        }
    }
}

// MARK: - WeightLineChart

/// Line + area chart for daily body weight in kg (or lb when using imperial units).
struct WeightLineChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    private let color = MetricCategory.body.color

    var body: some View {
        Chart(data) { point in
            AreaMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.weight"), point.value)
            )
            .foregroundStyle(color.chartGradient())
            .interpolationMethod(.catmullRom)

            LineMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.weight"), point.value)
            )
            .foregroundStyle(color)
            .lineStyle(StrokeStyle(lineWidth: 2))
            .interpolationMethod(.catmullRom)

            PointMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.weight"), point.value)
            )
            .foregroundStyle(color)
            .symbolSize(24)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { weightYAxis }
        .frame(height: height)
    }

    /// Tight Y axis that zooms to the data range (± 2 kg margin).
    private var weightYAxis: some AxisContent {
        // Use automatic ticks — Swift Charts zooms to the data range naturally.
        // Avoids divide-by-zero if all values are identical.
        return AxisMarks(position: .leading) { value in
            AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                .foregroundStyle(Color.secondary.opacity(0.2))
            AxisValueLabel {
                if let v = value.as(Double.self) {
                    Text(String(format: "%.1f", v))
                        .font(.caption2)
                        .foregroundStyle(Color.secondary)
                }
            }
        }
    }
}

// MARK: - BodyFatLineChart

/// Line + area chart for daily body fat percentage.
struct BodyFatLineChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    private let color = MetricCategory.body.color

    var body: some View {
        Chart(data) { point in
            AreaMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.bodyFat"), point.value)
            )
            .foregroundStyle(color.chartGradient())
            .interpolationMethod(.catmullRom)

            LineMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.bodyFat"), point.value)
            )
            .foregroundStyle(color)
            .lineStyle(StrokeStyle(lineWidth: 2))
            .interpolationMethod(.catmullRom)

            PointMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.bodyFat"), point.value)
            )
            .foregroundStyle(color)
            .symbolSize(24)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { countAxis(unit: "%") }
        .frame(height: height)
    }
}

// MARK: - Preview

#Preview {
    let now = Date.now
    let cal = Calendar.current
    let weightData: [ChartDataPoint] = (0..<14).map { i in
        let d = cal.date(byAdding: .day, value: -i, to: now)!
        return ChartDataPoint(id: "weight:\(i)", date: d, value: 74.5 + Double.random(in: -0.5...0.5))
    }.reversed()

    return WeightLineChart(data: weightData, range: .month)
        .padding()
        .background(Color(.systemGroupedBackground))
}
