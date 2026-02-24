import SwiftUI

/// 3-screen first-launch carousel shown before the main dashboard.
/// HealthKit permission request on the final screen — Milestone 22 wires this fully.
@MainActor
struct OnboardingView: View {
    @Environment(AppState.self) private var appState
    @Binding var isPresented: Bool

    @State private var currentPage = 0

    private let pages: [OnboardingPage] = [
        OnboardingPage(
            icon: "chart.bar.fill",
            iconColor: DesignTokens.Colors.activity,
            title: String(localized: "onboarding.page1.title"),
            body: String(localized: "onboarding.page1.body")
        ),
        OnboardingPage(
            icon: "lock.shield.fill",
            iconColor: DesignTokens.Colors.vitals,
            title: String(localized: "onboarding.page2.title"),
            body: String(localized: "onboarding.page2.body")
        ),
        OnboardingPage(
            icon: "heart.fill",
            iconColor: DesignTokens.Colors.heart,
            title: String(localized: "onboarding.page3.title"),
            body: String(localized: "onboarding.page3.body")
        ),
    ]

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $currentPage) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                    OnboardingPageView(page: page)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Spacer().frame(height: DesignTokens.Spacing.lg)

            if currentPage < pages.count - 1 {
                Button {
                    withAnimation { currentPage += 1 }
                } label: {
                    Text(String(localized: "onboarding.next"))
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(DesignTokens.Colors.activity)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))
                }
            } else {
                Button {
                    Task { await requestHealthKitAndDismiss() }
                } label: {
                    Text(String(localized: "onboarding.getStarted"))
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(DesignTokens.Colors.heart)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))
                }
            }
        }
        .padding(DesignTokens.Spacing.lg)
    }

    private func requestHealthKitAndDismiss() async {
        do {
            try await HealthKitManager.shared.requestAuthorisation()
            await MainActor.run { appState.healthKitStatus = .authorised }
        } catch HealthKitError.unavailable {
            await MainActor.run { appState.healthKitStatus = .unavailable }
        } catch {
            await MainActor.run { appState.healthKitStatus = .denied }
        }
        isPresented = false
    }
}

// MARK: - Supporting Types

private struct OnboardingPage {
    let icon: String
    let iconColor: Color
    let title: String
    let body: String
}

private struct OnboardingPageView: View {
    let page: OnboardingPage

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Spacer()

            Image(systemName: page.icon)
                .font(.system(size: 72))
                .foregroundStyle(page.iconColor)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text(page.title)
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)

                Text(page.body)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }
}
