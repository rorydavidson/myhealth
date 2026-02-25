import SwiftUI

// MARK: - IPS Preview View

/// Shows the user exactly what will appear in their International Patient Summary
/// before they export to FHIR JSON.
///
/// This view is presented from `PatientSummaryView` after the user enters their name
/// and the bundle is generated on-device.
@MainActor
struct IPSPreviewView: View {
    let data: IPSPreviewData
    let bundle: FHIRBundle

    @State private var isExporting = false
    @State private var exportError: String?
    @State private var showExportSuccess = false
    @State private var exportedURL: URL?

    var body: some View {
        List {
            // Header card
            Section {
                headerCard
            }
            .listRowBackground(Color.clear)
            .listRowInsets(.init())

            // Vital Signs
            if !data.vitalSigns.isEmpty {
                Section(header: sectionHeader(
                    icon: "waveform.path.ecg",
                    title: String(localized: "ips.section.vitalSigns"),
                    color: DesignTokens.Colors.vitals
                )) {
                    ForEach(data.vitalSigns) { row in
                        ObservationRow(row: row)
                    }
                }
            }

            // Lab Results
            if !data.labResults.isEmpty {
                Section(header: sectionHeader(
                    icon: "flask",
                    title: String(localized: "ips.section.labResults"),
                    color: DesignTokens.Colors.labResults
                )) {
                    ForEach(data.labResults) { row in
                        ObservationRow(row: row)
                    }
                }
            }

            // Conditions (Problem List)
            Section(header: sectionHeader(
                icon: "cross.case.fill",
                title: String(localized: "ips.section.problems"),
                color: DesignTokens.Colors.vitals
            )) {
                if data.conditions.isEmpty {
                    emptyEntry(text: String(localized: "ips.empty.noProblems"))
                } else {
                    ForEach(data.conditions) { row in
                        ClinicalRow(row: row)
                    }
                }
            }

            // Medications
            Section(header: sectionHeader(
                icon: "pill.fill",
                title: String(localized: "ips.section.medications"),
                color: DesignTokens.Colors.activity
            )) {
                if data.medications.isEmpty {
                    emptyEntry(text: String(localized: "ips.empty.noMedications"))
                } else {
                    ForEach(data.medications) { row in
                        ClinicalRow(row: row)
                    }
                }
            }

            // Allergies
            Section(header: sectionHeader(
                icon: "allergens",
                title: String(localized: "ips.section.allergies"),
                color: DesignTokens.Colors.heart
            )) {
                if data.allergies.isEmpty {
                    emptyEntry(text: String(localized: "ips.empty.noAllergies"))
                } else {
                    ForEach(data.allergies) { row in
                        ClinicalRow(row: row)
                    }
                }
            }

            // Disclaimer
            Section {
                Text(String(localized: "ips.disclaimer"))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .listRowBackground(Color.clear)
            }
        }
        .navigationTitle(String(localized: "ips.preview.title"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                exportButton
            }
        }
        .alert(String(localized: "ips.export.success.title"), isPresented: $showExportSuccess) {
            Button(String(localized: "common.ok"), role: .cancel) {}
        } message: {
            Text(String(localized: "ips.export.success.message"))
        }
        .alert(String(localized: "ips.export.error.title"), isPresented: Binding(
            get: { exportError != nil },
            set: { if !$0 { exportError = nil } }
        )) {
            Button(String(localized: "common.ok"), role: .cancel) {}
        } message: {
            if let err = exportError {
                Text(err)
            }
        }
    }

    // MARK: - Sub-views

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "doc.text.fill")
                    .font(.title2)
                    .foregroundStyle(DesignTokens.Colors.labResults)
                VStack(alignment: .leading, spacing: 2) {
                    Text(String(localized: "ips.preview.header.title"))
                        .font(.headline)
                    if !data.patientName.isEmpty {
                        Text(data.patientName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }

            Divider()

            HStack(spacing: 24) {
                statPill(value: "\(data.vitalSigns.count)",   label: String(localized: "ips.stat.vitals"),    color: DesignTokens.Colors.vitals)
                statPill(value: "\(data.labResults.count)",   label: String(localized: "ips.stat.labs"),      color: DesignTokens.Colors.labResults)
                statPill(value: "\(data.conditions.count)",   label: String(localized: "ips.stat.problems"),  color: DesignTokens.Colors.vitals)
                statPill(value: "\(data.medications.count)",  label: String(localized: "ips.stat.meds"),      color: DesignTokens.Colors.activity)
                statPill(value: "\(data.allergies.count)",    label: String(localized: "ips.stat.allergies"), color: DesignTokens.Colors.heart)
            }

            Text(String(localized: "ips.preview.generatedAt \(formattedDate(data.generatedAt))"))
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func statPill(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.weight(.semibold).monospacedDigit())
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private func sectionHeader(icon: String, title: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .font(.caption)
            Text(title)
        }
    }

    private func emptyEntry(text: String) -> some View {
        HStack {
            Image(systemName: "checkmark.circle")
                .foregroundStyle(.tertiary)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var exportButton: some View {
        Group {
            if isExporting {
                ProgressView()
                    .progressViewStyle(.circular)
                    .scaleEffect(0.8)
            } else {
                Menu {
                    Button {
                        Task { await exportJSON() }
                    } label: {
                        Label(String(localized: "ips.export.json"), systemImage: "curlybraces")
                    }
                } label: {
                    Label(String(localized: "ips.export.button"), systemImage: "square.and.arrow.up")
                }
            }
        }
    }

    // MARK: - Export

    private func exportJSON() async {
        isExporting = true
        defer { isExporting = false }

        do {
            let data = try await IPSService.shared.jsonData(for: bundle)
            let filename = "IPS-\(isoDateForFilename(.now)).json"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            try data.write(to: url)
            exportedURL = url
            showExportSuccess = true
        } catch {
            exportError = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func formattedDate(_ date: Date) -> String {
        date.formatted(date: .abbreviated, time: .shortened)
    }

    private func isoDateForFilename(_ date: Date) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withFullDate, .withDashSeparatorInDate]
        return fmt.string(from: date)
    }
}

// MARK: - Observation Row

private struct ObservationRow: View {
    let row: IPSPreviewData.IPSObservationRow

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.name)
                    .font(.subheadline)
                if let date = row.date {
                    Text(date)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer()
            Text(row.value)
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Clinical Row

private struct ClinicalRow: View {
    let row: IPSPreviewData.IPSClinicalRow

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(row.display)
                    .font(.subheadline)
                Spacer()
                if let status = row.status {
                    Text(status.capitalized)
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(statusColor(status).opacity(0.12))
                        .foregroundStyle(statusColor(status))
                        .clipShape(Capsule())
                }
            }
            if let detail = row.detail {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "active", "high":               return DesignTokens.Colors.positive
        case "resolved", "stopped", "low":   return DesignTokens.Colors.neutral
        case "inactive", "on-hold":          return DesignTokens.Colors.warning
        case "unable-to-assess":             return DesignTokens.Colors.warning
        default:                             return DesignTokens.Colors.neutral
        }
    }
}
