import Foundation

/// Date range options for the dashboard's segmented range selector.
/// Mirrors the Phase 1 web app's 7D / 30D / 90D / 1Y / All control.
enum DateRange: String, CaseIterable, Identifiable, Sendable {
    case week        = "7D"
    case month       = "30D"
    case threeMonths = "90D"
    case year        = "1Y"
    case all         = "All"

    var id: String { rawValue }

    /// How many calendar days to look back; nil means all available data.
    var days: Int? {
        switch self {
        case .week:        return 7
        case .month:       return 30
        case .threeMonths: return 90
        case .year:        return 365
        case .all:         return nil
        }
    }

    /// The start date of this range (UTC midnight).
    /// Returns `.distantPast` for `.all` so predicates can always use `>=`.
    var startDate: Date {
        guard let days else { return .distantPast }
        return Calendar.current.date(
            byAdding: .day,
            value: -days,
            to: Calendar.current.startOfDay(for: .now)
        ) ?? .distantPast
    }

    /// ISO-8601 date string (`yyyy-MM-dd`) matching `DailySummary.date` format.
    var startDateString: String {
        Self.isoFormatter.string(from: startDate)
    }

    // MARK: Chart axis stride

    /// Calendar component and repetition count to use for X-axis tick marks.
    var axisStride: (component: Calendar.Component, count: Int) {
        switch self {
        case .week:        return (.day, 1)
        case .month:       return (.weekOfYear, 1)
        case .threeMonths: return (.weekOfYear, 2)
        case .year:        return (.month, 1)
        case .all:         return (.month, 3)
        }
    }

    /// Date format string for X-axis labels.
    var axisLabelFormat: Date.FormatStyle {
        switch self {
        case .week:        return .dateTime.weekday(.abbreviated)
        case .month:       return .dateTime.month(.abbreviated).day()
        case .threeMonths: return .dateTime.month(.abbreviated).day()
        case .year:        return .dateTime.month(.abbreviated)
        case .all:         return .dateTime.year().month(.abbreviated)
        }
    }

    // MARK: Shared formatter (UTC, matches DailySummary.date strings)

    static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")!
        return f
    }()
}
