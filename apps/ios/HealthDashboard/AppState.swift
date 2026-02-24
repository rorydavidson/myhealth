import SwiftUI
import Observation

/// App-wide observable state: session, preferences, HealthKit authorisation status.
/// Propagated via the SwiftUI Environment.
@Observable
@MainActor
final class AppState {
    // MARK: - Session
    var currentUser: UserSession?

    var isAuthenticated: Bool { currentUser != nil }

    // MARK: - HealthKit
    var healthKitStatus: HealthKitStatus = .notDetermined

    // MARK: - Sync state
    /// Current state of the HealthKit sync pipeline.
    var syncState: SyncState = .idle
    /// When the last successful sync completed (persisted across launches via UserDefaults).
    var lastSyncDate: Date? = UserDefaults.standard.object(forKey: "lastSyncDate") as? Date

    // MARK: - Preferences (synced from server on login)
    var unitPreference: UnitSystem = .metric
    var theme: AppTheme = .system
    var language: AppLanguage = .system

    // MARK: - Nested Types

    enum HealthKitStatus {
        case notDetermined
        case authorised
        case denied
        /// iPad or Simulator — HealthKit unavailable; show graceful message
        case unavailable
    }

    /// Reflects the current HealthKit sync pipeline state.
    /// Updated on `@MainActor` by `HealthKitSyncService` progress callbacks.
    enum SyncState: Equatable {
        case idle
        case syncing(phase: String, recordsProcessed: Int)
        case complete
        case failed(String)

        var isActive: Bool {
            if case .syncing = self { return true }
            return false
        }

        var statusMessage: String {
            switch self {
            case .idle:
                return String(localized: "import.sync.idle")
            case .syncing(let phase, _):
                return phase
            case .complete:
                return String(localized: "import.sync.complete")
            case .failed(let message):
                return message
            }
        }
    }

    /// Translates a `SyncProgress` value (from the sync actor) into `SyncState`
    /// and updates `lastSyncDate` when complete.
    /// Must be called on `@MainActor`.
    func apply(_ progress: SyncProgress) {
        switch progress.phase {
        case .querying(let metricType):
            syncState = .syncing(
                phase: String(localized: "import.sync.querying \(metricType)"),
                recordsProcessed: progress.recordsProcessed
            )
        case .storing:
            syncState = .syncing(
                phase: String(localized: "import.sync.storing"),
                recordsProcessed: progress.recordsProcessed
            )
        case .computingSummaries:
            syncState = .syncing(
                phase: String(localized: "import.sync.summaries"),
                recordsProcessed: progress.recordsProcessed
            )
        case .complete:
            syncState = .complete
            lastSyncDate = .now
            UserDefaults.standard.set(Date.now, forKey: "lastSyncDate")
        case .failed(let message):
            syncState = .failed(message)
        }
    }

    enum UnitSystem: String, CaseIterable, Codable {
        case metric
        case imperial

        var displayName: String {
            switch self {
            case .metric: String(localized: "settings.units.metric")
            case .imperial: String(localized: "settings.units.imperial")
            }
        }
    }

    enum AppTheme: String, CaseIterable, Codable {
        case system
        case light
        case dark

        var colorScheme: ColorScheme? {
            switch self {
            case .system: nil
            case .light: .light
            case .dark: .dark
            }
        }

        var displayName: String {
            switch self {
            case .system: String(localized: "settings.theme.system")
            case .light: String(localized: "settings.theme.light")
            case .dark: String(localized: "settings.theme.dark")
            }
        }
    }

    enum AppLanguage: String, CaseIterable, Codable {
        case system
        case english = "en"
        case french = "fr"

        var displayName: String {
            switch self {
            case .system: String(localized: "settings.language.system")
            case .english: "English"
            case .french: "Français"
            }
        }
    }
}

// MARK: - UserSession

struct UserSession: Codable, Sendable {
    let id: String
    let email: String
    var displayName: String
}
