import SwiftUI
import Charts

/// Compact 30-day sparkline chart used inside `TrendCard`.
///
/// Renders a filled area + line without any axes, labels, or chrome —
/// all surrounding UI is handled by the parent card.
/// Uses Catmull-Rom interpolation for smooth curves on sparse datasets.
struct SparklineChart: View {
    let points: [SparklinePoint]
    let category: MetricCategory

    var body: some View {
        Chart(points) { point in
            AreaMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value("v", point.value)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [category.color.opacity(0.22), category.color.opacity(0.0)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            LineMark(
                x: .value(String(localized: "chart.axis.date"), point.date),
                y: .value("v", point.value)
            )
            .foregroundStyle(category.color)
            .lineStyle(StrokeStyle(lineWidth: 1.5))
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
    }
}

// MARK: - Preview

#Preview {
    SparklineChart(
        points: (0..<30).map { i in
            SparklinePoint(
                id: "step_count:preview-\(i)",
                date: Calendar.current.date(byAdding: .day, value: i - 30, to: .now)!,
                value: Double.random(in: 5_000...12_000)
            )
        },
        category: .activity
    )
    .frame(height: 60)
    .padding()
}
