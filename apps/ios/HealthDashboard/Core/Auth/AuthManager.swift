import Foundation

/// Actor handling all authentication operations.
///
/// Responsibilities:
/// - Sign in / sign up / sign out via the server API
/// - Store and retrieve the session token from Keychain (never UserDefaults)
/// - Inject the Bearer token into `APIClient` after each successful auth
/// - Validate the stored session on app launch
///
/// Callers receive a `UserSession` value and are responsible for applying it
/// to `AppState` on the `@MainActor`.
actor AuthManager {
    static let shared = AuthManager()

    private let keychain = KeychainService.shared

    private init() {}

    // MARK: - Sign In

    func signIn(email: String, password: String) async throws -> UserSession {
        let body = SignInRequest(email: email, password: password)
        let response: AuthResponse = try await APIClient.shared.request(.login, body: body)
        try keychain.set(response.token, forKey: KeychainKey.sessionToken)
        await APIClient.shared.setAuthToken(response.token)
        return UserSession(
            id: response.user.id,
            email: response.user.email,
            displayName: response.user.name ?? email
        )
    }

    // MARK: - Sign Up

    func signUp(name: String, email: String, password: String) async throws -> UserSession {
        let body = SignUpRequest(email: email, password: password, name: name)
        let response: AuthResponse = try await APIClient.shared.request(.signUp, body: body)
        try keychain.set(response.token, forKey: KeychainKey.sessionToken)
        await APIClient.shared.setAuthToken(response.token)
        return UserSession(
            id: response.user.id,
            email: response.user.email,
            displayName: response.user.name ?? name
        )
    }

    // MARK: - Sign Out

    func signOut() async {
        // Best-effort server-side invalidation — don't throw if it fails
        try? await APIClient.shared.requestVoid(.logout)
        _ = try? keychain.delete(forKey: KeychainKey.sessionToken)
        await APIClient.shared.clearAuthToken()
    }

    // MARK: - Session Validation (app launch)

    /// Attempts to restore the session from Keychain.
    ///
    /// - Returns a `UserSession` if the stored token is still valid.
    /// - Returns `nil` on 401 (expired) — Keychain token is cleared.
    /// - Returns `nil` on network error — Keychain token is *preserved*
    ///   so the next launch (with connectivity) can try again.
    func validateSession() async -> UserSession? {
        guard let token = keychain.get(forKey: KeychainKey.sessionToken) else {
            return nil
        }
        await APIClient.shared.setAuthToken(token)

        do {
            let response: SessionResponse = try await APIClient.shared.request(.session)
            return UserSession(
                id: response.user.id,
                email: response.user.email,
                displayName: response.user.name ?? response.user.email
            )
        } catch APIError.unauthorised {
            // Token expired — clear it so the user is sent to the login screen
            _ = try? keychain.delete(forKey: KeychainKey.sessionToken)
            await APIClient.shared.clearAuthToken()
            return nil
        } catch {
            // Network error — return nil but preserve the token for the next attempt
            await APIClient.shared.clearAuthToken()
            return nil
        }
    }

    // MARK: - Forgot Password

    /// Sends a password-reset email.
    /// Always succeeds from the user's perspective — the server never reveals
    /// whether the email address is registered.
    func forgotPassword(email: String) async throws {
        let body = ForgotPasswordRequest(
            email: email,
            redirectTo: "healthdashboard://reset-password"
        )
        // Fire-and-forget; ignore server errors (email may or may not exist)
        try? await APIClient.shared.requestVoid(.forgotPassword, body: body)
    }
}
