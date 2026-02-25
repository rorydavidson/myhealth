import Foundation

/// Generates AI-powered plain-language summaries for SNOMED CT concepts (conditions and allergens)
/// by calling the server's LLM proxy endpoint.
///
/// Mirrors the web app's `generateConceptSummary()` in `services/llm.ts`.
/// The summary is purely educational — the prompt explicitly forbids treatment recommendations.
///
/// Usage:
/// ```swift
/// Task {
///     if let summary = await ConceptSummaryService.shared.summarise(
///         code: concept.code,
///         display: concept.display,
///         type: .condition
///     ) {
///         condition.aiSummary = summary
///     }
/// }
/// ```
actor ConceptSummaryService {
    static let shared = ConceptSummaryService()

    enum ConceptType { case condition, allergen }

    private let baseURL: URL
    private let session: URLSession

    private init() {
        let urlString = Bundle.main.infoDictionary?["APIBaseURL"] as? String ?? "http://localhost:3001"
        self.baseURL = URL(string: urlString)!

        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        self.session = URLSession(configuration: config)
    }

    // MARK: - Public API

    /// Returns a 2–3 sentence plain-language summary for the given SNOMED CT concept,
    /// or `nil` if the request fails (caller should degrade gracefully).
    func summarise(code: String, display: String, type: ConceptType) async -> String? {
        let prompt = buildPrompt(code: code, display: display, type: type)
        return try? await streamQuery(prompt: prompt)
    }

    // MARK: - Prompt

    private func buildPrompt(code: String, display: String, type: ConceptType) -> String {
        let typeLabel = type == .condition
            ? "clinical condition"
            : "allergen or allergic condition"
        return """
        Summarise the \(typeLabel) identified by SNOMED CT code \(code) — preferred term: "\(display)".

        Write 2–3 plain-language sentences suitable for a patient's personal health record. \
        Cover what the concept is, how it typically presents, and any important patient-facing \
        considerations but do not make the information too overwhelming. \
        Base the summary strictly on this specific SNOMED CT concept (code \(code), "\(display)") \
        — do not generalise to related conditions. \
        Do not give treatment recommendations. Keep the tone factual and educational.
        """
    }

    // MARK: - LLM Streaming

    /// Posts to `/api/llm/query` and collects all SSE `data:` chunks, returning the full text.
    private func streamQuery(prompt: String) async throws -> String {
        let url = baseURL.appending(path: "/api/llm/query")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("healthdashboard://app", forHTTPHeaderField: "Origin")

        let body: [String: Any] = [
            "messages": [["role": "user", "content": prompt]],
            "health_context": "",
            "stream": false
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        // Use `bytes(for:)` to stream the SSE response line by line.
        let (asyncBytes, response) = try await session.bytes(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        var fullText = ""
        var lineBuffer = ""

        for try await byte in asyncBytes {
            let char = Character(UnicodeScalar(byte))
            if char == "\n" {
                let line = lineBuffer.trimmingCharacters(in: .whitespaces)
                lineBuffer = ""

                guard line.hasPrefix("data: ") else { continue }
                let data = String(line.dropFirst(6))
                if data == "[DONE]" { break }

                if let json = data.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: json) as? [String: Any] {
                    if let error = parsed["error"] as? String {
                        throw NSError(domain: "ConceptSummaryService", code: 0,
                                      userInfo: [NSLocalizedDescriptionKey: error])
                    }
                    if let text = parsed["text"] as? String {
                        fullText += text
                    }
                }
            } else {
                lineBuffer.append(char)
            }
        }

        let trimmed = fullText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw URLError(.zeroByteResource) }
        return trimmed
    }
}
