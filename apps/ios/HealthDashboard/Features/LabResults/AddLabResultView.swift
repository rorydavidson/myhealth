import SwiftUI
import SwiftData
import PDFKit

/// Sheet for importing a PDF lab report.
///
/// Flow:
/// 1. User picks a PDF via the system file importer.
/// 2. PDF text is extracted on-device via `PDFTextExtractor`.
/// 3. Structured values are parsed and LOINC codes auto-assigned.
/// 4. User reviews/edits the extracted values.
/// 5. Tapping Save writes the `LabResult` to Swift Data.
@MainActor
struct AddLabResultView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    // MARK: Form state

    @State private var fileName    = ""
    @State private var date        = Date.now
    @State private var category    = LabCategory.other
    @State private var notes       = ""

    // MARK: PDF / extraction state

    @State private var pdfData: Data?
    @State private var extractedText: String?
    @State private var structuredValues: [String: LabValue] = [:]
    @State private var isExtracting = false
    @State private var showFilePicker = false
    @State private var extractionError: String?

    // MARK: Edit state for structured values

    @State private var editingValues: [EditableLabValue] = []
    @State private var showAddValue = false
    @State private var newTestName  = ""

    var body: some View {
        NavigationStack {
            Form {
                // MARK: Privacy notice
                privacySection

                // MARK: PDF upload
                pdfSection

                // MARK: Metadata
                if pdfData != nil {
                    metadataSection
                    extractedValuesSection
                    notesSection
                }
            }
            .navigationTitle(String(localized: "lab.add.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(String(localized: "common.cancel")) { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(String(localized: "common.save")) { save() }
                        .fontWeight(.semibold)
                        .disabled(pdfData == nil || fileName.isEmpty || isExtracting)
                }
            }
            .fileImporter(
                isPresented: $showFilePicker,
                allowedContentTypes: [.pdf],
                allowsMultipleSelection: false
            ) { result in
                handleFilePick(result)
            }
            .sheet(isPresented: $showAddValue) {
                addValueSheet
            }
        }
    }

    // MARK: - Sections

    private var privacySection: some View {
        Section {
            HStack(spacing: 10) {
                Image(systemName: "lock.shield.fill")
                    .foregroundStyle(DesignTokens.Colors.positive)
                Text(String(localized: "lab.add.privacy"))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
            .listRowBackground(DesignTokens.Colors.positive.opacity(0.06))
        }
    }

    private var pdfSection: some View {
        Section(String(localized: "lab.add.section.pdf")) {
            if let pdfData, let doc = PDFDocument(data: pdfData) {
                // PDF preview thumbnail
                HStack(spacing: 12) {
                    if let page = doc.page(at: 0) {
                        let thumb = page.thumbnail(of: CGSize(width: 60, height: 80), for: .mediaBox)
                        Image(uiImage: thumb)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 48, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                            )
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(fileName)
                            .font(.subheadline.weight(.medium))
                            .lineLimit(2)
                        Text(String(
                            localized: "lab.add.pdfPageCount \(doc.pageCount)"
                        ))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        if isExtracting {
                            Label(String(localized: "lab.add.extracting"), systemImage: "doc.text.magnifyingglass")
                                .font(.caption)
                                .foregroundStyle(DesignTokens.Colors.labResults)
                        }
                    }
                    Spacer()
                    Button(String(localized: "lab.add.changePDF")) {
                        showFilePicker = true
                    }
                    .font(.caption)
                    .foregroundStyle(DesignTokens.Colors.labResults)
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 4)
            } else {
                Button {
                    showFilePicker = true
                } label: {
                    HStack {
                        Image(systemName: "doc.badge.plus")
                            .foregroundStyle(DesignTokens.Colors.labResults)
                        Text(String(localized: "lab.add.selectPDF"))
                            .foregroundStyle(DesignTokens.Colors.labResults)
                    }
                }

                if let err = extractionError {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(DesignTokens.Colors.negative)
                }
            }
        }
    }

    private var metadataSection: some View {
        Section(String(localized: "lab.add.section.details")) {
            DatePicker(
                String(localized: "lab.add.date"),
                selection: $date,
                displayedComponents: .date
            )

            Picker(String(localized: "lab.add.category"), selection: $category) {
                ForEach(LabCategory.allCases, id: \.self) { cat in
                    Text(cat.displayName).tag(cat)
                }
            }
        }
    }

    private var extractedValuesSection: some View {
        Section {
            if editingValues.isEmpty {
                Text(String(localized: "lab.add.noValues"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach($editingValues) { $item in
                    EditableLabValueRow(item: $item)
                }
                .onDelete { offsets in
                    editingValues.remove(atOffsets: offsets)
                }
            }

            Button {
                newTestName = ""
                showAddValue = true
            } label: {
                Label(String(localized: "lab.add.addValue"), systemImage: "plus.circle.fill")
                    .foregroundStyle(DesignTokens.Colors.labResults)
            }
        } header: {
            Text(String(localized: "lab.add.section.values"))
        } footer: {
            Text(String(localized: "lab.add.section.valuesFooter"))
                .font(.caption)
        }
    }

    private var notesSection: some View {
        Section(String(localized: "lab.add.section.notes")) {
            TextField(
                String(localized: "lab.add.notesPlaceholder"),
                text: $notes,
                axis: .vertical
            )
            .lineLimit(3...6)
        }
    }

    // MARK: - Add value sheet

    private var addValueSheet: some View {
        NavigationStack {
            Form {
                Section(String(localized: "lab.addValue.testName")) {
                    TextField(String(localized: "lab.addValue.testNamePlaceholder"), text: $newTestName)
                }
            }
            .navigationTitle(String(localized: "lab.addValue.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(String(localized: "common.cancel")) { showAddValue = false }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(String(localized: "common.add")) {
                        let name = newTestName.trimmingCharacters(in: .whitespaces)
                        guard !name.isEmpty else { return }
                        let loinc = lookupLoincCode(for: name)
                        editingValues.append(EditableLabValue(
                            name: name,
                            value: 0,
                            unit: "",
                            flag: nil,
                            referenceRange: "",
                            loincCode: loinc?.code ?? ""
                        ))
                        showAddValue = false
                    }
                    .disabled(newTestName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.fraction(0.35)])
    }

    // MARK: - File pick handler

    private func handleFilePick(_ result: Result<[URL], Error>) {
        extractionError = nil
        switch result {
        case .failure(let err):
            extractionError = err.localizedDescription
        case .success(let urls):
            guard let url = urls.first else { return }
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }

            guard let data = try? Data(contentsOf: url) else {
                extractionError = String(localized: "lab.add.error.readFailed")
                return
            }

            fileName = url.deletingPathExtension().lastPathComponent
            pdfData  = data
            isExtracting = true

            Task.detached(priority: .userInitiated) { [data] in
                let text   = PDFTextExtractor.extractText(from: data)
                let values = text.map { PDFTextExtractor.extractStructuredValues(from: $0) } ?? [:]
                await MainActor.run {
                    self.extractedText = text
                    self.structuredValues = values
                    self.editingValues = values.map { name, val in
                        EditableLabValue(
                            name: name,
                            value: val.value,
                            unit: val.unit,
                            flag: val.flag,
                            referenceRange: val.referenceRange ?? "",
                            loincCode: val.loincCode ?? ""
                        )
                    }.sorted { $0.name < $1.name }
                    self.isExtracting = false
                }
            }
        }
    }

    // MARK: - Save

    private func save() {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withFullDate]
        let dateStr = isoFormatter.string(from: date)

        let finalValues: [String: LabValue]? = editingValues.isEmpty ? nil :
            Dictionary(uniqueKeysWithValues: editingValues.map { item in
                let flag: LabValue.LabFlag? = item.flag
                return (item.name, LabValue(
                    value: item.value,
                    unit: item.unit,
                    flag: flag,
                    referenceRange: item.referenceRange.isEmpty ? nil : item.referenceRange,
                    loincCode: item.loincCode.isEmpty ? nil : item.loincCode
                ))
            })

        let record = LabResult(
            fileName: fileName.isEmpty ? "lab-result" : fileName,
            date: dateStr,
            category: category,
            pdfData: pdfData,
            extractedText: extractedText,
            structuredValues: finalValues,
            notes: notes.isEmpty ? nil : notes
        )

        modelContext.insert(record)
        try? modelContext.save()
        dismiss()
    }
}

