import Foundation
import SwiftData
import SwiftUI
import Observation

/// Main-actor view model for the Correlation Explorer.
///
/// Manages the two selected metrics and delegates computation to `TrendService`.
/// After selection changes the caller must invoke `compute()` to trigger a refresh.
@Observable
@MainActor
final class CorrelationViewModel {

    // MARK: - Metric selection

    /// Metric on the X-axis (metric A). Defaults to step count.
    var metricA: TrendMetric = allTrendMetrics()[0]    // step_count

    /// Metric on the Y-axis (metric B). Defaults to heart rate.
    var metricB: TrendMetric = allTrendMetrics()[4]    // heart_rate

    // MARK: - Result state

    var result: CorrelationResult?
    var isLoading = false

    // MARK: - Private

    private let container: ModelContainer

    // MARK: - Init

    init(container: ModelContainer) {
        self.container = container
    }

    // MARK: - Public

    /// Triggers a (re-)computation of the correlation between `metricA` and `metricB`.
    ///
    /// Guards against concurrent calls. Clears any previous result while loading.
    func compute() {
        guard !isLoading else { return }
        isLoading = true
        result = nil

        Task { @MainActor [weak self] in
            guard let self else { return }
            await Task.yield()          // let skeleton render first
            let r = await fetchCorrelation(a: metricA, b: metricB)
            withAnimation(.easeInOut(duration: 0.3)) {
                self.result = r
                self.isLoading = false
            }
        }
    }

    // MARK: - Private

    private func fetchCorrelation(a: TrendMetric, b: TrendMetric) async -> CorrelationResult? {
        let c = container
        return try? await TrendService.shared.computeCorrelation(
            metricA: a, metricB: b, container: c
        )
    }
}
