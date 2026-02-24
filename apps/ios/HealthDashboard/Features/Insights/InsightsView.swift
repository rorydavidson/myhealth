import SwiftUI

/// LLM-powered health insights chat.
/// Privacy-tiered prompt construction and streaming response in Milestone 19.
@MainActor
struct InsightsView: View {
    var body: some View {
        EmptyStateView(
            icon: "sparkles",
            title: String(localized: "insights.empty.title"),
            message: String(localized: "insights.empty.message"),
            category: .activity
        )
        .navigationTitle(String(localized: "tab.insights"))
        .navigationBarTitleDisplayMode(.large)
    }
}
