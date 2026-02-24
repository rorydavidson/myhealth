import SwiftUI

/// Root view: routes between the auth flow and the main tab interface
/// based on authentication state.
///
/// On first appearance, a session validation task runs against the server
/// using any stored Keychain token. A brief loading state prevents the auth
/// screen from flashing while the check is in-flight.
@MainActor
struct RootView: View {
    @Environment(AppState.self) private var appState

    /// Suppresses the auth screen during the initial Keychain → server check.
    @State private var isValidatingSession = true

    var body: some View {
        Group {
            if isValidatingSession {
                // Neutral splash to prevent a flash of the login screen
                // while the stored session is being validated.
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))
            } else if appState.isAuthenticated {
                MainTabView()
                    .preferredColorScheme(appState.theme.colorScheme)
            } else {
                AuthView()
            }
        }
        .animation(.easeInOut(duration: 0.15), value: appState.isAuthenticated)
        .animation(.easeInOut(duration: 0.15), value: isValidatingSession)
        .task { await validateSession() }
    }

    // MARK: - Session Validation

    private func validateSession() async {
        defer { isValidatingSession = false }

        guard let session = await AuthManager.shared.validateSession() else {
            return
        }

        appState.currentUser = session
        // Restore cached preferences in parallel with the UI transition
        await PreferencesService.shared.fetchAndApply(to: appState)
    }
}
