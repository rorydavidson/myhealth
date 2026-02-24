import Foundation
import SwiftData
import SwiftUI
import Observation

/// Main-actor view model for the Trends screen.
///
/// Loads `TrendResult` data for every trackable metric via `TrendService`,
/// then groups results by `MetricCategory` for section-based display.
/// The heavy SwiftData fetch suspends on the `TrendService` actor, keeping
/// the main thread free while skeleton UI is visible.
@Observable
@MainActor
final class TrendsViewModel {

    // MARK: - Published state

    var isLoading = false

    /// Results grouped by category and ordered for display.
    /// Each entry is non-empty by construction.
    var trendsByCategory: [(category: MetricCategory, trends: [TrendResult])] = []

    // MARK: - Private

    private let container: ModelContainer

    /// Display order for category sections.
    private static let categoryOrder: [MetricCategory] = [
        .activity, .heart, .sleep, .body, .vitals
    ]

    // MARK: - Init

    init(container: ModelContainer) {
        self.container = container
    }

    // MARK: - Public

    /// Fetches all metric trends and updates `trendsByCategory`.
    ///
    /// Idempotent-guards against concurrent calls. Shows skeleton immediately
    /// (via `isLoading`), yields to let SwiftUI render it, then performs the
    /// fetch and animates the results in.
    func load() {
        guard !isLoading else { return }
        isLoading = true
        Task { @MainActor [weak self] in
            guard let self else { return }
            await Task.yield()      // let skeleton render before blocking
            let results = await fetchTrends()
            withAnimation(.easeInOut(duration: 0.3)) {
                self.trendsByCategory = Self.grouped(results)
                self.isLoading = false
            }
        }
    }

    // MARK: - Private

    private func fetchTrends() async -> [TrendResult] {
        let c = container
        return (try? await TrendService.shared.computeAllTrends(container: c)) ?? []
    }

    private static func grouped(
        _ results: [TrendResult]
    ) -> [(category: MetricCategory, trends: [TrendResult])] {
        categoryOrder.compactMap { cat in
            let items = results.filter { $0.category == cat }
            return items.isEmpty ? nil : (category: cat, trends: items)
        }
    }
}
