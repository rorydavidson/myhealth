import Foundation

/// User preferences as stored on the server.
/// Raw string values match the server's expected format and AppState enum raw values.
struct ServerPreferences: Codable {
    var unitSystem: String  // "metric" | "imperial"
    var language: String    // "system" | "en" | "fr"
    var theme: String       // "system" | "light" | "dark"

    /// Default preferences applied when server is unreachable on first launch.
    static let defaults = ServerPreferences(
        unitSystem: AppState.UnitSystem.metric.rawValue,
        language: AppState.AppLanguage.system.rawValue,
        theme: AppState.AppTheme.system.rawValue
    )
}
