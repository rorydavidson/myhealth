import SwiftUI

/// Health metric category — shared across design system, navigation, and charts.
/// Each case maps to a colour, SF Symbol, and display name.
enum MetricCategory: String, CaseIterable, Sendable {
    case activity
    case heart
    case sleep
    case body
    case vitals
    case workouts
    case labResults

    // MARK: - Display

    var displayName: String {
        switch self {
        case .activity:   String(localized: "category.activity")
        case .heart:      String(localized: "category.heart")
        case .sleep:      String(localized: "category.sleep")
        case .body:       String(localized: "category.body")
        case .vitals:     String(localized: "category.vitals")
        case .workouts:   String(localized: "category.workouts")
        case .labResults: String(localized: "category.labResults")
        }
    }

    // MARK: - Design tokens

    var color: Color {
        switch self {
        case .activity:   DesignTokens.Colors.activity
        case .heart:      DesignTokens.Colors.heart
        case .sleep:      DesignTokens.Colors.sleep
        case .body:       DesignTokens.Colors.body
        case .vitals:     DesignTokens.Colors.vitals
        case .workouts:   DesignTokens.Colors.workouts
        case .labResults: DesignTokens.Colors.labResults
        }
    }

    // MARK: - SF Symbols (matching Phase 1 Lucide icons)

    var primaryIcon: String {
        switch self {
        case .activity:   "figure.walk"
        case .heart:      "heart.fill"
        case .sleep:      "moon.fill"
        case .body:       "scalemass.fill"
        case .vitals:     "waveform.path.ecg"
        case .workouts:   "dumbbell.fill"
        case .labResults: "testtube.2"
        }
    }

    var secondaryIcon: String {
        switch self {
        case .activity:   "flame.fill"
        case .heart:      "waveform.path.ecg.rectangle"
        case .sleep:      "bed.double.fill"
        case .body:       "percent"
        case .vitals:     "lungs.fill"
        case .workouts:   "timer"
        case .labResults: "doc.text.magnifyingglass"
        }
    }
}
