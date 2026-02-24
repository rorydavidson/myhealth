import SwiftUI
import Charts
import SwiftData

/// Correlation Explorer — lets the user choose two metrics and visualise how
/// they relate over the past 90 days.
///
/// **Dual-axis strategy**: Swift Charts has no native dual-Y-axis support.
/// Both series are min-max normalised to [0, 1] for the overlay chart so they
/// can share one axis. Real values are shown in the stats row and chart tooltip.
struct CorrelationView: View {
    @State private var vm: CorrelationViewModel
    @State private var showPickerA = false
    @State private var showPickerB = false
    @Environment(\.dismiss) private var dismiss

    init(container: ModelContainer) {
        _vm = State(initialValue: CorrelationViewModel(container: container))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    metricSelectorRow
                    resultContent
                }
                .padding(16)
            }
            .navigationTitle(String(localized: "trends.correlation.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(String(localized: "common.done")) { dismiss() }
                }
            }
        }
        .task { vm.compute() }
        // Metric A picker
        .sheet(isPresented: $showPickerA) {
            MetricPickerSheet(
                title: String(localized: "trends.correlation.selectMetric"),
                selected: vm.metricA
            ) { metric in
                vm.metricA = metric
                vm.compute()
            }
        }
        // Metric B picker
        .sheet(isPresented: $showPickerB) {
            MetricPickerSheet(
                title: String(localized: "trends.correlation.selectMetric"),
                selected: vm.metricB
            ) { metric in
                vm.metricB = metric
                vm.compute()
            }
        }
    }

    // MARK: - Metric selector row

    private var metricSelectorRow: some View {
        HStack(spacing: 8) {
            metricButton(metric: vm.metricA) { showPickerA = true }

            Image(systemName: "arrow.left.arrow.right")
                .font(.footnote)
                .foregroundStyle(.secondary)

            metricButton(metric: vm.metricB) { showPickerB = true }
        }
    }

    private func metricButton(metric: TrendMetric, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: metric.category.primaryIcon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(metric.category.color)
                Text(metric.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(Color.secondary.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Result content

    @ViewBuilder
    private var resultContent: some View {
        if vm.isLoading {
            loadingPlaceholder
        } else if let result = vm.result {
            if result.alignedPairs.count >= 7 {
                VStack(spacing: 16) {
                    strengthBadge(result: result)
                    overlayChart(result: result)
                    scatterChart(result: result)
                    statsRow(result: result)
                }
            } else {
                insufficientDataCard
            }
        }
    }

    // MARK: - Strength badge

    @ViewBuilder
    private func strengthBadge(result: CorrelationResult) -> some View {
        if let r = result.pearsonR, let strength = result.strength {
            let strengthLabel: String = {
                switch strength {
                case .strong:   return String(localized: "trends.correlation.strong")
                case .moderate: return String(localized: "trends.correlation.moderate")
                case .weak:     return String(localized: "trends.correlation.weak")
                }
            }()
            let color: Color = {
                switch strength {
                case .strong:   return DesignTokens.Colors.positive
                case .moderate: return DesignTokens.Colors.warning
                case .weak:     return Color.secondary
                }
            }()
            let dirLabel = r >= 0
                ? String(localized: "trends.correlation.positive")
                : String(localized: "trends.correlation.negative")

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(dirLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(strengthLabel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(color)
                }
                Spacer()
                Text("r = \(String(format: "%.2f", r))")
                    .font(.callout.monospacedDigit().weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .padding(12)
            .background(color.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                    .stroke(color.opacity(0.25), lineWidth: 1)
            )
        }
    }

    // MARK: - Overlay chart (normalised dual-series)

    private func overlayChart(result: CorrelationResult) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 10) {
                Text(String(localized: "trends.correlation.overlayTitle"))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)

                Chart {
                    ForEach(result.normSeriesA) { point in
                        LineMark(
                            x: .value(String(localized: "chart.axis.date"), point.date),
                            y: .value("A", point.value)
                        )
                        .foregroundStyle(vm.metricA.category.color)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        .interpolationMethod(.catmullRom)
                    }
                    ForEach(result.normSeriesB) { point in
                        LineMark(
                            x: .value(String(localized: "chart.axis.date"), point.date),
                            y: .value("B", point.value)
                        )
                        .foregroundStyle(vm.metricB.category.color)
                        .lineStyle(StrokeStyle(lineWidth: 2, dash: [4, 2]))
                        .interpolationMethod(.catmullRom)
                    }
                }
                .chartYScale(domain: -0.05...1.05)
                .chartYAxis(.hidden)
                .frame(height: 150)

                // Manual legend
                HStack(spacing: 16) {
                    legendItem(
                        title: vm.metricA.title,
                        color: vm.metricA.category.color,
                        dashed: false
                    )
                    legendItem(
                        title: vm.metricB.title,
                        color: vm.metricB.category.color,
                        dashed: true
                    )
                }
            }
        }
    }

    private func legendItem(title: String, color: Color, dashed: Bool) -> some View {
        HStack(spacing: 6) {
            if dashed {
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { _ in
                        Capsule()
                            .fill(color)
                            .frame(width: 5, height: 2)
                    }
                }
            } else {
                Capsule()
                    .fill(color)
                    .frame(width: 16, height: 2)
            }
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Scatter plot

    private func scatterChart(result: CorrelationResult) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 10) {
                Text(String(localized: "trends.correlation.scatterTitle"))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)

                Chart(result.alignedPairs) { pair in
                    PointMark(
                        x: .value(vm.metricA.title, pair.normA),
                        y: .value(vm.metricB.title, pair.normB)
                    )
                    .foregroundStyle(vm.metricA.category.color.opacity(0.75))
                    .symbolSize(36)
                }
                .chartXAxisLabel(vm.metricA.title, alignment: .center)
                .chartYAxisLabel(vm.metricB.title)
                .chartXAxis {
                    AxisMarks(values: [0.0, 0.5, 1.0]) { _ in AxisGridLine() }
                }
                .chartYAxis {
                    AxisMarks(values: [0.0, 0.5, 1.0]) { _ in AxisGridLine() }
                }
                .frame(height: 200)
            }
        }
    }

    // MARK: - Stats row

    private func statsRow(result: CorrelationResult) -> some View {
        cardContainer {
            HStack(spacing: 0) {
                statCell(
                    value: "\(result.alignedPairs.count)",
                    label: String(localized: "trends.correlation.sampleSize")
                )
                Divider().frame(height: 40)
                statCell(
                    value: result.pearsonR.map { String(format: "%.3f", $0) } ?? "–",
                    label: String(localized: "trends.correlation.pearsonR")
                )
                Divider().frame(height: 40)
                statCell(
                    value: String(localized: "trends.correlation.days90"),
                    label: String(localized: "trends.correlation.period")
                )
            }
        }
    }

    private func statCell(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.bold().monospacedDigit())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Loading / insufficient data

    private var loadingPlaceholder: some View {
        RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
            .fill(Color.secondary.opacity(0.10))
            .frame(height: 220)
            .shimmering(isActive: true)
    }

    private var insufficientDataCard: some View {
        cardContainer {
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.circle")
                    .font(.title2)
                    .foregroundStyle(DesignTokens.Colors.warning)
                Text(String(localized: "trends.correlation.insufficientData"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
        }
    }

    // MARK: - Card container helper

    private func cardContainer<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(12)
            .background(.background)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                    .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
            )
    }
}

// MARK: - Preview

#Preview {
    CorrelationView(
        container: try! ModelContainer(
            for: DailySummary.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
    )
}
