import SwiftUI
import SwiftData
import PDFKit

/// Detail view for a single lab result.
///
/// Shows the rendered PDF (via `PDFKitView`) alongside the extracted
/// structured values. Users can add or edit notes.
@MainActor
struct LabResultDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var result: LabResult

    @State private var showPDF        = false
    @State private var editingNotes   = false
    @State private var draftNotes     = ""

    var body: some View {
        List {
            // MARK: Header card
            headerSection

            // MARK: Structured values
            if let values = result.structuredValues, !values.isEmpty {
                valuesSection(values)
            }

            // MARK: PDF viewer button
            if result.pdfData != nil {
                pdfSection
            }

            // MARK: Notes
            notesSection
        }
        .listStyle(.insetGrouped)
        .navigationTitle(result.fileName)
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showPDF) {
            if let data = result.pdfData {
                PDFViewerSheet(data: data, title: result.fileName)
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        Section {
            HStack(spacing: 16) {
                Image(systemName: result.labCategory.icon)
                    .font(.title2)
                    .foregroundStyle(DesignTokens.Colors.labResults)
                    .frame(width: 44)

                VStack(alignment: .leading, spacing: 4) {
                    Text(result.labCategory.displayName)
                        .font(.headline)
                    Text(result.formattedDate)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 6)
        }
    }

    // MARK: - Structured values table

    @ViewBuilder
    private func valuesSection(_ values: [String: LabValue]) -> some View {
        Section {
            ForEach(values.keys.sorted(), id: \.self) { name in
                if let val = values[name] {
                    LabValueRow(name: name, value: val)
                }
            }
        } header: {
            Text(String(localized: "lab.detail.section.values"))
        }
    }

    // MARK: - PDF section

    private var pdfSection: some View {
        Section {
            Button {
                showPDF = true
            } label: {
                HStack {
                    Image(systemName: "doc.richtext.fill")
                        .foregroundStyle(DesignTokens.Colors.labResults)
                    Text(String(localized: "lab.detail.viewPDF"))
                        .foregroundStyle(DesignTokens.Colors.labResults)
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Notes

    private var notesSection: some View {
        Section(String(localized: "lab.detail.section.notes")) {
            if editingNotes {
                TextEditor(text: $draftNotes)
                    .frame(minHeight: 80)
                HStack {
                    Button(String(localized: "common.cancel")) {
                        editingNotes = false
                        draftNotes = result.notes ?? ""
                    }
                    .foregroundStyle(.secondary)
                    Spacer()
                    Button(String(localized: "common.save")) {
                        result.notes = draftNotes.isEmpty ? nil : draftNotes
                        try? modelContext.save()
                        editingNotes = false
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(DesignTokens.Colors.labResults)
                }
                .buttonStyle(.plain)
            } else {
                if let notes = result.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                } else {
                    Text(String(localized: "lab.detail.notesPlaceholder"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Button(result.notes == nil ? String(localized: "lab.detail.addNotes") : String(localized: "lab.detail.editNotes")) {
                    draftNotes = result.notes ?? ""
                    editingNotes = true
                }
                .font(.caption)
                .foregroundStyle(DesignTokens.Colors.labResults)
            }
        }
    }
}

// MARK: - LabValueRow

private struct LabValueRow: View {
    let name: String
    let value: LabValue

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.subheadline)
                if let loinc = value.loincCode {
                    Text("LOINC \(loinc)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let ref = value.referenceRange {
                    Text(ref)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text(formattedValue)
                        .font(.subheadline.bold().monospacedDigit())
                    Text(value.unit)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if let flag = value.flag {
                    Text(flag.displayName)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(flag.color.opacity(0.15))
                        .foregroundStyle(flag.color)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var formattedValue: String {
        value.value.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", value.value)
            : String(format: "%.2f", value.value)
    }
}

// MARK: - LabCategory icon helper (shared with LabResultsView)
// (Defined in LabResultsView.swift to avoid redeclaration)

// MARK: - PDFViewerSheet

/// Full-screen PDF viewer using UIKit's PDFView wrapped in SwiftUI.
private struct PDFViewerSheet: View {
    let data: Data
    let title: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            PDFKitView(data: data)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(String(localized: "common.done")) { dismiss() }
                    }
                }
        }
    }
}

// MARK: - PDFKitView (UIViewRepresentable)

private struct PDFKitView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.document = PDFDocument(data: data)
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}
}

// MARK: - Preview

#Preview {
    NavigationStack {
        LabResultDetailView(result: LabResult(
            fileName: "Blood Panel 2025-01",
            date: "2025-01-15",
            category: .bloodPanel,
            structuredValues: [
                "Hemoglobin": LabValue(value: 14.2, unit: "g/dL", flag: .normal, referenceRange: "13.5-17.5", loincCode: "718-7"),
                "WBC":        LabValue(value: 6.8,  unit: "K/μL", flag: .normal, referenceRange: "4.5-11.0",  loincCode: "6690-2"),
                "Platelets":  LabValue(value: 220,  unit: "K/μL", flag: .normal, referenceRange: "150-400",   loincCode: "777-3"),
            ]
        ))
        .modelContainer(for: LabResult.self, inMemory: true)
    }
}
