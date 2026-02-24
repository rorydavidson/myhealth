import SwiftUI
import Charts

/// Reusable chart card.
///
/// Wraps any Swift Charts `Chart` in the standard card chrome:
/// - Category-coloured icon + metric title header
/// - Optional "See all" button that invokes `onDetailTap`
/// - `ChartCardSkeleton` while `isLoading` is true
/// - Friendly empty state when there is no data
/// - Standard card shape (rounded corners, border, shadow)
struct ChartCard<ChartContent: View>: View {
    let title: String
    let category: MetricCategory
    var isLoading: Bool = false
    var isEmpty: Bool = false
    /// Height of the chart content area. Dashboard cards use 180 pt;
    /// detail view cards use a taller value.
    var height: CGFloat = 180
    /// Invoked when the user taps "See all". Pass `nil` to hide the button.
    var onDetailTap: (() -> Void)?
    @ViewBuilder let chart: () -> ChartContent

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            headerRow

            Group {
                if isLoading {
                    skeletonChart
                } else if isEmpty {
                    emptyChart
                } else {
                    chart()
                        .transition(.opacity.animation(.easeInOut(duration: 0.3)))
                }
            }
            .frame(height: height)
        }
        .padding(DesignTokens.Spacing.md)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    // MARK: - Sub-views

    private var headerRow: some View {
        HStack(alignment: .center) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                Image(systemName: category.primaryIcon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(category.color)
                Text(title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let onDetailTap {
                Button(action: onDetailTap) {
                    Label(
                        String(localized: "dashboard.chart.seeAll"),
                        systemImage: "chevron.right"
                    )
                    .labelStyle(.titleAndIcon)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(category.color)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var skeletonChart: some View {
        // Faux bar silhouette with shimmer — heights chosen to look chart-like
        let ratios: [CGFloat] = [0.40, 0.65, 0.50, 0.80, 0.60, 0.75, 0.35, 0.70, 0.55, 0.65, 0.80, 0.45]
        return HStack(alignment: .bottom, spacing: 5) {
            ForEach(ratios.indices, id: \.self) { i in
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.secondary.opacity(0.18))
                    .frame(maxWidth: .infinity)
                    .frame(height: ratios[i] * height)
            }
        }
        .frame(maxWidth: .infinity)
        .shimmering(isActive: true)
    }

    private var emptyChart: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Image(systemName: category.primaryIcon)
                .font(.title2)
                .foregroundStyle(category.color.opacity(0.35))
            Text(String(localized: "dashboard.chart.noData"))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        // Loaded state
        ChartCard(title: "Steps", category: .activity, onDetailTap: {}) {
            Chart {
                ForEach(0..<7, id: \.self) { i in
                    BarMark(
                        x: .value("Day", i),
                        y: .value("Steps", Double([6_000, 8_200, 5_400, 11_000, 9_300, 7_800, 8_100][i]))
                    )
                    .foregroundStyle(MetricCategory.activity.color.gradient)
                    .cornerRadius(4)
                }
            }
        }
        // Loading state
        ChartCard(title: "Heart Rate", category: .heart, isLoading: true) {
            EmptyView()
        }
        // Empty state
        ChartCard(title: "Body Fat", category: .body, isEmpty: true) {
            EmptyView()
        }
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
