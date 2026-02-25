import SwiftUI
import SwiftData

/// Lab Results list — shows uploaded PDFs sorted newest-first.
///
/// Toolbar has an Add button (file importer) and a Timeline button.
/// Swipe-to-delete removes the record and its stored PDF data.
@MainActor
struct LabResultsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \LabResult.date, order: .reverse)
    private var labResults: [LabResult]

    @State private var showAdd    = false
    @State private var showTimeline = false
    @State private var selectedResult: LabResult?

    var body: some View {
        Group {
            if labResults.isEmpty {
                emptyState
            } else {
                resultList
            }
        }
        .navigationTitle(String(localized: "lab.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItemGroup(placement: .navigationBarTrailing) {
                Button {
                    showTimeline = true
                } label: {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .accessibilityLabel(String(localized: "lab.timeline.title"))
                }
                .disabled(labResults.isEmpty)

                Button {
                    showAdd = true
                } label: {
                    Image(systemName: "plus")
                        .accessibilityLabel(String(localized: "lab.add.title"))
                }
            }
        }
        .sheet(isPresented: $showAdd) {
            AddLabResultView()
        }
        .sheet(isPresented: $showTimeline) {
            LabTimelineView()
        }
        .navigationDestination(item: $selectedResult) { result in
            LabResultDetailView(result: result)
        }
    }

    // MARK: - List

    private var resultList: some View {
        List {
            // Group by year for readability when there are many results
            ForEach(groupedByYear, id: \.year) { group in
                Section {
                    ForEach(group.results) { result in
                        LabResultRow(result: result)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedResult = result }
                    }
                    .onDelete { offsets in
                        deleteResults(group.results, at: offsets)
                    }
                } header: {
                    Text(group.year)
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "testtube.2")
                .font(.system(size: 52))
                .foregroundStyle(DesignTokens.Colors.labResults.opacity(0.35))

            Text(String(localized: "lab.empty.title"))
                .font(.headline)

            Text(String(localized: "lab.empty.message"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button(String(localized: "lab.add.title")) {
                showAdd = true
            }
            .buttonStyle(.borderedProminent)
            .tint(DesignTokens.Colors.labResults)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Grouping

    private struct YearGroup {
        let year: String
        let results: [LabResult]
    }

    private var groupedByYear: [YearGroup] {
        let cal = Calendar.current
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withFullDate]

        var byYear: [String: [LabResult]] = [:]
        for result in labResults {
            let date = isoFormatter.date(from: result.date) ?? .now
            let year = String(cal.component(.year, from: date))
            byYear[year, default: []].append(result)
        }
        return byYear
            .map { YearGroup(year: $0.key, results: $0.value) }
            .sorted { $0.year > $1.year }
    }

    // MARK: - Delete

    private func deleteResults(_ results: [LabResult], at offsets: IndexSet) {
        for idx in offsets {
            modelContext.delete(results[idx])
        }
        try? modelContext.save()
    }
}

// MARK: - Lab Result Row

private struct LabResultRow: View {
    let result: LabResult

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: result.labCategory.icon)
                .font(.title3)
                .foregroundStyle(DesignTokens.Colors.labResults)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 3) {
                Text(result.fileName)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                HStack(spacing: 8) {
                    Text(result.labCategory.displayName)
                        .font(.caption)
                        .foregroundStyle(DesignTokens.Colors.labResults)
                    Text("·")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Text(result.formattedDate)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            if let count = result.structuredValues?.count, count > 0 {
                Text("\(count)")
                    .font(.caption2.bold())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(DesignTokens.Colors.labResults.opacity(0.12))
                    .foregroundStyle(DesignTokens.Colors.labResults)
                    .clipShape(Capsule())
            }

            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - LabCategory icon helper

extension LabCategory {
    var icon: String {
        switch self {
        case .bloodPanel:  "drop.fill"
        case .lipidPanel:  "heart.fill"
        case .thyroid:     "waveform"
        case .metabolic:   "bolt.fill"
        case .other:       "testtube.2"
        }
    }
}

// MARK: - LabResult helpers

extension LabResult {
    var formattedDate: String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withFullDate]
        guard let date = isoFormatter.date(from: self.date) else { return self.date }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        LabResultsView()
            .modelContainer(for: LabResult.self, inMemory: true)
    }
}
