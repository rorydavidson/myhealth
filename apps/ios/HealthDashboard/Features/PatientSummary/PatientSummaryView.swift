import SwiftUI
import SwiftData

/// International Patient Summary hub.
///
/// Shows counts of user-entered clinical data (conditions, medications, allergies),
/// navigation links into each sub-screen, and the IPS export flow.
@MainActor
struct PatientSummaryView: View {
    @Environment(\.modelContext) private var modelContext

    @Query private var conditions: [ClinicalCondition]
    @Query private var medications: [Medication]
    @Query private var allergies: [Allergy]

    @State private var showIPSSetup     = false
    @State private var isGenerating     = false
    @State private var generatedBundle: FHIRBundle?
    @State private var previewData: IPSPreviewData?
    @State private var showPreview      = false
    @State private var generationError: String?

    var body: some View {
        List {
            // Clinical data sections
            Section(String(localized: "summary.section.clinical")) {
                NavigationLink(destination: ConditionsView()) {
                    ClinicalSectionRow(
                        icon: "cross.case.fill",
                        label: String(localized: "conditions.title"),
                        count: conditions.count,
                        color: DesignTokens.Colors.vitals
                    )
                }

                NavigationLink(destination: MedicationsView()) {
                    ClinicalSectionRow(
                        icon: "pill.fill",
                        label: String(localized: "medications.title"),
                        count: medications.count,
                        color: DesignTokens.Colors.activity
                    )
                }

                NavigationLink(destination: AllergiesView()) {
                    ClinicalSectionRow(
                        icon: "allergens",
                        label: String(localized: "allergies.title"),
                        count: allergies.count,
                        color: DesignTokens.Colors.heart
                    )
                }
            }

            // IPS Export section
            Section {
                if isGenerating {
                    HStack(spacing: 12) {
                        ProgressView()
                            .progressViewStyle(.circular)
                        Text(String(localized: "ips.generating"))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                } else if let bundle = generatedBundle, let preview = previewData {
                    // Preview / re-export after generation
                    NavigationLink(destination: IPSPreviewView(data: preview, bundle: bundle)) {
                        HStack(spacing: DesignTokens.Spacing.sm) {
                            Image(systemName: "doc.text.fill")
                                .foregroundStyle(DesignTokens.Colors.labResults)
                                .frame(width: 28)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(String(localized: "summary.export.ips"))
                                    .font(.body)
                                Text(String(localized: "summary.export.viewPreview"))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Button(role: .destructive) {
                        generatedBundle = nil
                        previewData = nil
                    } label: {
                        Label(String(localized: "ips.reset"), systemImage: "arrow.counterclockwise")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    // Generate IPS button
                    Button {
                        showIPSSetup = true
                    } label: {
                        HStack(spacing: DesignTokens.Spacing.sm) {
                            Image(systemName: "doc.badge.plus")
                                .foregroundStyle(DesignTokens.Colors.labResults)
                                .frame(width: 28)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(String(localized: "summary.export.ips"))
                                    .font(.body)
                                    .foregroundStyle(.primary)
                                Text(String(localized: "summary.export.ipsSubtitle"))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                if let err = generationError {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(DesignTokens.Colors.negative)
                }
            } header: {
                Text(String(localized: "summary.section.export"))
            } footer: {
                Text(String(localized: "summary.export.footer"))
                    .font(.caption2)
            }
        }
        .navigationTitle(String(localized: "tab.summary"))
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showIPSSetup) {
            IPSSetupSheet { patientName in
                showIPSSetup = false
                Task { await generateIPS(patientName: patientName) }
            }
        }
        .navigationDestination(isPresented: $showPreview) {
            if let bundle = generatedBundle, let preview = previewData {
                IPSPreviewView(data: preview, bundle: bundle)
            }
        }
    }

    // MARK: - IPS Generation

    private func generateIPS(patientName: String) async {
        isGenerating = true
        generationError = nil

        let container = modelContext.container
        let bundle = await IPSService.shared.buildBundle(patientName: patientName, container: container)
        let preview = await IPSService.shared.previewData(from: bundle, patientName: patientName)

        generatedBundle = bundle
        previewData = preview
        isGenerating = false
        showPreview = true
    }
}

// MARK: - IPS Setup Sheet

private struct IPSSetupSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var patientName = ""
    let onGenerate: (String) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(String(localized: "ips.setup.namePlaceholder"), text: $patientName)
                        .textContentType(.name)
                        .autocorrectionDisabled()
                } header: {
                    Text(String(localized: "ips.setup.nameHeader"))
                } footer: {
                    Text(String(localized: "ips.setup.nameFooter"))
                }

                Section {
                    Label(String(localized: "ips.setup.privacyNote"), systemImage: "lock.shield.fill")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear)
            }
            .navigationTitle(String(localized: "ips.setup.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "common.cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(String(localized: "ips.setup.generate")) {
                        onGenerate(patientName)
                    }
                }
            }
        }
    }
}

// MARK: - Row

private struct ClinicalSectionRow: View {
    let icon:  String
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 28)
            Text(label)
                .font(.body)
            Spacer()
            if count > 0 {
                Text("\(count)")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
