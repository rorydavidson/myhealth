import SwiftUI

/// Design tokens mirroring the Phase 1 Tailwind CSS palette and spacing scale.
/// All UI components import from here — never use magic numbers or hex strings elsewhere.
enum DesignTokens {
    // MARK: - Category Colours
    //
    // These match the Phase 1 Tailwind colour values exactly so the iOS and web
    // apps feel visually identical to users who switch between them.

    enum Colors {
        /// blue-500 (#3b82f6) — Activity: steps, distance, active energy
        static let activity = Color(red: 0.231, green: 0.510, blue: 0.965)

        /// rose-500 (#f43f5e) — Heart: HR, resting HR, HRV
        static let heart = Color(red: 0.957, green: 0.247, blue: 0.369)

        /// indigo-500 (#6366f1) — Sleep
        static let sleep = Color(red: 0.388, green: 0.400, blue: 0.945)

        /// amber-500 (#f59e0b) — Body: weight, body fat
        static let body = Color(red: 0.961, green: 0.620, blue: 0.043)

        /// emerald-500 (#10b981) — Vitals: SpO₂, BP, respiratory rate
        static let vitals = Color(red: 0.063, green: 0.725, blue: 0.506)

        /// violet-500 (#8b5cf6) — Lab Results
        static let labResults = Color(red: 0.545, green: 0.361, blue: 0.965)

        /// orange-500 (#f97316) — Workouts
        static let workouts = Color(red: 0.976, green: 0.451, blue: 0.086)

        // MARK: Semantic
        /// emerald-500 — improving trend / good
        static let positive = Color(red: 0.063, green: 0.725, blue: 0.506)

        /// rose-500 — declining trend / attention
        static let negative = Color(red: 0.957, green: 0.247, blue: 0.369)

        /// amber-500 — warning / enhanced mode indicator
        static let warning = Color(red: 0.961, green: 0.620, blue: 0.043)

        /// neutral — stable / secondary text
        static let neutral = Color.secondary
    }

    // MARK: - Corner Radii

    enum Radius {
        /// Card radius — 12 pt (matches Tailwind `rounded-xl`)
        static let card: CGFloat = 12

        /// Button / input radius — 8 pt (matches Tailwind `rounded-lg`)
        static let button: CGFloat = 8
    }

    // MARK: - Spacing Scale (4 pt base, matching Tailwind default)

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }

    // MARK: - Shadow

    /// Matches Tailwind `shadow-sm`
    static func cardShadow() -> some View {
        Color.clear
            .shadow(color: .black.opacity(0.06), radius: 1, x: 0, y: 1)
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Gradient Helpers

extension Color {
    /// 20%-opacity gradient fill used in chart area marks — matches Phase 1.
    func chartGradient() -> LinearGradient {
        LinearGradient(
            stops: [
                .init(color: self.opacity(0.20), location: 0),
                .init(color: self.opacity(0.00), location: 1),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}
