import SwiftUI

/// International Patient Summary (IPS) export screen.
/// FHIR bundle generation and PDF export in Milestone 20.
@MainActor
struct PatientSummaryView: View {
    var body: some View {
        EmptyStateView(
            icon: "doc.text.fill",
            title: String(localized: "summary.empty.title"),
            message: String(localized: "summary.empty.message"),
            category: .vitals
        )
        .navigationTitle(String(localized: "tab.summary"))
        .navigationBarTitleDisplayMode(.large)
    }
}
