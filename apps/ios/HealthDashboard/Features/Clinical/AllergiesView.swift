import SwiftUI
import SwiftData

// MARK: - List View

@MainActor
struct AllergiesView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Allergy.createdAt, order: .reverse)
    private var allergies: [Allergy]

    @State private var showingAdd      = false
    @State private var editTarget:     Allergy? = nil
    @State private var deleteTarget:   Allergy? = nil
    @State private var showDeleteAlert = false

    var body: some View {
        List {
            if allergies.isEmpty {
                EmptyStateView(
                    icon: "allergens",
                    title: String(localized: "allergies.empty.title"),
                    message: String(localized: "allergies.empty.message"),
                    category: .vitals
                )
                .listRowBackground(Color.clear)
                .listRowInsets(.init())
            } else {
                ForEach(allergies) { allergy in
                    AllergyRow(allergy: allergy)
                        .swipeActions(edge: .leading, allowsFullSwipe: false) {
                            Button {
                                editTarget = allergy
                            } label: {
                                Label(String(localized: "common.edit"), systemImage: "pencil")
                            }
                            .tint(.blue)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                deleteTarget   = allergy
                                showDeleteAlert = true
                            } label: {
                                Label(String(localized: "common.delete"), systemImage: "trash")
                            }
                        }
                }
            }
        }
        .navigationTitle(String(localized: "allergies.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showingAdd) {
            AddAllergyView()
        }
        .sheet(item: $editTarget) { allergy in
            EditAllergyView(allergy: allergy)
        }
        .alert(String(localized: "common.delete.confirm.title"), isPresented: $showDeleteAlert) {
            Button(String(localized: "common.delete"), role: .destructive) {
                if let target = deleteTarget { modelContext.delete(target) }
            }
            Button(String(localized: "common.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "allergies.delete.message"))
        }
    }
}

// MARK: - Row

private struct AllergyRow: View {
    let allergy: Allergy

    /// nil  → summary is still being generated (show spinner)
    /// ""   → generation failed or skipped (show nothing)
    /// text → show the summary
    private var summaryState: SummaryState {
        switch allergy.aiSummary {
        case nil:    return .generating
        case "":     return .unavailable
        case let s?: return .ready(s)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(allergy.snomedDisplay)
                    .font(.subheadline.weight(.medium))
                Spacer()
                CriticalityBadge(criticality: allergy.allergyCriticality)
            }
            HStack(spacing: 8) {
                Text(allergy.snomedCode)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                Text("·")
                    .foregroundStyle(.tertiary)
                Text(allergy.allergyType.displayName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("·")
                    .foregroundStyle(.tertiary)
                Text(allergy.allergyCategory.displayName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
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
                        .foregroundStyle(DesignTokens.Colors.heart)
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

            if let reaction = allergy.reaction, !reaction.isEmpty {
                Text(String(localized: "allergies.reaction \(reaction)"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .padding(.top, summaryState == .unavailable ? 0 : 2)
            }

            if let notes = allergy.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
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

// MARK: - Criticality Badge

private struct CriticalityBadge: View {
    let criticality: AllergyCriticality

    var body: some View {
        Text(criticality.displayName)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(badgeColor.opacity(0.15))
            .foregroundStyle(badgeColor)
            .clipShape(Capsule())
    }

    private var badgeColor: Color {
        switch criticality {
        case .high:           DesignTokens.Colors.negative
        case .low:            DesignTokens.Colors.neutral
        case .unableToAssess: DesignTokens.Colors.warning
        }
    }
}

// MARK: - Add View

@MainActor
struct AddAllergyView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var selectedConcept: SnomedConcept?    = nil
    @State private var type:       AllergyType            = .allergy
    @State private var category:   AllergyCategory        = .medication
    @State private var criticality: AllergyCriticality    = .unableToAssess
    @State private var reaction:   String                 = ""
    @State private var hasOnset:   Bool                   = false
    @State private var onsetDate:  Date                   = .now
    @State private var notes:      String                 = ""

    private var canSave: Bool { selectedConcept != nil }

    var body: some View {
        NavigationStack {
            Form {
                // SNOMED search
                Section {
                    SnomedSearchField(
                        placeholder: String(localized: "allergies.add.searchPlaceholder"),
                        searchMode: .allergens,
                        selection: $selectedConcept
                    )
                    .listRowInsets(.init(top: 8, leading: 16, bottom: 8, trailing: 16))
                } header: {
                    Text(String(localized: "allergies.add.section.allergen"))
                } footer: {
                    Text(String(localized: "allergies.add.section.allergenFooter"))
                }

                // Details
                Section(String(localized: "allergies.add.section.details")) {
                    Picker(String(localized: "allergies.add.type"), selection: $type) {
                        ForEach(AllergyType.allCases, id: \.self) { t in
                            Text(t.displayName).tag(t)
                        }
                    }

                    Picker(String(localized: "allergies.add.category"), selection: $category) {
                        ForEach(AllergyCategory.allCases, id: \.self) { c in
                            Text(c.displayName).tag(c)
                        }
                    }

                    Picker(String(localized: "allergies.add.criticality"), selection: $criticality) {
                        ForEach(AllergyCriticality.allCases, id: \.self) { c in
                            Text(c.displayName).tag(c)
                        }
                    }

                    TextField(String(localized: "allergies.add.reaction"), text: $reaction)

                    Toggle(String(localized: "allergies.add.hasOnset"), isOn: $hasOnset)
                    if hasOnset {
                        DatePicker(
                            String(localized: "allergies.add.onsetDate"),
                            selection: $onsetDate,
                            in: ...Date.now,
                            displayedComponents: .date
                        )
                    }
                }

                // Notes
                Section(String(localized: "allergies.add.section.notes")) {
                    TextField(
                        String(localized: "allergies.add.notesPlaceholder"),
                        text: $notes,
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                }
            }
            .navigationTitle(String(localized: "allergies.add.title"))
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
        let allergy = Allergy(
            snomedCode:    concept.code,
            snomedDisplay: concept.display,
            type:          type,
            category:      category,
            criticality:   criticality,
            reaction:      reaction.isEmpty ? nil : reaction,
            onsetDate:     hasOnset ? {
                let fmt = ISO8601DateFormatter()
                fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
                return fmt.string(from: onsetDate)
            }() : nil,
            notes:         notes.isEmpty ? nil : notes
        )
        modelContext.insert(allergy)
        dismiss()

        let code    = concept.code
        let display = concept.display
        let modelID = allergy.persistentModelID
        Task {
            let summary = await ConceptSummaryService.shared.summarise(
                code:    code,
                display: display,
                type:    .allergen
            )
            if let saved = modelContext.registeredModel(for: modelID) as Allergy? {
                saved.aiSummary = summary ?? ""
            }
        }
    }
}

// MARK: - Edit View

@MainActor
struct EditAllergyView: View {
    @Environment(\.dismiss) private var dismiss

    /// Direct reference to the SwiftData object — mutations are reflected immediately.
    @Bindable var allergy: Allergy

    // Local editing state initialised from the model
    @State private var type:        AllergyType
    @State private var category:    AllergyCategory
    @State private var criticality: AllergyCriticality
    @State private var reaction:    String
    @State private var hasOnset:    Bool
    @State private var onsetDate:   Date
    @State private var notes:       String

    init(allergy: Allergy) {
        self.allergy = allergy
        _type        = State(initialValue: allergy.allergyType)
        _category    = State(initialValue: allergy.allergyCategory)
        _criticality = State(initialValue: allergy.allergyCriticality)
        _reaction    = State(initialValue: allergy.reaction ?? "")
        _notes       = State(initialValue: allergy.notes ?? "")
        _hasOnset    = State(initialValue: allergy.onsetDate != nil)

        if let iso = allergy.onsetDate {
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
                // Read-only concept pill
                Section {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(DesignTokens.Colors.heart)
                            .font(.caption)
                        Text(allergy.snomedDisplay)
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        Text(allergy.snomedCode)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                } header: {
                    Text(String(localized: "allergies.add.section.allergen"))
                } footer: {
                    Text(String(localized: "allergies.edit.conceptLocked"))
                }

                // Mutable details
                Section(String(localized: "allergies.add.section.details")) {
                    Picker(String(localized: "allergies.add.type"), selection: $type) {
                        ForEach(AllergyType.allCases, id: \.self) { t in
                            Text(t.displayName).tag(t)
                        }
                    }

                    Picker(String(localized: "allergies.add.category"), selection: $category) {
                        ForEach(AllergyCategory.allCases, id: \.self) { c in
                            Text(c.displayName).tag(c)
                        }
                    }

                    Picker(String(localized: "allergies.add.criticality"), selection: $criticality) {
                        ForEach(AllergyCriticality.allCases, id: \.self) { c in
                            Text(c.displayName).tag(c)
                        }
                    }

                    TextField(String(localized: "allergies.add.reaction"), text: $reaction)

                    Toggle(String(localized: "allergies.add.hasOnset"), isOn: $hasOnset)
                    if hasOnset {
                        DatePicker(
                            String(localized: "allergies.add.onsetDate"),
                            selection: $onsetDate,
                            in: ...Date.now,
                            displayedComponents: .date
                        )
                    }
                }

                // Notes
                Section(String(localized: "allergies.add.section.notes")) {
                    TextField(
                        String(localized: "allergies.add.notesPlaceholder"),
                        text: $notes,
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                }
            }
            .navigationTitle(String(localized: "allergies.edit.title"))
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
        allergy.type        = type.rawValue
        allergy.category    = category.rawValue
        allergy.criticality = criticality.rawValue
        allergy.reaction    = reaction.isEmpty ? nil : reaction
        allergy.notes       = notes.isEmpty ? nil : notes

        if hasOnset {
            let fmt = ISO8601DateFormatter()
            fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
            allergy.onsetDate = fmt.string(from: onsetDate)
        } else {
            allergy.onsetDate = nil
        }

        dismiss()
    }
}
