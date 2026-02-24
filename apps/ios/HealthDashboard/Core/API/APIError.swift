import Foundation

/// Typed API error cases mirroring the server's RFC 9457 Problem Details responses.
enum APIError: Error, LocalizedError {
    /// 401 — session expired or invalid. Triggers logout in `AuthManager`.
    case unauthorised

    /// 4xx (other than 401) or 5xx from the server.
    case serverError(statusCode: Int, message: String)

    /// No network connectivity or host unreachable.
    case networkError(Error)

    /// Unexpected response shape — mismatch between client types and server response.
    case decodingError(Error)

    /// Request was cancelled.
    case cancelled

    var errorDescription: String? {
        switch self {
        case .unauthorised:
            String(localized: "api.error.unauthorised")
        case .serverError(_, let message):
            message
        case .networkError(let error):
            error.localizedDescription
        case .decodingError:
            String(localized: "api.error.decoding")
        case .cancelled:
            String(localized: "api.error.cancelled")
        }
    }

    var isRetryable: Bool {
        switch self {
        case .networkError: true
        default: false
        }
    }
}
