import SwiftUI

/// Root TabView with five tabs, each backed by its own NavigationStack.
/// Tab bar icons use SF Symbols; category accent colours match Phase 1 design tokens.
@MainActor
struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab: Tab = .dashboard

    enum Tab: Hashable {
        case dashboard, insights, `import`, summary, settings
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardView()
            }
            .tabItem {
                Label(String(localized: "tab.dashboard"), systemImage: "chart.bar.fill")
            }
            .tag(Tab.dashboard)

            NavigationStack {
                InsightsView()
            }
            .tabItem {
                Label(String(localized: "tab.insights"), systemImage: "sparkles")
            }
            .tag(Tab.insights)

            NavigationStack {
                ImportView()
            }
            .tabItem {
                Label(String(localized: "tab.import"), systemImage: "square.and.arrow.down")
            }
            .tag(Tab.import)

            NavigationStack {
                PatientSummaryView()
            }
            .tabItem {
                Label(String(localized: "tab.summary"), systemImage: "doc.text.fill")
            }
            .tag(Tab.summary)

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label(String(localized: "tab.settings"), systemImage: "gearshape.fill")
            }
            .tag(Tab.settings)
        }
        .tint(DesignTokens.Colors.activity)
    }
}
