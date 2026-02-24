import SwiftUI

/// Auth entry point — routes between Login and Sign Up.
/// Full-screen, no tab bar, wordmark centred above the form.
@MainActor
struct AuthView: View {
    @State private var mode: Mode = .login

    enum Mode {
        case login, signUp
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Spacer()

            // App wordmark
            VStack(spacing: DesignTokens.Spacing.xs) {
                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(DesignTokens.Colors.heart)
                Text("Health Dashboard")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.primary)
            }

            Spacer().frame(height: DesignTokens.Spacing.md)

            switch mode {
            case .login:
                LoginFormView(onSwitchToSignUp: { mode = .signUp })
            case .signUp:
                SignUpFormView(onSwitchToLogin: { mode = .login })
            }

            Spacer()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .animation(.easeInOut(duration: 0.15), value: mode)
    }
}
