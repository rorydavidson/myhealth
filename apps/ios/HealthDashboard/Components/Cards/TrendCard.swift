import SwiftUI

/// Compact metric trend card — shows a 30-day sparkline, latest value,
/// week-over-week delta percentage, and a directional arrow.
///
/// An amber border is drawn automatically when |weekDelta| > 10%.
struct TrendCard: View {
    let result: TrendResult

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            headerRow
            sparklineArea
            valueRow
        }
        .padding(12)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(borderColor, lineWidth: result.isSignificant ? 1.5 : 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }

    // MARK: - Sub-views

    private var headerRow: some View {
        HStack(spacing: 6) {
            Image(systemName: result.category.primaryIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(result.category.color)
            Text(result.title)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
            trendArrow
        }
    }

    private var sparklineArea: some View {
        Group {
            if result.sparkline.isEmpty {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.secondary.opacity(0.08))
                    .frame(height: 52)
            } else {
                SparklineChart(points: result.sparkline, category: result.category)
                    .frame(height: 52)
            }
        }
    }

    private var valueRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            if let latest = result.latestValue {
                Text(formatValue(latest))
                    .font(.title3.bold().monospacedDigit())
                Text(result.unit)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                Text(String(localized: "trends.noData"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            if let delta = result.weekDelta {
                deltaText(delta)
            }
        }
    }

    // MARK: - Trend arrow

    @ViewBuilder
    private var trendArrow: some View {
        switch result.direction {
        case .improving:
            Image(systemName: "arrow.up.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(DesignTokens.Colors.positive)
        case .declining:
            Image(systemName: "arrow.down.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(DesignTokens.Colors.negative)
        case .stable:
            Image(systemName: "arrow.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(DesignTokens.Colors.neutral)
        case .insufficient:
            EmptyView()
        }
    }

    // MARK: - Delta text

    private func deltaText(_ delta: Double) -> Text {
        let sign = delta >= 0 ? "+" : ""
        let label = "\(sign)\(String(format: "%.1f", delta))%"
        return Text(label)
            .font(.caption2.weight(.medium).monospacedDigit())
            .foregroundStyle(deltaColor)
    }

    private var deltaColor: Color {
        switch result.direction {
        case .improving:    DesignTokens.Colors.positive
        case .declining:    DesignTokens.Colors.negative
        case .stable, .insufficient: DesignTokens.Colors.neutral
        }
    }

    private var borderColor: Color {
        result.isSignificant
            ? DesignTokens.Colors.warning.opacity(0.55)
            : Color.secondary.opacity(0.15)
    }

    // MARK: - Value formatting

    private func formatValue(_ value: Double) -> String {
        if value >= 10_000 {
            return String(format: "%.0f", value)
        } else if value.truncatingRemainder(dividingBy: 1) == 0 {
            return String(format: "%.0f", value)
        } else {
            return String(format: "%.1f", value)
        }
    }
}

// MARK: - Preview

#Preview {
    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
        // Improving — significant delta
        TrendCard(result: TrendResult(
            metricType: "step_count",
            category: .activity,
            title: "Steps",
            unit: "steps",
            sparkline: (0..<30).map { i in
                SparklinePoint(
                    id: "step_count:preview-\(i)",
                    date: Calendar.current.date(byAdding: .day, value: i - 30, to: .now)!,
                    value: Double.random(in: 6_000...12_000)
                )
            },
            latestValue: 9_241,
            weekDelta: 12.4,
            regressionSlope: 80,
            direction: .improving
        ))

        // Declining — resting HR going up
        TrendCard(result: TrendResult(
            metricType: "resting_heart_rate",
            category: .heart,
            title: "Resting HR",
            unit: "bpm",
            sparkline: (0..<20).map { i in
                SparklinePoint(
                    id: "rhr:preview-\(i)",
                    date: Calendar.current.date(byAdding: .day, value: i - 20, to: .now)!,
                    value: Double.random(in: 58...72)
                )
            },
            latestValue: 68,
            weekDelta: 5.2,
            regressionSlope: 0.3,
            direction: .declining
        ))

        // Stable
        TrendCard(result: TrendResult(
            metricType: "sleep_session",
            category: .sleep,
            title: "Sleep",
            unit: "min",
            sparkline: (0..<25).map { i in
                SparklinePoint(
                    id: "sleep:preview-\(i)",
                    date: Calendar.current.date(byAdding: .day, value: i - 25, to: .now)!,
                    value: Double.random(in: 400...480)
                )
            },
            latestValue: 438,
            weekDelta: 1.1,
            regressionSlope: 0.5,
            direction: .stable
        ))

        // Insufficient data
        TrendCard(result: TrendResult(
            metricType: "hrv",
            category: .heart,
            title: "HRV",
            unit: "ms",
            sparkline: [],
            latestValue: nil,
            weekDelta: nil,
            regressionSlope: nil,
            direction: .insufficient
        ))
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
