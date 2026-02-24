import SwiftUI

/// Settings screen — account, preferences, health data, export, about.
/// Preference sync with server in Milestone 13; storage management in Milestone 21.
@MainActor
struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @State private var showSignOutAlert = false

    var body: some View {
        Form {
            accountSection
            preferencesSection
            healthDataSection
            exportSection
            aboutSection
        }
        .navigationTitle(String(localized: "tab.settings"))
        .navigationBarTitleDisplayMode(.large)
        .alert(String(localized: "settings.signOut.confirm.title"), isPresented: $showSignOutAlert) {
            Button(String(localized: "settings.signOut.confirm.action"), role: .destructive) {
                Task { await signOut() }
            }
            Button(String(localized: "common.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "settings.signOut.confirm.message"))
        }
    }

    // MARK: - Sections

    private var accountSection: some View {
        Section(String(localized: "settings.section.account")) {
            if let user = appState.currentUser {
                LabeledContent(String(localized: "settings.account.name"), value: user.displayName)
                LabeledContent(String(localized: "settings.account.email"), value: user.email)
            }
            Button(String(localized: "settings.signOut"), role: .destructive) {
                showSignOutAlert = true
            }
        }
    }

    private var preferencesSection: some View {
        Section(String(localized: "settings.section.preferences")) {
            @Bindable var state = appState

            Picker(
                String(localized: "settings.units.label"),
                selection: $state.unitPreference
            ) {
                ForEach(AppState.UnitSystem.allCases, id: \.self) { system in
                    Text(system.displayName).tag(system)
                }
            }

            Picker(
                String(localized: "settings.language.label"),
                selection: $state.language
            ) {
                ForEach(AppState.AppLanguage.allCases, id: \.self) { lang in
                    Text(lang.displayName).tag(lang)
                }
            }

            Picker(
                String(localized: "settings.theme.label"),
                selection: $state.theme
            ) {
                ForEach(AppState.AppTheme.allCases, id: \.self) { theme in
                    Text(theme.displayName).tag(theme)
                }
            }
        }
    }

    private var healthDataSection: some View {
        Section(String(localized: "settings.section.healthData")) {
            // Storage usage and clear data — Milestone 21
            Label(
                String(localized: "settings.healthData.storage.placeholder"),
                systemImage: "internaldrive"
            )
            .foregroundStyle(.secondary)
        }
    }

    private var exportSection: some View {
        Section(String(localized: "settings.section.export")) {
            // JSON backup and IPS export — Milestones 20, 21
            Label(String(localized: "settings.export.json"), systemImage: "arrow.up.doc")
                .foregroundStyle(.secondary)
            Label(String(localized: "settings.export.ips"), systemImage: "doc.text.fill")
                .foregroundStyle(.secondary)
        }
    }

    private var aboutSection: some View {
        Section(String(localized: "settings.section.about")) {
            LabeledContent(
                String(localized: "settings.about.version"),
                value: Bundle.main.appVersion
            )
            Link(
                String(localized: "settings.about.privacy"),
                destination: URL(string: "https://healthdashboard.app/privacy")!
            )
        }
    }

    // MARK: - Actions

    private func signOut() async {
        // AuthManager.shared.signOut() — Milestone 13
    }
}

// MARK: - Bundle Extension

private extension Bundle {
    var appVersion: String {
        "\(infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0") (\(infoDictionary?["CFBundleVersion"] as? String ?? "1"))"
    }
}
