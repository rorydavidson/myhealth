import SwiftUI
import Charts

// MARK: - ActivitySection

/// Dashboard section showing Activity charts: Steps, Distance, Active Energy.
/// Each chart is a bar chart — additive metrics suit bars better than lines.
@MainActor
struct ActivitySection: View {
    let viewModel: DashboardViewModel
    let onNavigate: (MetricDetailDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(
                title: MetricCategory.activity.displayName,
                category: .activity
            )

            ChartCard(
                title: String(localized: "dashboard.metric.steps"),
                category: .activity,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.stepData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "step_count", category: .activity, title: String(localized: "dashboard.metric.steps"))) }
            ) {
                StepsBarChart(data: viewModel.stepData, range: viewModel.selectedRange)
            }

            ChartCard(
                title: String(localized: "dashboard.metric.distance"),
                category: .activity,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.distanceData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "distance", category: .activity, title: String(localized: "dashboard.metric.distance"))) }
            ) {
                DistanceBarChart(data: viewModel.distanceData, range: viewModel.selectedRange)
            }

            ChartCard(
                title: String(localized: "dashboard.metric.activeEnergy"),
                category: .activity,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.activeEnergyData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "active_energy", category: .activity, title: String(localized: "dashboard.metric.activeEnergy"))) }
            ) {
                ActiveEnergyBarChart(data: viewModel.activeEnergyData, range: viewModel.selectedRange)
            }
        }
    }
}

// MARK: - StepsBarChart

/// Bar chart for daily step counts. Bar colour: activity blue.
struct StepsBarChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    var body: some View {
        Chart(data) { point in
            BarMark(
                x: .value(String(localized: "chart.axis.date"), point.date, unit: .day),
                y: .value(String(localized: "dashboard.metric.steps"), point.value)
            )
            .foregroundStyle(MetricCategory.activity.color.gradient)
            .cornerRadius(3)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { countAxis(unit: "") }
        .frame(height: height)
    }
}

// MARK: - DistanceBarChart

/// Bar chart for daily walking/running distance in km.
struct DistanceBarChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    var body: some View {
        Chart(data) { point in
            BarMark(
                x: .value(String(localized: "chart.axis.date"), point.date, unit: .day),
                y: .value(String(localized: "dashboard.metric.distance"), point.value / 1_000)
            )
            .foregroundStyle(MetricCategory.activity.color.gradient)
            .cornerRadius(3)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { countAxis(unit: "km") }
        .frame(height: height)
    }
}

// MARK: - ActiveEnergyBarChart

/// Bar chart for daily active energy burned in kcal.
struct ActiveEnergyBarChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    var body: some View {
        Chart(data) { point in
            BarMark(
                x: .value(String(localized: "chart.axis.date"), point.date, unit: .day),
                y: .value(String(localized: "dashboard.metric.activeEnergy"), point.value)
            )
            .foregroundStyle(MetricCategory.activity.color.gradient)
            .cornerRadius(3)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { countAxis(unit: "kcal") }
        .frame(height: height)
    }
}

// MARK: - Shared axis helpers

/// Standard X axis using the range's stride + label format.
func dateAxis(range: DateRange) -> some AxisContent {
    AxisMarks(
        values: .stride(by: range.axisStride.component, count: range.axisStride.count)
    ) { value in
        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
            .foregroundStyle(Color.secondary.opacity(0.25))
        AxisValueLabel(format: range.axisLabelFormat)
            .font(.caption2)
            .foregroundStyle(Color.secondary)
    }
}

/// Standard Y axis with trailing unit label on the last tick.
func countAxis(unit: String) -> some AxisContent {
    AxisMarks(position: .leading) { value in
        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
            .foregroundStyle(Color.secondary.opacity(0.2))
        AxisValueLabel {
            if let dbl = value.as(Double.self) {
                Text(formatAxisValue(dbl, unit: unit))
                    .font(.caption2)
                    .foregroundStyle(Color.secondary)
            }
        }
    }
}

/// Compact axis label formatter — abbreviates thousands (1.2K) and millions (1.2M).
private func formatAxisValue(_ value: Double, unit: String) -> String {
    let formatted: String
    if value >= 1_000_000 {
        formatted = String(format: "%.1fM", value / 1_000_000)
    } else if value >= 1_000 {
        formatted = String(format: "%.1fK", value / 1_000)
    } else {
        formatted = String(format: value.truncatingRemainder(dividingBy: 1) == 0 ? "%.0f" : "%.1f", value)
    }
    return unit.isEmpty ? formatted : "\(formatted) \(unit)"
}

// MARK: - Preview

#Preview {
    let now = Date.now
    let cal = Calendar.current
    let sampleSteps: [ChartDataPoint] = (0..<7).map { i in
        let d = cal.date(byAdding: .day, value: -i, to: now)!
        return ChartDataPoint(id: "step_count:\(i)", date: d, value: Double.random(in: 4_000...12_000))
    }.reversed()

    return ScrollView {
        VStack(alignment: .leading, spacing: 16) {
            StepsBarChart(data: sampleSteps, range: .week)
            DistanceBarChart(
                data: sampleSteps.map { ChartDataPoint(id: $0.id + "d", date: $0.date, value: $0.value * 0.8) },
                range: .week
            )
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
