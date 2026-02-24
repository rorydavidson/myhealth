import SwiftUI
import Charts

// MARK: - WorkoutSection

/// Dashboard section showing a workout frequency chart and a scrollable workout log.
@MainActor
struct WorkoutSection: View {
    let viewModel: DashboardViewModel
    let onNavigate: (MetricDetailDestination) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(
                title: MetricCategory.workouts.displayName,
                category: .workouts
            )

            // Frequency bar chart
            ChartCard(
                title: String(localized: "dashboard.metric.workoutFrequency"),
                category: .workouts,
                isLoading: viewModel.isLoading,
                isEmpty: viewModel.workoutRows.isEmpty,
                onDetailTap: { onNavigate(.workoutLog) }
            ) {
                WorkoutFrequencyChart(rows: viewModel.workoutRows, range: viewModel.selectedRange)
            }

            // Recent workout list (up to 5 rows visible inline)
            if !viewModel.workoutRows.isEmpty {
                recentWorkoutList
            }
        }
    }

    private var recentWorkoutList: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.workoutRows.prefix(5)) { row in
                WorkoutListRow(row: row)
                if row.id != viewModel.workoutRows.prefix(5).last?.id {
                    Divider().padding(.leading, DesignTokens.Spacing.md)
                }
            }

            if viewModel.workoutRows.count > 5 {
                Button {
                    onNavigate(.workoutLog)
                } label: {
                    HStack {
                        Text(String(localized: "dashboard.workout.seeAll \(viewModel.workoutRows.count)"))
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(MetricCategory.workouts.color)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(MetricCategory.workouts.color)
                    }
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.vertical, DesignTokens.Spacing.sm)
                }
                .buttonStyle(.plain)
            }
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
}

// MARK: - WorkoutFrequencyChart

/// Bar chart showing workout count per week (or per month for longer ranges).
struct WorkoutFrequencyChart: View {
    let rows: [WorkoutRow]
    let range: DateRange
    var height: CGFloat = 140

    private let color = MetricCategory.workouts.color

    /// Buckets workouts into weekly or monthly counts.
    private var buckets: [(date: Date, count: Int)] {
        let cal = Calendar.current
        let component: Calendar.Component = range == .year || range == .all ? .month : .weekOfYear
        var groups: [Date: Int] = [:]
        for row in rows {
            let start = cal.dateInterval(of: component, for: row.date)?.start ?? row.date
            groups[start, default: 0] += 1
        }
        return groups.map { ($0.key, $0.value) }.sorted { $0.date < $1.date }
    }

    var body: some View {
        Chart(buckets, id: \.date) { bucket in
            BarMark(
                x: .value(String(localized: "chart.axis.date"), bucket.date, unit: range == .year || range == .all ? .month : .weekOfYear),
                y: .value(String(localized: "dashboard.metric.workoutFrequency"), bucket.count)
            )
            .foregroundStyle(color.gradient)
            .cornerRadius(3)
        }
        .chartXAxis { dateAxis(range: range) }
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.secondary.opacity(0.2))
                AxisValueLabel()
                    .font(.caption2)
                    .foregroundStyle(Color.secondary)
            }
        }
        .frame(height: height)
    }
}

// MARK: - WorkoutListRow

/// A single row in the inline workout list.
struct WorkoutListRow: View {
    let row: WorkoutRow

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            // Icon
            Image(systemName: MetricCategory.workouts.primaryIcon)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(MetricCategory.workouts.color)
                .frame(width: 28, height: 28)
                .background(MetricCategory.workouts.color.opacity(0.1))
                .clipShape(Circle())

            // Name + date
            VStack(alignment: .leading, spacing: 2) {
                Text(row.workoutType)
                    .font(.footnote.weight(.medium))
                Text(row.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Stats
            VStack(alignment: .trailing, spacing: 2) {
                Text(row.durationLabel)
                    .font(.footnote.weight(.semibold))
                    .monospacedDigit()
                if let kcal = row.activeEnergyKcal {
                    Text(String(format: "%.0f kcal", kcal))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.sm)
    }
}

// MARK: - WorkoutDetailSheet

/// Full workout log — all workouts for the selected range with a filter picker.
@MainActor
struct WorkoutDetailSheet: View {
    let viewModel: DashboardViewModel
    @State private var selectedType: String? = nil
    @Environment(\.dismiss) private var dismiss

    private var filteredRows: [WorkoutRow] {
        guard let type = selectedType else { return viewModel.workoutRows }
        return viewModel.workoutRows.filter { $0.workoutType == type }
    }

    private var workoutTypes: [String] {
        Array(Set(viewModel.workoutRows.map(\.workoutType))).sorted()
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Type filter
                if workoutTypes.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: DesignTokens.Spacing.xs) {
                            filterChip(label: String(localized: "dashboard.workout.all"), selected: selectedType == nil) {
                                selectedType = nil
                            }
                            ForEach(workoutTypes, id: \.self) { type in
                                filterChip(label: type, selected: selectedType == type) {
                                    selectedType = selectedType == type ? nil : type
                                }
                            }
                        }
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                    }
                    Divider()
                }

                // Workout list
                if filteredRows.isEmpty {
                    EmptyStateView(
                        icon: MetricCategory.workouts.primaryIcon,
                        title: String(localized: "dashboard.workout.empty.title"),
                        message: String(localized: "dashboard.workout.empty.message"),
                        category: .workouts
                    )
                } else {
                    List(filteredRows) { row in
                        WorkoutListRow(row: row)
                            .listRowInsets(EdgeInsets())
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle(String(localized: "dashboard.section.workouts"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(String(localized: "common.done")) { dismiss() }
                }
            }
        }
    }

    private func filterChip(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.caption.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(selected ? MetricCategory.workouts.color : Color.secondary.opacity(0.12))
                .foregroundStyle(selected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    let now = Date.now
    let cal = Calendar.current
    let rows: [WorkoutRow] = [
        WorkoutRow(id: "1", date: now, workoutType: "Running", durationMins: 32, distanceKm: 5.2, activeEnergyKcal: 340),
        WorkoutRow(id: "2", date: cal.date(byAdding: .day, value: -2, to: now)!, workoutType: "Cycling", durationMins: 58, distanceKm: 22, activeEnergyKcal: 480),
        WorkoutRow(id: "3", date: cal.date(byAdding: .day, value: -5, to: now)!, workoutType: "Running", durationMins: 28, distanceKm: 4.5, activeEnergyKcal: 300),
    ]

    return VStack(spacing: 16) {
        WorkoutFrequencyChart(rows: rows, range: .month)
        ForEach(rows) { WorkoutListRow(row: $0) }
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
