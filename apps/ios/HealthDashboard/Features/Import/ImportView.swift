import SwiftUI
import SwiftData

/// Import tab: HealthKit connection status, live sync progress, and import history.
///
/// Milestone 14 wires the HealthKit connection row to the real sync pipeline
/// and renders the import history from Swift Data.
/// Milestone 22 adds the Apple Health XML fallback file importer below.
@MainActor
struct ImportView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext

    @Query(sort: \HealthImport.startedAt, order: .reverse)
    private var imports: [HealthImport]

    var body: some View {
        List {
            // MARK: Apple Health connection
            Section {
                HealthKitConnectionRow(
                    onConnect: { Task { await requestAuth() } },
                    onResync:  { Task { await resync() } }
                )
            } header: {
                Text(String(localized: "import.section.healthKit"))
            }

            // MARK: Sync progress (shown while syncing)
            if appState.syncState.isActive {
                Section {
                    SyncProgressRow()
                }
            }

            // MARK: Import history
            Section {
                if imports.isEmpty {
                    EmptyStateView(
                        icon: "clock.arrow.circlepath",
                        title: String(localized: "import.history.empty.title"),
                        message: String(localized: "import.history.empty.message"),
                        category: .activity
                    )
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init())
                } else {
                    ForEach(imports) { importRecord in
                        ImportHistoryRow(importRecord: importRecord)
                    }
                }
            } header: {
                Text(String(localized: "import.section.history"))
            }
        }
        .navigationTitle(String(localized: "tab.import"))
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: - HealthKit auth request

    private func requestAuth() async {
        do {
            try await HealthKitManager.shared.requestAuthorisation()
            // requestAuthorization never throws when HealthKit is available;
            // after the system dialog, treat the session as authorised so the
            // sync pipeline can start (empty grants just produce empty queries).
            appState.healthKitStatus = .authorised
        } catch HealthKitError.unavailable {
            // Device does not support HealthKit (iPad, or Simulator)
            appState.healthKitStatus = .unavailable
        } catch {
            // Entitlement missing, plist key missing, or another OS-level error.
            // Treat as denied so the UI shows a recoverable error state rather
            // than "unavailable", which implies a hardware limitation.
            appState.healthKitStatus = .denied
        }
    }

    // MARK: - Re-sync

    private func resync() async {
        guard appState.healthKitStatus == .authorised,
              !appState.syncState.isActive
        else { return }

        let container = modelContext.container
        // Reset the initial load flag so performInitialLoad picks up any new data
        UserDefaults.standard.removeObject(forKey: HealthKitSyncService.initialLoadDoneKey)

        await HealthKitSyncService.shared.performInitialLoad(
            container: container,
            onProgress: { [weak appState] progress in
                Task { @MainActor in
                    appState?.apply(progress)
                }
            }
        )
    }
}

// MARK: - HealthKit Connection Row

@MainActor
private struct HealthKitConnectionRow: View {
    @Environment(AppState.self) private var appState
    let onConnect: () -> Void
    let onResync: () -> Void

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "heart.fill")
                .foregroundStyle(DesignTokens.Colors.heart)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(String(localized: "import.healthKit.title"))
                    .font(.body)
                if let lastSync = appState.lastSyncDate {
                    Text(String(
                        localized: "import.healthKit.lastSync \(lastSync.formatted(.relative(presentation: .named)))"
                    ))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                } else {
                    Text(statusText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            HStack(spacing: DesignTokens.Spacing.sm) {
                statusBadge

                switch appState.healthKitStatus {
                case .notDetermined:
                    // Primary CTA — triggers the system HealthKit permission sheet
                    Button(String(localized: "import.healthKit.connect"), action: onConnect)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(DesignTokens.Colors.activity)
                        .buttonStyle(.plain)
                case .authorised:
                    // Re-sync button — only shown when idle
                    if !appState.syncState.isActive {
                        Button(action: onResync) {
                            Image(systemName: "arrow.clockwise")
                                .font(.caption)
                                .foregroundStyle(DesignTokens.Colors.activity)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(String(localized: "import.healthKit.resync"))
                    }
                default:
                    EmptyView()
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var statusText: String {
        switch appState.healthKitStatus {
        case .authorised:    String(localized: "import.healthKit.status.connected")
        case .denied:        String(localized: "import.healthKit.status.denied")
        case .unavailable:   String(localized: "import.healthKit.status.unavailable")
        case .notDetermined: String(localized: "import.healthKit.status.notConnected")
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch appState.healthKitStatus {
        case .authorised:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(DesignTokens.Colors.positive)
        case .denied:
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(DesignTokens.Colors.negative)
        case .unavailable:
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(DesignTokens.Colors.warning)
        case .notDetermined:
            EmptyView()
        }
    }
}

// MARK: - Sync Progress Row

@MainActor
private struct SyncProgressRow: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(0.8)

            VStack(alignment: .leading, spacing: 2) {
                Text(appState.syncState.statusMessage)
                    .font(.subheadline)

                if case .syncing(_, let count) = appState.syncState, count > 0 {
                    Text(String(
                        localized: "import.sync.recordCount \(count.formatted())"
                    ))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Import History Row

private struct ImportHistoryRow: View {
    let importRecord: HealthImport

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: platformIcon)
                .foregroundStyle(DesignTokens.Colors.activity)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(importRecord.importPlatform.displayName)
                    .font(.subheadline)
                Text(importRecord.startedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                StatusBadge(status: importRecord.importStatus)
                Text(String(
                    localized: "import.history.recordCount \(importRecord.recordCount.formatted())"
                ))
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private var platformIcon: String {
        switch importRecord.importPlatform {
        case .appleHealth:   "heart.fill"
        case .healthConnect: "cross.circle.fill"
        case .jsonBackup:    "doc.fill"
        }
    }
}

// MARK: - Status Badge

private struct StatusBadge: View {
    let status: ImportStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(badgeColor.opacity(0.15))
            .foregroundStyle(badgeColor)
            .clipShape(Capsule())
    }

    private var badgeColor: Color {
        switch status {
        case .completed:  DesignTokens.Colors.positive
        case .processing: DesignTokens.Colors.warning
        case .failed:     DesignTokens.Colors.negative
        }
    }
}
