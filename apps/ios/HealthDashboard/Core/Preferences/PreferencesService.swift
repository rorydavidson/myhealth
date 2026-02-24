import Foundation

/// Actor that syncs user preferences between the server and local UserDefaults.
///
/// The server is the source of truth; UserDefaults is a local cache for
/// immediate startup use before the network response arrives.
actor PreferencesService {
    static let shared = PreferencesService()

    private let keyPrefix = "pref_"

    private init() {}

    // MARK: - Fetch & Apply

    /// Fetches preferences from the server and applies them to `AppState`.
    /// Falls back to locally cached values if the network is unavailable.
    func fetchAndApply(to appState: AppState) async {
        do {
            let prefs: ServerPreferences = try await APIClient.shared.request(.preferences)
            saveLocally(prefs)
            await apply(prefs, to: appState)
        } catch {
            // Non-fatal — use the locally cached values from the previous session
            let cached = loadLocally()
            await apply(cached, to: appState)
        }
    }

    // MARK: - Update

    /// Persists a preference change to the server and local cache.
    /// Call this whenever the user changes a setting in `SettingsView`.
    func update(
        unitSystem: AppState.UnitSystem? = nil,
        language: AppState.AppLanguage? = nil,
        theme: AppState.AppTheme? = nil
    ) async throws {
        var current = loadLocally()
        if let unitSystem { current.unitSystem = unitSystem.rawValue }
        if let language   { current.language   = language.rawValue   }
        if let theme      { current.theme       = theme.rawValue      }
        try await APIClient.shared.requestVoid(.updatePreferences, body: current)
        saveLocally(current)
    }

    // MARK: - Local Cache (UserDefaults)

    private func saveLocally(_ prefs: ServerPreferences) {
        let defaults = UserDefaults.standard
        defaults.set(prefs.unitSystem, forKey: "\(keyPrefix)unitSystem")
        defaults.set(prefs.language,   forKey: "\(keyPrefix)language")
        defaults.set(prefs.theme,      forKey: "\(keyPrefix)theme")
    }

    private func loadLocally() -> ServerPreferences {
        let defaults = UserDefaults.standard
        return ServerPreferences(
            unitSystem: defaults.string(forKey: "\(keyPrefix)unitSystem") ?? ServerPreferences.defaults.unitSystem,
            language:   defaults.string(forKey: "\(keyPrefix)language")   ?? ServerPreferences.defaults.language,
            theme:      defaults.string(forKey: "\(keyPrefix)theme")      ?? ServerPreferences.defaults.theme
        )
    }

    // MARK: - Apply to AppState (must run on MainActor)

    @MainActor
    private func apply(_ prefs: ServerPreferences, to appState: AppState) {
        if let unit     = AppState.UnitSystem(rawValue: prefs.unitSystem) { appState.unitPreference = unit }
        if let theme    = AppState.AppTheme(rawValue: prefs.theme)        { appState.theme          = theme }
        if let language = AppState.AppLanguage(rawValue: prefs.language)  { appState.language       = language }
    }
}
