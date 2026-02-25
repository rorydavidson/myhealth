import Foundation

/// A single SNOMED CT concept returned from the terminology server.
struct SnomedConcept: Identifiable, Hashable, Sendable {
    var id: String { code }
    let code: String
    let display: String          // Preferred term
    let matchedSynonym: String?  // Set when the query matched a synonym, not the preferred term

    /// The label to show in the picker — synonym first if available.
    var label: String { matchedSynonym ?? display }
}

// MARK: - ECL Constraints

private let clinicalFindingECL = "< 404684003 |Clinical finding|"
private let medicationECL      = "< 373873005 |Pharmaceutical / biologic product|"
private let substanceECL       = "< 105590001 |Substance|"
private let allergyDisorderECL = "< 473010000 |Hypersensitivity condition|"

private let snomedSystem       = "http://snomed.info/sct"
private let synonymCode        = "900000000000013009"

// MARK: - Service

/// Searches the FHIR Terminology Server for SNOMED CT concepts.
///
/// Base URL comes from `FhirTerminologyURL` in Info.plist (set in project.yml).
/// Default: `https://browser.ihtsdotools.org/fhir`
actor SnomedService {
    static let shared = SnomedService()

    private let session: URLSession
    private let baseURL: URL

    private init() {
        let urlString = Bundle.main.infoDictionary?["FhirTerminologyURL"] as? String
            ?? "https://browser.ihtsdotools.org/fhir"
        self.baseURL = URL(string: urlString)!

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        self.session = URLSession(configuration: config)
    }

    // MARK: Public search methods

    /// Search for clinical conditions (Clinical finding hierarchy).
    func searchConditions(query: String, count: Int = 15) async -> [SnomedConcept] {
        guard isValidQuery(query) else { return [] }
        return await searchWithECLFallback(ecl: clinicalFindingECL, query: query, count: count)
    }

    /// Search for medications (Pharmaceutical / biologic product hierarchy).
    func searchMedications(query: String, count: Int = 15) async -> [SnomedConcept] {
        guard isValidQuery(query) else { return [] }
        return await searchWithECLFallback(ecl: medicationECL, query: query, count: count)
    }

    /// Search for allergens — merges Substance + Hypersensitivity condition hierarchies.
    func searchAllergens(query: String, count: Int = 15) async -> [SnomedConcept] {
        guard isValidQuery(query) else { return [] }

        // Search both hierarchies concurrently then deduplicate
        async let substanceTask   = expandValueSet(ecl: substanceECL,       query: query, count: count)
        async let disorderTask    = expandValueSet(ecl: allergyDisorderECL,  query: query, count: count)

        let (substanceResults, disorderResults) = await (substanceTask, disorderTask)

        var seen = Set<String>()
        var merged: [SnomedConcept] = []
        for concept in (substanceResults ?? []) + (disorderResults ?? []) {
            if seen.insert(concept.code).inserted {
                merged.append(concept)
            }
        }

        if !merged.isEmpty { return Array(merged.prefix(count)) }

        // Fallback: unconstrained SNOMED CT search
        return await expandValueSet(ecl: nil, query: query, count: count) ?? []
    }

    // MARK: - Private helpers

    private func isValidQuery(_ query: String) -> Bool {
        query.trimmingCharacters(in: .whitespaces).count >= 2
    }

    /// Tries ECL-constrained search first, falls back to unconstrained.
    private func searchWithECLFallback(ecl: String, query: String, count: Int) async -> [SnomedConcept] {
        if let results = await expandValueSet(ecl: ecl, query: query, count: count), !results.isEmpty {
            return results
        }
        return await expandValueSet(ecl: nil, query: query, count: count) ?? []
    }

    /// Calls `ValueSet/$expand` and decodes the response.
    private func expandValueSet(ecl: String?, query: String, count: Int) async -> [SnomedConcept]? {
        var components = URLComponents(url: baseURL.appendingPathComponent("ValueSet/$expand"),
                                       resolvingAgainstBaseURL: false)!
        var items: [URLQueryItem] = [
            .init(name: "filter",               value: query.trimmingCharacters(in: .whitespaces)),
            .init(name: "count",                value: String(count)),
            .init(name: "includeDesignations",  value: "true"),
        ]
        if let ecl {
            let vsURL = "\(snomedSystem)?fhir_vs=ecl/\(ecl)"
            items.insert(.init(name: "url", value: vsURL), at: 0)
        } else {
            items.insert(.init(name: "url", value: "\(snomedSystem)?fhir_vs"), at: 0)
        }
        components.queryItems = items

        guard let url = components.url else { return nil }

        var request = URLRequest(url: url)
        request.setValue("application/fhir+json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            return try decode(data: data, query: query)
        } catch {
            return nil
        }
    }

    private func decode(data: Data, query: String) throws -> [SnomedConcept] {
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let expansion = json?["expansion"] as? [String: Any],
              let contains  = expansion["contains"] as? [[String: Any]] else { return [] }

        let queryLower = query.lowercased()

        return contains.compactMap { item -> SnomedConcept? in
            guard let code    = item["code"]    as? String,
                  let display = item["display"] as? String else { return nil }

            var matchedSynonym: String? = nil

            // If preferred term doesn't contain the query, check designations for a synonym
            if !display.lowercased().contains(queryLower),
               let designations = item["designation"] as? [[String: Any]] {
                for d in designations {
                    if let use   = d["use"]   as? [String: Any],
                       let code  = use["code"] as? String,
                       code == synonymCode,
                       let value = d["value"]  as? String,
                       value.lowercased().contains(queryLower) {
                        matchedSynonym = value
                        break
                    }
                }
            }

            return SnomedConcept(code: code, display: display, matchedSynonym: matchedSynonym)
        }
    }
}
