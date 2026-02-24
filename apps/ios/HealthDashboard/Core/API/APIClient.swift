import Foundation

/// Shared HTTP client wrapping URLSession.
///
/// - Base URL read from Info.plist key `APIBaseURL`:
///   - Debug scheme: `http://localhost:3001`
///   - Release scheme: production URL
/// - All requests include `Content-Type: application/json` and `Accept: application/json`.
/// - Session cookies forwarded automatically via `HTTPCookieStorage.shared`.
/// - 1 automatic retry on network error; no retry on 4xx/5xx.
actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always

        self.session = URLSession(configuration: config)

        guard
            let urlString = Bundle.main.infoDictionary?["APIBaseURL"] as? String,
            let url = URL(string: urlString)
        else {
            // Fallback to localhost for development — should be configured in Info.plist
            self.baseURL = URL(string: "http://localhost:3001")!
            self.decoder = JSONDecoder()
            self.encoder = JSONEncoder()
            return
        }

        self.baseURL = url
        self.decoder = {
            let d = JSONDecoder()
            d.keyDecodingStrategy = .convertFromSnakeCase
            d.dateDecodingStrategy = .iso8601
            return d
        }()
        self.encoder = {
            let e = JSONEncoder()
            e.keyEncodingStrategy = .convertToSnakeCase
            e.dateEncodingStrategy = .iso8601
            return e
        }()
    }

    // MARK: - Public Interface

    /// Performs a typed request and decodes the response body.
    func request<Response: Decodable>(
        _ endpoint: Endpoint,
        body: (some Encodable)? = nil as EmptyBody?
    ) async throws -> Response {
        let data = try await performRequest(endpoint, body: body)
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Performs a request with no response body (e.g. logout, delete).
    func requestVoid(_ endpoint: Endpoint, body: (some Encodable)? = nil as EmptyBody?) async throws {
        _ = try await performRequest(endpoint, body: body)
    }

    // MARK: - Private

    private func performRequest(
        _ endpoint: Endpoint,
        body: (some Encodable)?,
        attempt: Int = 1
    ) async throws -> Data {
        var request = URLRequest(url: endpoint.url(base: baseURL))
        request.httpMethod = endpoint.method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body {
            request.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw APIError.cancelled
        } catch {
            // 1 automatic retry on network error
            if attempt < 2 {
                return try await performRequest(endpoint, body: body, attempt: attempt + 1)
            }
            throw APIError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        switch http.statusCode {
        case 200...299:
            return data
        case 401:
            throw APIError.unauthorised
        default:
            // Parse RFC 9457 Problem Details if available
            let message = (try? decoder.decode(ProblemDetails.self, from: data))?.detail
                ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw APIError.serverError(statusCode: http.statusCode, message: message)
        }
    }
}

// MARK: - Supporting Types

/// RFC 9457 Problem Details — subset used for error extraction.
private struct ProblemDetails: Decodable {
    let detail: String?
}

/// Sentinel type for requests with no body.
private struct EmptyBody: Encodable {}
