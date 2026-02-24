import SwiftUI

/// Email + password login form.
/// Auth logic implemented in Milestone 13 (AuthManager).
@MainActor
struct LoginFormView: View {
    let onSwitchToSignUp: () -> Void

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

    private func signIn() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        // AuthManager.shared.signIn(email:password:) — implemented in Milestone 13
    }
}
