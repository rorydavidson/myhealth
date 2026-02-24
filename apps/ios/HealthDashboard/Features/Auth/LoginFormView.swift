import SwiftUI

/// Email + password login form.
/// On success, calls `PreferencesService` to sync server preferences before
/// the UI transitions to the main tab view.
@MainActor
struct LoginFormView: View {
    let onSwitchToSignUp: () -> Void
    let onForgotPassword: () -> Void

    @Environment(AppState.self) private var appState

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    private var isValid: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty &&
        password.count >= 8
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Text(String(localized: "auth.login.title"))
                .font(.title3.weight(.semibold))

            VStack(spacing: DesignTokens.Spacing.sm) {
                TextField(String(localized: "auth.field.email"), text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .padding()
                    .background(.background.secondary)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))

                SecureField(String(localized: "auth.field.password"), text: $password)
                    .textContentType(.password)
                    .padding()
                    .background(.background.secondary)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))

                HStack {
                    Spacer()
                    Button(String(localized: "auth.login.forgotPassword")) {
                        onForgotPassword()
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(DesignTokens.Colors.negative)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await signIn() }
            } label: {
                HStack {
                    if isLoading { ProgressView().tint(.white) }
                    Text(String(localized: "auth.login.button"))
                        .font(.body.weight(.medium))
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(isValid ? DesignTokens.Colors.activity : Color.secondary)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))
            }
            .disabled(!isValid || isLoading)
            .animation(.easeInOut(duration: 0.15), value: isValid)

            Button(String(localized: "auth.login.noAccount")) {
                onSwitchToSignUp()
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }

    // MARK: - Actions

    private func signIn() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let session = try await AuthManager.shared.signIn(
                email: email.trimmingCharacters(in: .whitespaces),
                password: password
            )
            // Sync server preferences before the UI transitions (best-effort)
            await PreferencesService.shared.fetchAndApply(to: appState)
            appState.currentUser = session
        } catch APIError.unauthorised {
            errorMessage = String(localized: "auth.error.invalidCredentials")
        } catch APIError.serverError(_, let message) {
            errorMessage = message
        } catch APIError.networkError {
            errorMessage = String(localized: "auth.error.network")
        } catch {
            errorMessage = String(localized: "auth.error.server")
        }
    }
}
