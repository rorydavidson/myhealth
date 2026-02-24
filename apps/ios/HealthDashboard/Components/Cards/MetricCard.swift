import SwiftUI

/// Snapshot card showing a single metric's hero value.
/// Matches the Phase 1 `MetricCard` component — rounded card, category colour accent,
/// hero number in `largeTitle` weight, unit label in caption.
struct MetricCard: View {
    let category: MetricCategory
    let title: String
    let value: String
    let unit: String
    let dateLabel: String?
    var onTap: (() -> Void)?

    var body: some View {
        Button {
            onTap?()
        } label: {
            cardContent
        }
        .buttonStyle(.plain)
        .disabled(onTap == nil)
    }

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            // Category icon + title row
            HStack(spacing: DesignTokens.Spacing.xs) {
                Image(systemName: category.primaryIcon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(category.color)
                Text(title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }

            // Hero value
            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text(value)
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(.primary)
                    .monospacedDigit()

                Text(unit)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            if let dateLabel {
                Text(dateLabel)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
        .contentShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
    }
}

// MARK: - Preview

#Preview {
    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
        MetricCard(
            category: .activity,
            title: "Steps Today",
            value: "8,247",
            unit: "steps",
            dateLabel: "Today"
        )
        MetricCard(
            category: .heart,
            title: "Resting HR",
            value: "62",
            unit: "bpm",
            dateLabel: "Last night"
        )
        MetricCard(
            category: .sleep,
            title: "Sleep",
            value: "7h 23m",
            unit: "",
            dateLabel: "Last night"
        )
        MetricCard(
            category: .body,
            title: "Weight",
            value: "74.5",
            unit: "kg",
            dateLabel: "Yesterday"
        )
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
