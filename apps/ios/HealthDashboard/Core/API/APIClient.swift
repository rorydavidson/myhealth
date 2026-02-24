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

    /// Bearer token set by `AuthManager` after a successful sign-in or session validation.
    private var authToken: String?

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always

        self.session = URLSession(configuration: config)

        let urlString = Bundle.main.infoDictionary?["APIBaseURL"] as? String ?? "http://localhost:3001"
        self.baseURL = URL(string: urlString)!

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

    // MARK: - Auth Token Management

    func setAuthToken(_ token: String) { authToken = token }
    func clearAuthToken()              { authToken = nil   }

    // MARK: - Typed Requests (with body)

    func request<Response: Decodable, Body: Encodable>(
        _ endpoint: Endpoint,
        body: Body
    ) async throws -> Response {
        let data = try await performRequest(endpoint, bodyData: try encoder.encode(body))
        return try decode(data)
    }

    // MARK: - Typed Requests (no body)

    func request<Response: Decodable>(_ endpoint: Endpoint) async throws -> Response {
        let data = try await performRequest(endpoint, bodyData: nil)
        return try decode(data)
    }

    // MARK: - Void Requests (with body)

    func requestVoid<Body: Encodable>(_ endpoint: Endpoint, body: Body) async throws {
        _ = try await performRequest(endpoint, bodyData: try encoder.encode(body))
    }

    // MARK: - Void Requests (no body)

    func requestVoid(_ endpoint: Endpoint) async throws {
        _ = try await performRequest(endpoint, bodyData: nil)
    }

    // MARK: - Private

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.decodingError(error) }
    }

    private func performRequest(
        _ endpoint: Endpoint,
        bodyData: Data?,
        attempt: Int = 1
    ) async throws -> Data {
        var request = URLRequest(url: endpoint.url(base: baseURL))
        request.httpMethod = endpoint.method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = bodyData

        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw APIError.cancelled
        } catch {
            if attempt < 2 {
                return try await performRequest(endpoint, bodyData: bodyData, attempt: attempt + 1)
            }
            throw APIError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        switch http.statusCode {
        case 200...299: return data
        case 401:       throw APIError.unauthorised
        default:
            let message = (try? decoder.decode(ProblemDetails.self, from: data))?.detail
                ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw APIError.serverError(statusCode: http.statusCode, message: message)
        }
    }
}

// MARK: - Private Types

private struct ProblemDetails: Decodable { let detail: String? }
