import SwiftUI

/// Name, email, password, confirm-password sign-up form.
/// Auth logic implemented in Milestone 13 (AuthManager).
@MainActor
struct SignUpFormView: View {
    let onSwitchToLogin: () -> Void

    @State private var displayName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    private var passwordsMatch: Bool { password == confirmPassword }

    private var isValid: Bool {
        !displayName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !email.trimmingCharacters(in: .whitespaces).isEmpty &&
        password.count >= 8 &&
        passwordsMatch
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Text(String(localized: "auth.signUp.title"))
                .font(.title3.weight(.semibold))

            VStack(spacing: DesignTokens.Spacing.sm) {
                TextField(String(localized: "auth.field.name"), text: $displayName)
                    .textContentType(.name)
                    .padding()
                    .background(.background.secondary)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))

                TextField(String(localized: "auth.field.email"), text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .padding()
                    .background(.background.secondary)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))

                SecureField(String(localized: "auth.field.password"), text: $password)
                    .textContentType(.newPassword)
                    .padding()
                    .background(.background.secondary)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))

                SecureField(String(localized: "auth.field.confirmPassword"), text: $confirmPassword)
                    .textContentType(.newPassword)
                    .padding()
                    .background(.background.secondary)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))

                if !confirmPassword.isEmpty && !passwordsMatch {
                    Text(String(localized: "auth.signUp.passwordMismatch"))
                        .font(.caption)
                        .foregroundStyle(DesignTokens.Colors.negative)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(DesignTokens.Colors.negative)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await signUp() }
            } label: {
                HStack {
                    if isLoading { ProgressView().tint(.white) }
                    Text(String(localized: "auth.signUp.button"))
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

            Button(String(localized: "auth.signUp.hasAccount")) {
                onSwitchToLogin()
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }

    private func signUp() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        // AuthManager.shared.signUp(...) — implemented in Milestone 13
    }
}
