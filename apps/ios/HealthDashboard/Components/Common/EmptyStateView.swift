import SwiftUI

/// Friendly empty state with SF Symbol icon, title, body, and optional CTA.
/// Never shows a blank card — always a clear message with next-step guidance.
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var category: MetricCategory = .activity
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Spacer()

            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(category.color.opacity(0.8))

            VStack(spacing: DesignTokens.Spacing.xs) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.body.weight(.medium))
                        .padding(.horizontal, DesignTokens.Spacing.lg)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .background(category.color)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(DesignTokens.Spacing.xl)
    }
}

// MARK: - Preview

#Preview {
    EmptyStateView(
        icon: "heart.fill",
        title: "No heart rate data yet",
        message: "Import your Apple Health data to see your heart rate trends.",
        category: .heart,
        actionTitle: "Import Data",
        action: {}
    )
}
