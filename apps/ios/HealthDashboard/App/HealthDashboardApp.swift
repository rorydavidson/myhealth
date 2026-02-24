import SwiftUI
import SwiftData

@main
struct HealthDashboardApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .modelContainer(PersistenceController.shared.container)
        }
    }
}
