import Foundation

// MARK: - Requests

struct SignInRequest: Encodable {
    let email: String
    let password: String
}

struct SignUpRequest: Encodable {
    let email: String
    let password: String
    let name: String
}

/// Better Auth uses `email` + `redirectTo` for password reset.
struct ForgotPasswordRequest: Encodable {
    let email: String
    let redirectTo: String
}

// MARK: - Responses

/// Better Auth sign-in / sign-up response.
struct AuthResponse: Decodable {
    let token: String
    let user: AuthUser
}

struct AuthUser: Decodable {
    let id: String
    let email: String
    let name: String?
    let emailVerified: Bool?
}

/// Better Auth session response — returned by GET /api/auth/session.
struct SessionResponse: Decodable {
    let user: AuthUser
    let session: SessionInfo
}

struct SessionInfo: Decodable {
    let id: String
    let userId: String
    let token: String
    let expiresAt: Date
}

// MARK: - Keychain Keys

enum KeychainKey {
    static let sessionToken = "session_token"
}
