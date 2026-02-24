import SwiftUI
import SwiftData

/// Trends screen — 30-day sparklines and week-over-week deltas for all metrics,
/// grouped by health category in a 2-column grid.
///
/// A toolbar button opens the Correlation Explorer as a sheet.
/// Pull-to-refresh triggers a data reload via the view model.
struct TrendsView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var vm: TrendsViewModel?
    @State private var showCorrelation = false

    private let columns: [GridItem] = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        Group {
            if let vm {
                content(vm: vm)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(String(localized: "trends.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showCorrelation = true
                } label: {
                    Image(systemName: "point.topleft.down.to.point.bottomright.curvepath.fill")
                        .accessibilityLabel(String(localized: "trends.correlation.title"))
                }
            }
        }
        .sheet(isPresented: $showCorrelation) {
            if let vm {
                // Pass a stable container reference; CorrelationView creates its own VM
                CorrelationView(container: modelContext.container)
            }
        }
        .task {
            guard vm == nil else { return }
            let newVM = TrendsViewModel(container: modelContext.container)
            vm = newVM
            newVM.load()
        }
    }

    // MARK: - Scrollable content

    @ViewBuilder
    private func content(vm: TrendsViewModel) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                if vm.isLoading {
                    skeletonGrid
                } else if vm.trendsByCategory.isEmpty {
                    emptyState
                } else {
                    ForEach(vm.trendsByCategory, id: \.category) { section in
                        categorySection(section.category, trends: section.trends)
                    }
                }
            }
            .padding(16)
        }
        .refreshable {
            // Pull-to-refresh: reset loading guard so load() proceeds
            vm.isLoading = false
            vm.load()
        }
    }

    // MARK: - Category section

    @ViewBuilder
    private func categorySection(_ category: MetricCategory, trends: [TrendResult]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Section header
            HStack(spacing: 8) {
                Image(systemName: category.primaryIcon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(category.color)
                Text(category.displayName)
                    .font(.subheadline.weight(.semibold))
            }

            // 2-column card grid
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(trends) { trend in
                    TrendCard(result: trend)
                }
            }
        }
    }

    // MARK: - Skeleton

    private var skeletonGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Fake section header
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.secondary.opacity(0.15))
                .frame(width: 100, height: 14)

            // Six placeholder cards
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(0..<6, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                        .fill(Color.secondary.opacity(0.10))
                        .frame(height: 128)
                }
            }
        }
        .shimmering(isActive: true)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 52))
                .foregroundStyle(Color.secondary.opacity(0.35))

            Text(String(localized: "trends.empty.title"))
                .font(.headline)

            Text(String(localized: "trends.empty.message"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        TrendsView()
            .modelContainer(for: [DailySummary.self], inMemory: true)
    }
}
