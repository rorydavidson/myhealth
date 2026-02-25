import SwiftUI
import SwiftData

// MARK: - List View

@MainActor
struct ConditionsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \ClinicalCondition.createdAt, order: .reverse)
    private var conditions: [ClinicalCondition]

    @State private var showingAdd      = false
    @State private var editTarget:     ClinicalCondition? = nil
    @State private var deleteTarget:   ClinicalCondition? = nil
    @State private var showDeleteAlert = false

    var body: some View {
        List {
            if conditions.isEmpty {
                EmptyStateView(
                    icon: "cross.case",
                    title: String(localized: "conditions.empty.title"),
                    message: String(localized: "conditions.empty.message"),
                    category: .vitals
                )
                .listRowBackground(Color.clear)
                .listRowInsets(.init())
            } else {
                ForEach(conditions) { condition in
                    ConditionRow(condition: condition)
                        .swipeActions(edge: .leading, allowsFullSwipe: false) {
                            Button {
                                editTarget = condition
                            } label: {
                                Label(String(localized: "common.edit"), systemImage: "pencil")
                            }
                            .tint(.blue)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                deleteTarget   = condition
                                showDeleteAlert = true
                            } label: {
                                Label(String(localized: "common.delete"), systemImage: "trash")
                            }
                        }
                }
            }
        }
        .navigationTitle(String(localized: "conditions.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingAdd = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAdd) {
            AddConditionView()
        }
        .sheet(item: $editTarget) { condition in
            EditConditionView(condition: condition)
        }
        .alert(String(localized: "common.delete.confirm.title"), isPresented: $showDeleteAlert) {
            Button(String(localized: "common.delete"), role: .destructive) {
                if let target = deleteTarget {
                    modelContext.delete(target)
                }
            }
            Button(String(localized: "common.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "conditions.delete.message"))
        }
    }
}

// MARK: - Row

private struct ConditionRow: View {
    let condition: ClinicalCondition

    /// nil  → summary is still being generated (show spinner)
    /// ""   → generation failed or skipped (show nothing)
    /// text → show the summary
    private var summaryState: SummaryState {
        switch condition.aiSummary {
        case nil:         return .generating
        case "":          return .unavailable
        case let s?:      return .ready(s)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(condition.snomedDisplay)
                    .font(.subheadline.weight(.medium))
                Spacer()
                StatusBadge(status: condition.conditionStatus)
            }
            HStack(spacing: 8) {
                Text(condition.snomedCode)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                if let onset = condition.onsetDate {
                    Text("·")
                        .foregroundStyle(.tertiary)
                    Text(String(localized: "conditions.onset \(onset)"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            // AI summary
            switch summaryState {
            case .generating:
                HStack(spacing: 4) {
                    Image(systemName: "sparkles")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(String(localized: "clinical.ai.generating"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ProgressView()
                        .progressViewStyle(.circular)
                        .scaleEffect(0.6)
                }
                .padding(.top, 2)

            case .ready(let summary):
                HStack(alignment: .top, spacing: 4) {
                    Image(systemName: "sparkles")
                        .font(.caption2)
                        .foregroundStyle(DesignTokens.Colors.vitals)
                        .padding(.top, 1)
                    Text(summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 2)

            case .unavailable:
                EmptyView()
            }

            if let notes = condition.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .padding(.top, summaryState == .unavailable ? 0 : 2)
            }
        }
        .padding(.vertical, 2)
    }
}

private enum SummaryState: Equatable {
    case generating
    case ready(String)
    case unavailable
}

// MARK: - Status Badge

private struct StatusBadge: View {
    let status: ConditionStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(badgeColor.opacity(0.15))
            .foregroundStyle(badgeColor)
            .clipShape(Capsule())
    }

    private var badgeColor: Color {
        switch status {
        case .active:   DesignTokens.Colors.positive
        case .resolved: DesignTokens.Colors.neutral
        case .inactive: DesignTokens.Colors.warning
        }
    }
}

// MARK: - Add View

@MainActor
struct AddConditionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var selectedConcept: SnomedConcept? = nil
    @State private var status:    ConditionStatus = .active
    @State private var onsetDate: Date?           = nil
    @State private var hasOnset:  Bool            = false
    @State private var notes:     String          = ""

    private var canSave: Bool { selectedConcept != nil }

    var body: some View {
        NavigationStack {
            Form {
                // SNOMED search
                Section {
                    SnomedSearchField(
                        placeholder: String(localized: "conditions.add.searchPlaceholder"),
                        searchMode: .conditions,
                        selection: $selectedConcept
                    )
                    .listRowInsets(.init(top: 8, leading: 16, bottom: 8, trailing: 16))
                } header: {
                    Text(String(localized: "conditions.add.section.condition"))
                } footer: {
                    Text(String(localized: "conditions.add.section.conditionFooter"))
                }

                // Details
                Section(String(localized: "conditions.add.section.details")) {
                    Picker(String(localized: "conditions.add.status"), selection: $status) {
                        ForEach(ConditionStatus.allCases, id: \.self) { s in
                            Text(s.displayName).tag(s)
                        }
                    }

                    Toggle(String(localized: "conditions.add.hasOnset"), isOn: $hasOnset)

                    if hasOnset {
                        DatePicker(
                            String(localized: "conditions.add.onsetDate"),
                            selection: Binding(
                                get: { onsetDate ?? .now },
                                set: { onsetDate = $0 }
                            ),
                            in: ...Date.now,
                            displayedComponents: .date
                        )
                        .onAppear { if onsetDate == nil { onsetDate = .now } }
                    }
                }

                // Notes
                Section(String(localized: "conditions.add.section.notes")) {
                    TextField(
                        String(localized: "conditions.add.notesPlaceholder"),
                        text: $notes,
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                }
            }
            .navigationTitle(String(localized: "conditions.add.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "common.cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(String(localized: "common.save")) { save() }
                        .disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        guard let concept = selectedConcept else { return }

        let isoOnset: String? = hasOnset && onsetDate != nil
            ? {
                let fmt = ISO8601DateFormatter()
                fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
                return fmt.string(from: onsetDate!)
            }()
            : nil

        let condition = ClinicalCondition(
            snomedCode:    concept.code,
            snomedDisplay: concept.display,
            status:        status,
            onsetDate:     isoOnset,
            notes:         notes.isEmpty ? nil : notes
        )
        modelContext.insert(condition)
        dismiss()

        let code    = concept.code
        let display = concept.display
        let modelID = condition.persistentModelID
        Task {
            let summary = await ConceptSummaryService.shared.summarise(
                code:    code,
                display: display,
                type:    .condition
            )
            if let saved = modelContext.registeredModel(for: modelID) as ClinicalCondition? {
                saved.aiSummary = summary ?? ""
            }
        }
    }
}

// MARK: - Edit View

@MainActor
struct EditConditionView: View {
    @Environment(\.dismiss) private var dismiss

    /// Direct reference to the SwiftData object — mutations are reflected immediately.
    @Bindable var condition: ClinicalCondition

    // Local editing state initialised from the model
    @State private var status:    ConditionStatus
    @State private var hasOnset:  Bool
    @State private var onsetDate: Date
    @State private var notes:     String

    init(condition: ClinicalCondition) {
        self.condition = condition
        _status   = State(initialValue: condition.conditionStatus)
        _hasOnset = State(initialValue: condition.onsetDate != nil)
        _notes    = State(initialValue: condition.notes ?? "")

        // Parse stored ISO date string back to Date for the picker
        if let iso = condition.onsetDate {
            let fmt = ISO8601DateFormatter()
            fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
            _onsetDate = State(initialValue: fmt.date(from: iso) ?? .now)
        } else {
            _onsetDate = State(initialValue: .now)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                // Read-only concept pill — concept identity cannot be changed on edit
                Section {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(DesignTokens.Colors.vitals)
                            .font(.caption)
                        Text(condition.snomedDisplay)
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        Text(condition.snomedCode)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                } header: {
                    Text(String(localized: "conditions.add.section.condition"))
                } footer: {
                    Text(String(localized: "conditions.edit.conceptLocked"))
                }

                // Mutable details
                Section(String(localized: "conditions.add.section.details")) {
                    Picker(String(localized: "conditions.add.status"), selection: $status) {
                        ForEach(ConditionStatus.allCases, id: \.self) { s in
                            Text(s.displayName).tag(s)
                        }
                    }

                    Toggle(String(localized: "conditions.add.hasOnset"), isOn: $hasOnset)

                    if hasOnset {
                        DatePicker(
                            String(localized: "conditions.add.onsetDate"),
                            selection: $onsetDate,
                            in: ...Date.now,
                            displayedComponents: .date
                        )
                    }
                }

                // Notes
                Section(String(localized: "conditions.add.section.notes")) {
                    TextField(
                        String(localized: "conditions.add.notesPlaceholder"),
                        text: $notes,
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                }
            }
            .navigationTitle(String(localized: "conditions.edit.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "common.cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(String(localized: "common.save")) { save() }
                }
            }
        }
    }

    private func save() {
        condition.status = status.rawValue

        if hasOnset {
            let fmt = ISO8601DateFormatter()
            fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
            condition.onsetDate = fmt.string(from: onsetDate)
        } else {
            condition.onsetDate = nil
        }

        condition.notes = notes.isEmpty ? nil : notes
        dismiss()
    }
}
