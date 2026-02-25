import SwiftUI

/// "More" tab — a menu list surfacing Import and Settings,
/// freeing the tab bar for Dashboard, Trends, Insights and Summary.
@MainActor
struct MoreView: View {
    var body: some View {
        List {
            Section {
                NavigationLink(destination: ImportView()) {
                    Label(String(localized: "tab.import"), systemImage: "square.and.arrow.down")
                }

                NavigationLink(destination: SettingsView()) {
                    Label(String(localized: "tab.settings"), systemImage: "gearshape.fill")
                }
            }
        }
        .navigationTitle(String(localized: "tab.more"))
        .navigationBarTitleDisplayMode(.large)
    }
}
