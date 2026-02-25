import SwiftUI

/// A search field that queries `SnomedService` with 300 ms debounce and displays
/// an inline list of results.  The caller receives the selected concept via a binding.
///
/// Usage:
/// ```swift
/// SnomedSearchField(
///     placeholder: "Search conditions…",
///     searchMode: .conditions,
///     selection: $selectedConcept
/// )
/// ```
@MainActor
struct SnomedSearchField: View {
    enum SearchMode { case conditions, medications, allergens }

    let placeholder: String
    let searchMode: SearchMode
    @Binding var selection: SnomedConcept?

    @State private var query:    String          = ""
    @State private var results:  [SnomedConcept] = []
    @State private var isSearching: Bool         = false
    @State private var debounceTask: Task<Void, Never>? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Search input
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField(placeholder, text: $query)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .onChange(of: query) { _, new in
                        scheduleSearch(new)
                    }
                if isSearching {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .scaleEffect(0.7)
                } else if !query.isEmpty {
                    Button {
                        query   = ""
                        results = []
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(10)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))

            // Selected concept pill
            if let concept = selection {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(DesignTokens.Colors.positive)
                    Text(concept.label)
                        .font(.subheadline)
                        .lineLimit(2)
                    Spacer()
                    Text(concept.code)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Button {
                        selection = nil
                        query     = ""
                        results   = []
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(DesignTokens.Colors.positive.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .padding(.top, 6)
            }

            // Results list
            if !results.isEmpty && selection == nil {
                VStack(spacing: 0) {
                    ForEach(results) { concept in
                        Button {
                            selection = concept
                            query     = concept.label
                            results   = []
                        } label: {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(concept.display)
                                        .font(.subheadline)
                                        .foregroundStyle(.primary)
                                        .multilineTextAlignment(.leading)
                                    if let synonym = concept.matchedSynonym {
                                        Text(""\(synonym)"")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Text(concept.code)
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                                    .padding(.top, 2)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        if concept.id != results.last?.id {
                            Divider().padding(.leading, 10)
                        }
                    }
                }
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .padding(.top, 4)
            } else if !query.isEmpty && !isSearching && results.isEmpty && selection == nil {
                Text(String(localized: "snomed.noResults"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 10)
                    .padding(.top, 6)
            }
        }
    }

    // MARK: - Debounce

    private func scheduleSearch(_ newQuery: String) {
        debounceTask?.cancel()
        guard newQuery.trimmingCharacters(in: .whitespaces).count >= 2 else {
            results     = []
            isSearching = false
            return
        }
        isSearching = true
        debounceTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            let concepts = await performSearch(query: newQuery)
            guard !Task.isCancelled else { return }
            results     = concepts
            isSearching = false
        }
    }

    private func performSearch(query: String) async -> [SnomedConcept] {
        switch searchMode {
        case .conditions:  await SnomedService.shared.searchConditions(query: query)
        case .medications: await SnomedService.shared.searchMedications(query: query)
        case .allergens:   await SnomedService.shared.searchAllergens(query: query)
        }
    }
}
