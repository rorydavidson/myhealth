import SwiftUI
import SwiftData
import BackgroundTasks

/// Background task identifier — must also be listed under
/// `BGTaskSchedulerPermittedIdentifiers` in Info.plist for iOS to honour it.
let bgRefreshTaskIdentifier = "com.healthdashboard.refresh"

@main
struct HealthDashboardApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .modelContainer(PersistenceController.shared.container)
        }
        // MARK: - Background Task (14.3)
        //
        // SwiftUI's `.backgroundTask` modifier is the modern (iOS 16+) alternative
        // to `BGTaskScheduler.shared.register`.  iOS wakes the app when the
        // scheduled refresh fires, executes this closure, and the app re-suspends.
        //
        // The task recomputes today's daily summaries so the dashboard is fresh
        // when the user opens the app the next morning.
        //
        // ⚠️  "com.healthdashboard.refresh" must be in Info.plist under
        //     BGTaskSchedulerPermittedIdentifiers for the scheduler to accept it.
        .backgroundTask(.appRefresh(bgRefreshTaskIdentifier)) {
            // PersistenceController.shared is @MainActor-isolated, so we hop there
            // briefly to read the container, then use it off the main actor.
            // ModelContainer is Sendable so the cross-actor handoff is safe.
            let container = await MainActor.run { PersistenceController.shared.container }
            await HealthKitSyncService.shared.handleBackgroundRefresh(container: container)
            scheduleNextBackgroundRefresh()
        }
    }
}

// MARK: - Background Refresh Scheduling

/// Schedules the next daily background refresh.
/// Called once on first launch (from `MainTabView`) and after each background execution.
func scheduleNextBackgroundRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: bgRefreshTaskIdentifier)
    // Earliest begin date ~24 hours from now.
    // iOS may defer based on usage patterns and battery state — this is expected behaviour.
    request.earliestBeginDate = Calendar.current.date(byAdding: .day, value: 1, to: .now)
    try? BGTaskScheduler.shared.submit(request)
}
