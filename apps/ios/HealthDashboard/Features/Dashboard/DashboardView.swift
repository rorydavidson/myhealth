import SwiftUI

/// Main dashboard screen — overview cards and chart sections per health category.
/// Data loading and chart implementation in Milestone 15.
@MainActor
struct DashboardView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                EmptyStateView(
                    icon: "chart.bar.fill",
                    title: String(localized: "dashboard.empty.title"),
                    message: String(localized: "dashboard.empty.message"),
                    category: .activity
                )
            }
            .padding(DesignTokens.Spacing.md)
        }
        .navigationTitle(String(localized: "tab.dashboard"))
        .navigationBarTitleDisplayMode(.large)
        .background(Color(.systemGroupedBackground))
    }
}