// MARK: - EditableLabValue

/// Mutable wrapper around `LabValue` for the review step.
@Observable
final class EditableLabValue: Identifiable {
    let id = UUID()
    var name: String
    var value: Double
    var unit: String
    var flag: LabValue.LabFlag?
    var referenceRange: String
    var loincCode: String

    init(name: String, value: Double, unit: String, flag: LabValue.LabFlag?,
         referenceRange: String, loincCode: String) {
        self.name = name
        self.value = value
        self.unit = unit
        self.flag = flag
        self.referenceRange = referenceRange
        self.loincCode = loincCode
    }
}

// MARK: - EditableLabValueRow

private struct EditableLabValueRow: View {
    @Binding var item: EditableLabValue

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Test name + optional LOINC badge
            HStack {
                Text(item.name)
                    .font(.subheadline.weight(.medium))
                if !item.loincCode.isEmpty {
                    Text("LOINC \(item.loincCode)")
                        .font(.caption2)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(DesignTokens.Colors.labResults.opacity(0.10))
                        .foregroundStyle(DesignTokens.Colors.labResults)
                        .clipShape(Capsule())
                }
                Spacer()
                flagPicker
            }

            // Value + unit inline
            HStack(spacing: 8) {
                TextField("0", value: $item.value, format: .number)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)

                TextField(String(localized: "lab.add.unit"), text: $item.unit)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)

                Spacer()
            }

            // Reference range
            TextField(
                String(localized: "lab.add.refRange"),
                text: $item.referenceRange
            )
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private var flagPicker: some View {
        Menu {
            Button(String(localized: "lab.flag.normal"))   { item.flag = .normal }
            Button(String(localized: "lab.flag.high"))     { item.flag = .high }
            Button(String(localized: "lab.flag.low"))      { item.flag = .low }
            Button(String(localized: "lab.flag.critical")) { item.flag = .critical }
            Button(String(localized: "lab.flag.none"))     { item.flag = nil }
        } label: {
            if let flag = item.flag {
                Text(flag.displayName)
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(flag.color.opacity(0.15))
                    .foregroundStyle(flag.color)
                    .clipShape(Capsule())
            } else {
                Text(String(localized: "lab.flag.none"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - LabValue.LabFlag display helpers

extension LabValue.LabFlag {
    var displayName: String {
        switch self {
        case .normal:   String(localized: "lab.flag.normal")
        case .high:     String(localized: "lab.flag.high")
        case .low:      String(localized: "lab.flag.low")
        case .critical: String(localized: "lab.flag.critical")
        }
    }

    var color: Color {
        switch self {
        case .normal:   DesignTokens.Colors.positive
        case .high:     DesignTokens.Colors.negative
        case .low:      DesignTokens.Colors.warning
        case .critical: DesignTokens.Colors.negative
        }
    }
}
