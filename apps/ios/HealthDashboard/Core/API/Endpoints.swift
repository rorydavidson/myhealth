import Foundation

/// All server endpoints.
/// Base URL is injected from Info.plist so Debug and Release point to different hosts.
enum Endpoint {
    // MARK: - Auth
    case session
    case login
    case signUp
    case logout
    case forgotPassword

    // MARK: - Preferences
    case preferences
    case updatePreferences

    // MARK: - LLM Proxy (Milestone 19)
    case llmQuery

    // MARK: - URL Construction

    func url(base: URL) -> URL {
        base.appending(path: path)
    }

    var path: String {
        switch self {
        case .session:           return "/api/auth/session"
        case .login:             return "/api/auth/sign-in/email"
        case .signUp:            return "/api/auth/sign-up/email"
        case .logout:            return "/api/auth/sign-out"
        case .forgotPassword:    return "/api/auth/forget-password"
        case .preferences:       return "/api/preferences"
        case .updatePreferences: return "/api/preferences"
        case .llmQuery:          return "/api/llm/query"
        }
    }

    var method: String {
        switch self {
        case .session, .preferences:
            return "GET"
        case .login, .signUp, .logout, .forgotPassword, .llmQuery:
            return "POST"
        case .updatePreferences:
            return "PATCH"
        }
    }
}
