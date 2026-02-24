import SwiftUI

/// Skeleton loading placeholder using SwiftUI's `redacted(reason: .placeholder)`.
/// Matches the target content shape and size so there's no layout shift on load.
struct SkeletonView<Content: View>: View {
    @ViewBuilder let content: () -> Content
    var isLoading: Bool

    var body: some View {
        content()
            .redacted(reason: isLoading ? .placeholder : [])
            .shimmering(isActive: isLoading)
    }
}

// MARK: - Shimmer Animation

struct ShimmeringModifier: ViewModifier {
    let isActive: Bool
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        if isActive {
            content
                .overlay(
                    GeometryReader { geo in
                        let gradient = LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0),
                                .init(color: .white.opacity(0.35), location: 0.5),
                                .init(color: .clear, location: 1),
                            ],
                            startPoint: .init(x: phase, y: 0.5),
                            endPoint: .init(x: phase + 0.5, y: 0.5)
                        )
                        gradient
                            .frame(width: geo.size.width * 2)
                            .offset(x: -geo.size.width)
                    }
                )
                .mask(content)
                .onAppear {
                    withAnimation(
                        .linear(duration: 1.4).repeatForever(autoreverses: false)
                    ) {
                        phase = 1.5
                    }
                }
        } else {
            content
        }
    }
}

extension View {
    func shimmering(isActive: Bool) -> some View {
        modifier(ShimmeringModifier(isActive: isActive))
    }
}

// MARK: - Preset Skeletons

/// Skeleton matching a MetricCard's visual shape.
struct MetricCardSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.secondary.opacity(0.3))
                .frame(width: 80, height: 12)

            RoundedRectangle(cornerRadius: 4)
                .fill(Color.secondary.opacity(0.3))
                .frame(width: 120, height: 32)

            RoundedRectangle(cornerRadius: 4)
                .fill(Color.secondary.opacity(0.2))
                .frame(width: 60, height: 10)
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
        .shimmering(isActive: true)
    }
}

// MARK: - ChartCardSkeleton

/// Skeleton matching a `ChartCard`'s visual shape — title stub + faux bar silhouette.
struct ChartCardSkeleton: View {
    var height: CGFloat = 180

    private let barHeightRatios: [CGFloat] = [
        0.40, 0.65, 0.50, 0.80, 0.60, 0.75, 0.35, 0.70, 0.55, 0.65, 0.80, 0.45, 0.60, 0.70,
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            // Title stub
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.secondary.opacity(0.25))
                .frame(width: 100, height: 12)

            // Faux bar chart
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(barHeightRatios.indices, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.secondary.opacity(0.20))
                        .frame(maxWidth: .infinity)
                        .frame(height: barHeightRatios[i] * (height - DesignTokens.Spacing.md))
                }
            }
            .frame(height: height - DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity)
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
        .shimmering(isActive: true)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MetricCardSkeleton()
            MetricCardSkeleton()
            MetricCardSkeleton()
            MetricCardSkeleton()
        }
        ChartCardSkeleton()
        ChartCardSkeleton(height: 240)
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
