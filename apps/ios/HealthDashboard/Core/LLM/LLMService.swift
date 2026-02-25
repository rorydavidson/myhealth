import Foundation
import SwiftData

/// Privacy-tiered LLM proxy client.
///
/// Mirrors Phase 1 `web/src/services/llm.ts`:
/// - Standard mode: only anonymised daily aggregates (no PII, no raw records,
///   no sub-daily timestamps, no device names).
/// - Enhanced mode: adds specific lab values and granular metrics (explicit
///   per-query consent required from the UI layer).
///
/// Returns an `AsyncThrowingStream<String, Error>` so InsightsView can append
/// chunks to the displayed response as they arrive.
actor LLMService {
    static let shared = LLMService()

    // MARK: - Types

    struct QueryOptions: Sendable {
        let userMessage: String
        let enhancedMode: Bool
        /// Extra context the caller computed (Enhanced mode additions)
        let extraContext: String
    }

    struct BuiltPrompt: Sendable {
        /// The full prompt sent to the server (messages array content)
        let userContent: String
        /// Human-readable summary of what health data was included
        let dataSentPreview: String
    }

    // MARK: - Private

    private let baseURL: URL
    private let session: URLSession

    private init() {
        let urlString = Bundle.main.infoDictionary?["APIBaseURL"] as? String ?? "http://localhost:3001"
        baseURL = URL(string: urlString)!
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        session = URLSession(configuration: config)
    }

    // MARK: - Public API

    /// Builds the anonymised health context from the SwiftData container,
    /// then streams the LLM response chunk by chunk.
    ///
    /// - Returns: `(prompt, stream)` — the caller stores the prompt preview and
    ///   consumes the stream to build the displayed response.
    func query(
        options: QueryOptions,
        container: ModelContainer
    ) async throws -> (prompt: BuiltPrompt, stream: AsyncThrowingStream<String, Error>) {
        let prompt = await buildPrompt(options: options, container: container)
        let stream = try makeStream(prompt: prompt, options: options)
        return (prompt, stream)
    }

    // MARK: - Prompt Construction (Standard mode)

    /// Computes anonymised daily aggregates for all tracked metrics.
    /// Maximum granularity: daily. No PII, no device names, no raw records.
    private func buildPrompt(
        options: QueryOptions,
        container: ModelContainer
    ) async -> BuiltPrompt {
        let context = await MainActor.run {
            buildHealthContext(container: container, options: options)
        }
        let fullContent: String
        if context.summary.isEmpty {
            fullContent = options.userMessage
        } else {
            fullContent = """
            Health context (anonymised aggregates):
            \(context.summary)

            \(options.extraContext.isEmpty ? "" : "Additional context:\n\(options.extraContext)\n\n")\
            Question: \(options.userMessage)
            """
        }
        return BuiltPrompt(userContent: fullContent, dataSentPreview: context.preview)
    }

    @MainActor
    private func buildHealthContext(
        container: ModelContainer,
        options: QueryOptions
    ) -> (summary: String, preview: String) {
        let ctx = container.mainContext
        let descriptor = FetchDescriptor<DailySummary>(
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )
        guard let summaries = try? ctx.fetch(descriptor), !summaries.isEmpty else {
            return ("", String(localized: "insights.dataSent.noData"))
        }

        // Last 30 days
        let cal = Calendar(identifier: .gregorian)
        let cutoff = cal.date(byAdding: .day, value: -30, to: .now)!
        let cutoffStr = LLMService.isoDate(cutoff)
        let recent = summaries.filter { $0.date >= cutoffStr }

        // Group by metricType
        var byMetric: [String: [DailySummary]] = [:]
        for s in recent { byMetric[s.metricType, default: []].append(s) }

        var lines: [String] = []
        var previewLines: [String] = []

        let metricOrder = [
            "step_count", "active_energy", "distance",
            "heart_rate", "resting_heart_rate", "hrv",
            "body_mass", "body_fat",
            "oxygen_saturation", "blood_pressure", "respiratory_rate",
            "sleep_session"
        ]
        for metric in metricOrder {
            guard let days = byMetric[metric], !days.isEmpty else { continue }
            if let line = LLMService.summarise(metric: metric, days: days) {
                lines.append(line)
                previewLines.append(line)
            }
        }

        let summary = lines.joined(separator: "\n")
        let preview = previewLines.isEmpty
            ? String(localized: "insights.dataSent.noData")
            : previewLines.joined(separator: "\n")
        return (summary, preview)
    }

    private static func summarise(metric: String, days: [DailySummary]) -> String? {
        let label = LLMService.metricLabel(metric)
        let unit  = LLMService.metricUnit(metric)
        let additives = ["step_count", "active_energy", "distance", "flights_climbed"]
        let isAdditive = additives.contains(metric)
        let values = days.compactMap { isAdditive ? $0.sum : $0.avg }
        guard !values.isEmpty else { return nil }
        let avg = values.reduce(0, +) / Double(values.count)
        let mn  = values.min()!
        let mx  = values.max()!
        let fmt = NumberFormatter()
        fmt.maximumFractionDigits = metric == "body_mass" || metric == "body_fat" ? 1 : 0
        let avgStr = fmt.string(from: avg as NSNumber) ?? "\(Int(avg))"
        let mnStr  = fmt.string(from: mn  as NSNumber) ?? "\(Int(mn))"
        let mxStr  = fmt.string(from: mx  as NSNumber) ?? "\(Int(mx))"
        let n = days.count
        return "\(label): \(n)-day avg \(avgStr) \(unit), range \(mnStr)–\(mxStr)"
    }

    private static func metricLabel(_ m: String) -> String {
        switch m {
        case "step_count":        return "Steps"
        case "active_energy":     return "Active energy"
        case "distance":          return "Walking/running distance"
        case "flights_climbed":   return "Flights climbed"
        case "heart_rate":        return "Heart rate"
        case "resting_heart_rate":return "Resting heart rate"
        case "hrv":               return "Heart rate variability"
        case "body_mass":         return "Body weight"
        case "body_fat":          return "Body fat"
        case "oxygen_saturation": return "Blood oxygen"
        case "blood_pressure":    return "Blood pressure"
        case "respiratory_rate":  return "Respiratory rate"
        case "sleep_session":     return "Sleep duration"
        default:                  return m
        }
    }

    private static func metricUnit(_ m: String) -> String {
        switch m {
        case "step_count", "flights_climbed": return "steps"
        case "active_energy":     return "kcal"
        case "distance":          return "km"
        case "heart_rate", "resting_heart_rate": return "bpm"
        case "hrv":               return "ms"
        case "body_mass":         return "kg"
        case "body_fat":          return "%"
        case "oxygen_saturation": return "%"
        case "blood_pressure":    return "mmHg"
        case "respiratory_rate":  return "breaths/min"
        case "sleep_session":     return "hrs"
        default:                  return ""
        }
    }

    private static func isoDate(_ date: Date) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
        return fmt.string(from: date)
    }

    // MARK: - Streaming

    private func makeStream(
        prompt: BuiltPrompt,
        options: QueryOptions
    ) throws -> AsyncThrowingStream<String, Error> {
        let url = baseURL.appending(path: "/api/llm/query")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("healthdashboard://app", forHTTPHeaderField: "Origin")

        let body: [String: Any] = [
            "messages": [["role": "user", "content": prompt.userContent]],
            "health_context": "",
            "stream": true
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        // Capture actor-isolated `session` into a local before the sending closure.
        let capturedSession: URLSession = session
        let capturedRequest = request
        return AsyncThrowingStream { continuation in
            Task.detached {
                do {
                    let (asyncBytes, response) = try await capturedSession.bytes(for: capturedRequest)
                    guard let http = response as? HTTPURLResponse,
                          (200...299).contains(http.statusCode) else {
                        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                        throw APIError.serverError(
                            statusCode: code,
                            message: HTTPURLResponse.localizedString(forStatusCode: code)
                        )
                    }

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
                                if let err = parsed["error"] as? String {
                                    throw NSError(
                                        domain: "LLMService", code: 0,
                                        userInfo: [NSLocalizedDescriptionKey: err]
                                    )
                                }
                                if let text = parsed["text"] as? String {
                                    continuation.yield(text)
                                }
                            }
                        } else {
                            lineBuffer.append(char)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}
