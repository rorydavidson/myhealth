import SwiftUI
import SwiftData

/// International Patient Summary hub.
///
/// Shows counts of user-entered clinical data (conditions, medications, allergies)
/// with navigation links into each sub-screen.
/// IPS export (FHIR JSON + PDF) lands in Milestone 20.
@MainActor
struct PatientSummaryView: View {
    @Query private var conditions: [ClinicalCondition]
    @Query private var medications: [Medication]
    @Query private var allergies: [Allergy]

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

            // IPS export — coming in Milestone 20
            Section(String(localized: "summary.section.export")) {
                HStack {
                    Image(systemName: "doc.text.fill")
                        .foregroundStyle(DesignTokens.Colors.labResults)
                        .frame(width: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(String(localized: "summary.export.ips"))
                            .font(.body)
                        Text(String(localized: "summary.export.ipsSubtitle"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(String(localized: "summary.export.comingSoon"))
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle(String(localized: "tab.summary"))
        .navigationBarTitleDisplayMode(.large)
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
