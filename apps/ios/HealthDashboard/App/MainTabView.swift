import SwiftUI
import SwiftData

/// Root TabView with five tabs, each backed by its own NavigationStack.
/// Tab bar icons use SF Symbols; category accent colours match Phase 1 design tokens.
///
/// This view is also responsible for starting the HealthKit sync pipeline once
/// the user is authenticated and HealthKit is authorised (Milestone 14).
@MainActor
struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @State private var selectedTab: Tab = .dashboard

    enum Tab: Hashable {
        case dashboard, trends, insights, summary, more
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
                TrendsView()
            }
            .tabItem {
                Label(String(localized: "tab.trends"), systemImage: "chart.line.uptrend.xyaxis")
            }
            .tag(Tab.trends)

            NavigationStack {
                InsightsView()
            }
            .tabItem {
                Label(String(localized: "tab.insights"), systemImage: "sparkles")
            }
            .tag(Tab.insights)

            NavigationStack {
                PatientSummaryView()
            }
            .tabItem {
                Label(String(localized: "tab.summary"), systemImage: "doc.text.fill")
            }
            .tag(Tab.summary)

            NavigationStack {
                MoreView()
            }
            .tabItem {
                Label(String(localized: "tab.more"), systemImage: "ellipsis.circle.fill")
            }
            .badge(appState.syncState.isActive ? "·" : nil)
            .tag(Tab.more)
        }
        .tint(DesignTokens.Colors.activity)
        // MARK: - Sync pipeline startup
        .task {
            await startSyncPipelineIfNeeded()
        }
        // React to HealthKit auth being granted mid-session (e.g. from onboarding)
        .onChange(of: appState.healthKitStatus) { _, newStatus in
            guard newStatus == .authorised else { return }
            Task { await startSyncPipelineIfNeeded() }
        }
    }

    // MARK: - Sync orchestration

    /// Starts or resumes the HealthKit sync pipeline based on current state.
    ///
    /// - If this is the first authorisation: run the full 5-year initial load.
    /// - If the load was already completed: register observers + background delivery
    ///   to pick up any data written since the last foreground session.
    private func startSyncPipelineIfNeeded() async {
        guard appState.healthKitStatus == .authorised else { return }
        guard !appState.syncState.isActive else { return }

        let container = modelContext.container
        let initialLoadDone = UserDefaults.standard.bool(
            forKey: HealthKitSyncService.initialLoadDoneKey
        )

        if !initialLoadDone {
            // First-time 5-year historical load
            await performInitialLoad(container: container)
        }

        // Always start observers and background delivery on launch
        // (safe to call multiple times — registering is idempotent in practice)
        await HealthKitSyncService.shared.startObserving(container: container)
        await HealthKitSyncService.shared.enableBackgroundDelivery()

        // Schedule daily background refresh if not already scheduled
        scheduleNextBackgroundRefresh()
    }

    private func performInitialLoad(container: ModelContainer) async {
        await HealthKitSyncService.shared.performInitialLoad(
            container: container,
            onProgress: { [weak appState] progress in
                Task { @MainActor in
                    appState?.apply(progress)
                }
            }
        )
    }
}
