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
