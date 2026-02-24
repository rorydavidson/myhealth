import SwiftUI

/// Import tab: HealthKit connection status, backup import, import history.
/// HealthKit integration in Milestone 14; Apple Health XML fallback in Milestone 22.
@MainActor
struct ImportView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        List {
            Section {
                HealthKitConnectionRow()
            } header: {
                Text(String(localized: "import.section.healthKit"))
            }

            Section {
                EmptyStateView(
                    icon: "clock.arrow.circlepath",
                    title: String(localized: "import.history.empty.title"),
                    message: String(localized: "import.history.empty.message"),
                    category: .activity
                )
                .listRowBackground(Color.clear)
                .listRowInsets(.init())
            } header: {
                Text(String(localized: "import.section.history"))
            }
        }
        .navigationTitle(String(localized: "tab.import"))
        .navigationBarTitleDisplayMode(.large)
    }
}

// MARK: - HealthKit Connection Row

@MainActor
private struct HealthKitConnectionRow: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        HStack {
            Image(systemName: "heart.fill")
                .foregroundStyle(DesignTokens.Colors.heart)
            VStack(alignment: .leading, spacing: 2) {
                Text(String(localized: "import.healthKit.title"))
                    .font(.body)
                Text(statusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            statusBadge
        }
        .padding(.vertical, 4)
    }

    private var statusText: String {
        switch appState.healthKitStatus {
        case .authorised: String(localized: "import.healthKit.status.connected")
        case .denied: String(localized: "import.healthKit.status.denied")
        case .unavailable: String(localized: "import.healthKit.status.unavailable")
        case .notDetermined: String(localized: "import.healthKit.status.notConnected")
        }
    }

    private var statusBadge: some View {
        switch appState.healthKitStatus {
        case .authorised:
            return AnyView(Image(systemName: "checkmark.circle.fill").foregroundStyle(DesignTokens.Colors.positive))
        case .denied:
            return AnyView(Image(systemName: "xmark.circle.fill").foregroundStyle(DesignTokens.Colors.negative))
        case .unavailable:
            return AnyView(Image(systemName: "exclamationmark.circle.fill").foregroundStyle(DesignTokens.Colors.warning))
        case .notDetermined:
            return AnyView(Image(systemName: "chevron.right").foregroundStyle(.secondary))
        }
    }
}
