import SwiftUI
import Charts

// MARK: - SleepSection

/// Dashboard section showing total nightly sleep duration as a bar chart.
@MainActor
struct SleepSection: View {
    let viewModel: DashboardViewModel
    let onNavigate: (MetricDetailDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(
                title: MetricCategory.sleep.displayName,
                category: .sleep
            )

            ChartCard(
                title: String(localized: "dashboard.metric.sleep"),
                category: .sleep,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.sleepData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "sleep_session", category: .sleep, title: String(localized: "dashboard.metric.sleep"))) }
            ) {
                SleepDurationBarChart(data: viewModel.sleepData, range: viewModel.selectedRange)
            }
        }
    }
}

// MARK: - SleepDurationBarChart

/// Bar chart showing nightly sleep duration in hours.
/// Source values are in minutes; the chart converts to hours for display.
struct SleepDurationBarChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    private let color = MetricCategory.sleep.color

    /// Recommended sleep target line (8 hours).
    private let targetHours: Double = 8

    var body: some View {
        Chart(data) { point in
            BarMark(
                x: .value(String(localized: "chart.axis.date"), point.date, unit: .day),
                y: .value(String(localized: "dashboard.metric.sleep"), point.value / 60)  // mins → hrs
            )
            .foregroundStyle(barColor(hours: point.value / 60).gradient)
            .cornerRadius(3)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { sleepYAxis }
        .frame(height: height)
    }

    /// Colours bars by sleep adequacy:
    /// ≥ 7 h → sleep colour; 5–7 h → amber warning; < 5 h → rose alert.
    private func barColor(hours: Double) -> Color {
        if hours >= 7 { return color }
        if hours >= 5 { return DesignTokens.Colors.warning }
        return DesignTokens.Colors.negative
    }

    private var sleepYAxis: some AxisContent {
        AxisMarks(position: .leading, values: [0, 2, 4, 6, 8, 10]) { value in
            AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                .foregroundStyle(Color.secondary.opacity(0.2))
            AxisValueLabel {
                if let h = value.as(Double.self) {
                    Text("\(Int(h))h")
                        .font(.caption2)
                        .foregroundStyle(Color.secondary)
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    let now = Date.now
    let cal = Calendar.current
    let data: [ChartDataPoint] = (0..<14).map { i in
        let d = cal.date(byAdding: .day, value: -i, to: now)!
        return ChartDataPoint(id: "sleep:\(i)", date: d, value: Double.random(in: 300...540))
    }.reversed()

    return SleepDurationBarChart(data: data, range: .month)
        .padding()
        .background(Color(.systemGroupedBackground))
}
