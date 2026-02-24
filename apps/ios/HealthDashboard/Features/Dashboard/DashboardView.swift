import SwiftUI
import SwiftData

// MARK: - DashboardView

/// Main dashboard screen.
///
/// Shows:
/// 1. Date range segmented control
/// 2. Overview snapshot cards (today's top metrics)
/// 3. Metric charts grouped by category (Activity, Heart, Sleep, Body, Vitals)
/// 4. Workout log section
///
/// All data is read from local SwiftData storage by `DashboardViewModel`.
/// Navigates to `MetricDetailView` or `WorkoutDetailSheet` on tap.
@MainActor
struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext

    @State private var viewModel: DashboardViewModel?
    @State private var navigationPath = NavigationPath()
    @State private var showWorkoutSheet = false

    var body: some View {
        NavigationStack(path: $navigationPath) {
            content
                .navigationTitle(String(localized: "tab.dashboard"))
                .navigationBarTitleDisplayMode(.large)
                .toolbar { settingsButton }
                .navigationDestination(for: MetricDetailDestination.self) { destination in
                    navigationDestination(for: destination)
                }
        }
        .task {
            guard viewModel == nil else { return }
            let vm = DashboardViewModel(container: modelContext.container)
            viewModel = vm
            vm.load()
        }
        .sheet(isPresented: $showWorkoutSheet) {
            if let vm = viewModel {
                WorkoutDetailSheet(viewModel: vm)
            }
        }
    }

    // MARK: - Main content

    @ViewBuilder
    private var content: some View {
        if let vm = viewModel {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    // Date range selector
                    dateRangePicker(vm: vm)
                        .padding(.horizontal, DesignTokens.Spacing.md)

                    // Overview snapshot cards
                    overviewSection(vm: vm)
                        .padding(.horizontal, DesignTokens.Spacing.md)

                    // Activity
                    ActivitySection(viewModel: vm, onNavigate: handleNavigation)
                        .padding(.horizontal, DesignTokens.Spacing.md)

                    // Heart
                    HeartSection(viewModel: vm, onNavigate: handleNavigation)
                        .padding(.horizontal, DesignTokens.Spacing.md)

                    // Sleep
                    SleepSection(viewModel: vm, onNavigate: handleNavigation)
                        .padding(.horizontal, DesignTokens.Spacing.md)

                    // Body
                    BodySection(viewModel: vm, onNavigate: handleNavigation)
                        .padding(.horizontal, DesignTokens.Spacing.md)

                    // Vitals
                    VitalsSection(viewModel: vm, onNavigate: handleNavigation)
                        .padding(.horizontal, DesignTokens.Spacing.md)

                    // Workouts
                    WorkoutSection(viewModel: vm, onNavigate: handleNavigation)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                }
                .padding(.vertical, DesignTokens.Spacing.md)
            }
            .background(Color(.systemGroupedBackground))
            .refreshable {
                vm.load()
                // Brief yield so the spinner is visible for at least one frame
                try? await Task.sleep(for: .milliseconds(400))
            }
        } else {
            // ViewModel not yet initialised — show skeleton layout
            skeletonLayout
        }
    }

    // MARK: - Date range picker

    private func dateRangePicker(vm: DashboardViewModel) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            ForEach(DateRange.allCases) { range in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        vm.selectedRange = range
                    }
                } label: {
                    Text(range.rawValue)
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(
                            vm.selectedRange == range
                                ? Color.primary
                                : Color.secondary.opacity(0.1)
                        )
                        .foregroundStyle(
                            vm.selectedRange == range
                                ? Color(UIColor.systemBackground)
                                : .primary
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Overview snapshot cards (15.2)

    private func overviewSection(vm: DashboardViewModel) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(
                title: String(localized: "dashboard.section.overview"),
                category: .activity
            )

            if vm.isLoading {
                LazyVGrid(
                    columns: [GridItem(.flexible()), GridItem(.flexible())],
                    spacing: DesignTokens.Spacing.sm
                ) {
                    ForEach(0..<4, id: \.self) { _ in MetricCardSkeleton() }
                }
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible()), GridItem(.flexible())],
                    spacing: DesignTokens.Spacing.sm
                ) {
                    // Steps today
                    MetricCard(
                        category: .activity,
                        title: String(localized: "dashboard.overview.stepsToday"),
                        value: formatSteps(vm.snapshot.todaySteps),
                        unit: String(localized: "unit.steps"),
                        dateLabel: String(localized: "dashboard.overview.today"),
                        onTap: {
                            handleNavigation(.metric(
                                type: "step_count",
                                category: .activity,
                                title: String(localized: "dashboard.metric.steps")
                            ))
                        }
                    )

                    // Resting Heart Rate
                    MetricCard(
                        category: .heart,
                        title: String(localized: "dashboard.overview.restingHR"),
                        value: vm.snapshot.latestRestingHR.map { String(format: "%.0f", $0) } ?? "—",
                        unit: String(localized: "unit.bpm"),
                        dateLabel: vm.snapshot.latestRestingHRDate.map { relativeDate($0) },
                        onTap: {
                            handleNavigation(.metric(
                                type: "resting_heart_rate",
                                category: .heart,
                                title: String(localized: "dashboard.metric.restingHR")
                            ))
                        }
                    )

                    // Sleep
                    MetricCard(
                        category: .sleep,
                        title: String(localized: "dashboard.overview.sleep"),
                        value: formatSleep(vm.snapshot.lastSleepMins),
                        unit: "",
                        dateLabel: vm.snapshot.lastSleepDate.map { relativeDate($0) },
                        onTap: {
                            handleNavigation(.metric(
                                type: "sleep_session",
                                category: .sleep,
                                title: String(localized: "dashboard.metric.sleep")
                            ))
                        }
                    )

                    // Weight
                    MetricCard(
                        category: .body,
                        title: String(localized: "dashboard.overview.weight"),
                        value: vm.snapshot.latestWeight.map { String(format: "%.1f", $0) } ?? "—",
                        unit: String(localized: "unit.kg"),
                        dateLabel: vm.snapshot.latestWeightDate.map { relativeDate($0) },
                        onTap: {
                            handleNavigation(.metric(
                                type: "body_mass",
                                category: .body,
                                title: String(localized: "dashboard.metric.weight")
                            ))
                        }
                    )
                }
                .transition(.opacity.animation(.easeInOut(duration: 0.3)))
            }
        }
    }

    // MARK: - Skeleton layout (before ViewModel is ready)

    private var skeletonLayout: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.lg) {
                LazyVGrid(
                    columns: [GridItem(.flexible()), GridItem(.flexible())],
                    spacing: DesignTokens.Spacing.sm
                ) {
                    ForEach(0..<4, id: \.self) { _ in MetricCardSkeleton() }
                }

                ForEach(0..<4, id: \.self) { _ in
                    ChartCardSkeleton()
                }
            }
            .padding(DesignTokens.Spacing.md)
        }
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var settingsButton: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            // Settings tab is separate — this is a shortcut badge for sync status
            if appState.syncState.isActive {
                ProgressView()
                    .controlSize(.small)
            }
        }
    }

    // MARK: - Navigation

    private func handleNavigation(_ destination: MetricDetailDestination) {
        switch destination {
        case .metric:
            navigationPath.append(destination)
        case .workoutLog:
            showWorkoutSheet = true
        }
    }

    @ViewBuilder
    private func navigationDestination(for destination: MetricDetailDestination) -> some View {
        switch destination {
        case let .metric(type, category, title):
            MetricDetailView(metricType: type, category: category, title: title)
        case .workoutLog:
            EmptyView()  // handled via sheet
        }
    }

    // MARK: - Formatters

    private func formatSteps(_ value: Double?) -> String {
        guard let v = value, v > 0 else { return "—" }
        if v >= 1_000 {
            return String(format: "%.1fK", v / 1_000)
        }
        return String(format: "%.0f", v)
    }

    private func formatSleep(_ mins: Double?) -> String {
        guard let m = mins, m > 0 else { return "—" }
        let h = Int(m / 60)
        let rem = Int(m.truncatingRemainder(dividingBy: 60))
        return rem > 0 ? "\(h)h \(rem)m" : "\(h)h"
    }

    /// Converts "YYYY-MM-DD" to a relative label like "Today", "Yesterday", or "3 Jan".
    private func relativeDate(_ dateStr: String) -> String {
        guard let date = DateRange.isoFormatter.date(from: dateStr) else { return dateStr }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return String(localized: "dashboard.overview.today") }
        if cal.isDateInYesterday(date) { return String(localized: "dashboard.overview.yesterday") }
        return date.formatted(.dateTime.day().month(.abbreviated))
    }
}

// MARK: - Preview

#Preview {
    DashboardView()
        .environment(AppState())
        .modelContainer(PersistenceController.preview.container)
}
