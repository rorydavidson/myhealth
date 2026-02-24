import SwiftUI

/// Root view: routes between the auth flow and the main tab interface
/// based on authentication state.
@MainActor
struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isAuthenticated {
                MainTabView()
                    .preferredColorScheme(appState.theme.colorScheme)
            } else {
                AuthView()
            }
        }
        .animation(.easeInOut(duration: 0.15), value: appState.isAuthenticated)
    }
}
