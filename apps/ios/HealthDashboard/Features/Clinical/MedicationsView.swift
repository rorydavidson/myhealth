import SwiftUI
import SwiftData

// MARK: - List View

@MainActor
struct MedicationsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Medication.createdAt, order: .reverse)
    private var medications: [Medication]

    @State private var showingAdd      = false
    @State private var deleteTarget:   Medication? = nil
    @State private var showDeleteAlert = false

    var body: some View {
        List {
            if medications.isEmpty {
                EmptyStateView(
                    icon: "pill",
                    title: String(localized: "medications.empty.title"),
                    message: String(localized: "medications.empty.message"),
                    category: .vitals
                )
                .listRowBackground(Color.clear)
                .listRowInsets(.init())
            } else {
                ForEach(medications) { medication in
                    MedicationRow(medication: medication)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                deleteTarget   = medication
                                showDeleteAlert = true
                            } label: {
                                Label(String(localized: "common.delete"), systemImage: "trash")
                            }
                        }
                }
            }
        }
        .navigationTitle(String(localized: "medications.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showingAdd) {
            AddMedicationView()
        }
        .alert(String(localized: "common.delete.confirm.title"), isPresented: $showDeleteAlert) {
            Button(String(localized: "common.delete"), role: .destructive) {
                if let target = deleteTarget { modelContext.delete(target) }
            }
            Button(String(localized: "common.cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "medications.delete.message"))
        }
    }
}

// MARK: - Row

private struct MedicationRow: View {
    let medication: Medication

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(medication.snomedDisplay)
                    .font(.subheadline.weight(.medium))
                Spacer()
                MedStatusBadge(status: medication.medicationStatus)
            }
            HStack(spacing: 8) {
                Text(medication.snomedCode)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                if let dose = medication.dose {
                    Text("·")
                        .foregroundStyle(.tertiary)
                    Text(dose)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if let start = medication.startDate {
                Text(medication.isOngoing
                     ? String(localized: "medications.since \(start)")
                     : String(localized: "medications.period \(start) \(medication.endDate ?? "")"))
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            if let notes = medication.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Status Badge

private struct MedStatusBadge: View {
    let status: MedicationStatus

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
        case .active:  DesignTokens.Colors.positive
        case .stopped: DesignTokens.Colors.neutral
        case .onHold:  DesignTokens.Colors.warning
        }
    }
}

// MARK: - Add View

@MainActor
struct AddMedicationView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var selectedConcept: SnomedConcept? = nil
    @State private var dose:       String          = ""
    @State private var status:     MedicationStatus = .active
    @State private var reason:     String          = ""
    @State private var notes:      String          = ""
    @State private var hasStart:   Bool            = false
    @State private var startDate:  Date            = .now
    @State private var isOngoing:  Bool            = true
    @State private var endDate:    Date            = .now

    private var canSave: Bool { selectedConcept != nil }

    var body: some View {
        NavigationStack {
            Form {
                // SNOMED search
                Section {
                    SnomedSearchField(
                        placeholder: String(localized: "medications.add.searchPlaceholder"),
                        searchMode: .medications,
                        selection: $selectedConcept
                    )
                    .listRowInsets(.init(top: 8, leading: 16, bottom: 8, trailing: 16))
                } header: {
                    Text(String(localized: "medications.add.section.medication"))
                } footer: {
                    Text(String(localized: "medications.add.section.medicationFooter"))
                }

                // Details
                Section(String(localized: "medications.add.section.details")) {
                    TextField(String(localized: "medications.add.dose"), text: $dose)

                    Picker(String(localized: "medications.add.status"), selection: $status) {
                        ForEach(MedicationStatus.allCases, id: \.self) { s in
                            Text(s.displayName).tag(s)
                        }
                    }

                    Toggle(String(localized: "medications.add.hasStart"), isOn: $hasStart)

                    if hasStart {
                        DatePicker(
                            String(localized: "medications.add.startDate"),
                            selection: $startDate,
                            in: ...Date.now,
                            displayedComponents: .date
                        )

                        Toggle(String(localized: "medications.add.ongoing"), isOn: $isOngoing)

                        if !isOngoing {
                            DatePicker(
                                String(localized: "medications.add.endDate"),
                                selection: $endDate,
                                in: startDate...Date.now,
                                displayedComponents: .date
                            )
                        }
                    }

                    TextField(String(localized: "medications.add.reason"), text: $reason)
                }

                // Notes
                Section(String(localized: "medications.add.section.notes")) {
                    TextField(
                        String(localized: "medications.add.notesPlaceholder"),
                        text: $notes,
                        axis: .vertical
                    )
                    .lineLimit(3...6)
                }
            }
            .navigationTitle(String(localized: "medications.add.title"))
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
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
        let medication = Medication(
            snomedCode:    concept.code,
            snomedDisplay: concept.display,
            dose:          dose.isEmpty    ? nil : dose,
            startDate:     hasStart        ? fmt.string(from: startDate) : nil,
            endDate:       hasStart && !isOngoing ? fmt.string(from: endDate) : nil,
            status:        status,
            reason:        reason.isEmpty  ? nil : reason,
            notes:         notes.isEmpty   ? nil : notes
        )
        modelContext.insert(medication)
        dismiss()
    }
}
