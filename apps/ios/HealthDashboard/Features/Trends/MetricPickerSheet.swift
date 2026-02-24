import SwiftUI

/// Metric selection sheet for the Correlation Explorer.
///
/// Shows all trend-eligible metrics grouped by `MetricCategory`.
/// Tapping a row calls `onSelect` and dismisses the sheet.
struct MetricPickerSheet: View {
    let title: String
    let selected: TrendMetric
    let onSelect: (TrendMetric) -> Void

    @Environment(\.dismiss) private var dismiss

    /// All metrics grouped by display category, in dashboard order.
    private var grouped: [(MetricCategory, [TrendMetric])] {
        let metrics = allTrendMetrics()
        let order: [MetricCategory] = [.activity, .heart, .sleep, .body, .vitals]
        return order.compactMap { cat in
            let items = metrics.filter { $0.category == cat }
            return items.isEmpty ? nil : (cat, items)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(grouped, id: \.0) { category, metrics in
                    Section {
                        ForEach(metrics) { metric in
                            Button {
                                onSelect(metric)
                                dismiss()
                            } label: {
                                metricRow(metric, category: category)
                            }
                            .buttonStyle(.plain)
                        }
                    } header: {
                        Text(category.displayName)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(String(localized: "common.done")) { dismiss() }
                }
            }
        }
    }

    // MARK: - Row

    private func metricRow(_ metric: TrendMetric, category: MetricCategory) -> some View {
        HStack(spacing: 12) {
            Image(systemName: category.primaryIcon)
                .font(.body.weight(.medium))
                .foregroundStyle(category.color)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(metric.title)
                    .font(.body)
                    .foregroundStyle(.primary)
                Text(metric.unit)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if metric.id == selected.id {
                Image(systemName: "checkmark")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(category.color)
            }
        }
        .contentShape(Rectangle())
    }
}

// MARK: - Preview

#Preview {
    MetricPickerSheet(
        title: String(localized: "trends.correlation.selectMetric"),
        selected: allTrendMetrics()[0]
    ) { _ in }
}
