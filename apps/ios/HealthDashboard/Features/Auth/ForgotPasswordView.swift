import SwiftUI

/// Password-reset request screen.
///
/// Submits the email to the server, then always shows a "check your inbox"
/// confirmation regardless of whether the address is registered — this prevents
/// email-enumeration attacks where an attacker could discover which addresses
/// have accounts by watching for different responses.
@MainActor
struct ForgotPasswordView: View {
    let onBack: () -> Void

    @State private var email = ""
    @State private var isLoading = false
    @State private var didSend = false

    private var isValid: Bool {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        return !trimmed.isEmpty && trimmed.contains("@")
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Text(String(localized: "auth.forgotPassword.title"))
                .font(.title3.weight(.semibold))

            Text(String(localized: "auth.forgotPassword.subtitle"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if didSend {
                sentConfirmation
            } else {
                emailForm
            }
        }
        .animation(.easeInOut(duration: 0.2), value: didSend)
    }

    // MARK: - Subviews

    private var emailForm: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            TextField(String(localized: "auth.field.email"), text: $email)
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .padding()
                .background(.background.secondary)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))

            Button {
                Task { await sendReset() }
            } label: {
                HStack {
                    if isLoading { ProgressView().tint(.white) }
                    Text(String(localized: "auth.forgotPassword.button"))
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

            Button(String(localized: "auth.forgotPassword.backToLogin")) {
                onBack()
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }

    private var sentConfirmation: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "envelope.badge.checkmark")
                .font(.system(size: 44))
                .foregroundStyle(DesignTokens.Colors.positive)

            Text(String(localized: "auth.forgotPassword.sent"))
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            Button(String(localized: "auth.forgotPassword.backToLogin")) {
                onBack()
            }
            .font(.subheadline)
            .foregroundStyle(DesignTokens.Colors.activity)
        }
    }

    // MARK: - Actions

    private func sendReset() async {
        isLoading = true
        defer { isLoading = false }
        // Always show confirmation — prevents email enumeration.
        // `forgotPassword` is already fire-and-forget in AuthManager.
        try? await AuthManager.shared.forgotPassword(email: email)
        withAnimation { didSend = true }
    }
}
