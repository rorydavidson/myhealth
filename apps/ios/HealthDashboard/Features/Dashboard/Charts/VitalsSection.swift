import SwiftUI
import Charts

// MARK: - VitalsSection

/// Dashboard section showing Vitals charts: Blood Oxygen (SpO₂) and Respiratory Rate.
@MainActor
struct VitalsSection: View {
    let viewModel: DashboardViewModel
    let onNavigate: (MetricDetailDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(
                title: MetricCategory.vitals.displayName,
                category: .vitals
            )

            ChartCard(
                title: String(localized: "dashboard.metric.oxygenSaturation"),
                category: .vitals,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.spo2Data.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "oxygen_saturation", category: .vitals, title: String(localized: "dashboard.metric.oxygenSaturation"))) }
            ) {
                SpO2LineChart(data: viewModel.spo2Data, range: viewModel.selectedRange)
            }

            ChartCard(
                title: String(localized: "dashboard.metric.respiratoryRate"),
                category: .vitals,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.respiratoryRateData.isEmpty,
                onDetailTap: { onNavigate(.metric(type: "respiratory_rate", category: .vitals, title: String(localized: "dashboard.metric.respiratoryRate"))) }
            ) {
                RespiratoryRateLineChart(data: viewModel.respiratoryRateData, range: viewModel.selectedRange)
            }
        }
    }
}

// MARK: - SpO2LineChart

/// Line chart for daily blood oxygen saturation.
/// Y axis is tightly bounded near 95–100% where healthy variation occurs.
struct SpO2LineChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    private let color = MetricCategory.vitals.color
    /// Threshold below which SpO₂ is clinically concerning.
    private let concernThreshold: Double = 95

    var body: some View {
        Chart(data) { point in
            AreaMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.oxygenSaturation"), point.value)
            )
            .foregroundStyle(color.chartGradient())
            .interpolationMethod(.catmullRom)

            LineMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.oxygenSaturation"), point.value)
            )
            .foregroundStyle(barColorForSpO2(point.value))
            .lineStyle(StrokeStyle(lineWidth: 2))
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { spo2YAxis }
        .chartYScale(domain: 90...101)
        .frame(height: height)
    }

    private func barColorForSpO2(_ value: Double) -> Color {
        value >= concernThreshold ? color : DesignTokens.Colors.negative
    }

    private var spo2YAxis: some AxisContent {
        AxisMarks(position: .leading, values: [90, 92, 94, 96, 98, 100]) { value in
            AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                .foregroundStyle(Color.secondary.opacity(0.2))
            AxisValueLabel {
                if let v = value.as(Double.self) {
                    Text("\(Int(v))%")
                        .font(.caption2)
                        .foregroundStyle(Color.secondary)
                }
            }
        }
    }
}

// MARK: - RespiratoryRateLineChart

/// Line + area chart for daily average respiratory rate (breaths/min).
struct RespiratoryRateLineChart: View {
    let data: [ChartDataPoint]
    let range: DateRange
    var height: CGFloat = 180

    private let color = MetricCategory.vitals.color

    var body: some View {
        Chart(data) { point in
            AreaMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.respiratoryRate"), point.value)
            )
            .foregroundStyle(color.chartGradient())
            .interpolationMethod(.catmullRom)

            LineMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value(String(localized: "dashboard.metric.respiratoryRate"), point.value)
            )
            .foregroundStyle(color)
            .lineStyle(StrokeStyle(lineWidth: 2))
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis { countAxis(unit: "br/m") }
        .frame(height: height)
    }
}

// MARK: - Preview

#Preview {
    let now = Date.now
    let cal = Calendar.current
    let spo2: [ChartDataPoint] = (0..<14).map { i in
        let d = cal.date(byAdding: .day, value: -i, to: now)!
        return ChartDataPoint(id: "spo2:\(i)", date: d, value: Double.random(in: 96...99))
    }.reversed()

    return SpO2LineChart(data: spo2, range: .month)
        .padding()
        .background(Color(.systemGroupedBackground))
}
