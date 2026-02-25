import SwiftUI
import SwiftData
import Charts

/// Lab Timeline — tracks a specific lab value across multiple reports over time.
///
/// User selects a test name from those present in their results; the chart
/// shows the value trend as a Swift Charts line chart.
@MainActor
struct LabTimelineView: View {
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \LabResult.date)
    private var labResults: [LabResult]

    @State private var selectedTestName: String?
    @State private var showTestPicker = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Test selector
                    testSelectorButton

                    if let testName = selectedTestName {
                        let points = timelinePoints(for: testName)
                        if points.count >= 2 {
                            timelineChart(points: points, testName: testName)
                            pointsTable(points: points, testName: testName)
                        } else if points.count == 1 {
                            singlePointNote(points[0], testName: testName)
                        } else {
                            noDataForTest(testName)
                        }
                    } else {
                        selectTestPrompt
                    }
                }
                .padding(16)
            }
            .navigationTitle(String(localized: "lab.timeline.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(String(localized: "common.done")) { dismiss() }
                }
            }
            .sheet(isPresented: $showTestPicker) {
                testPickerSheet
            }
            .onAppear {
                // Pre-select the first available test on first open
                if selectedTestName == nil {
                    selectedTestName = availableTestNames.first
                }
            }
        }
    }

    // MARK: - Test selector

    private var testSelectorButton: some View {
        Button {
            showTestPicker = true
        } label: {
            HStack {
                Image(systemName: "flask.fill")
                    .font(.subheadline)
                    .foregroundStyle(DesignTokens.Colors.labResults)
                Text(selectedTestName ?? String(localized: "lab.timeline.selectTest"))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(selectedTestName != nil ? .primary : .secondary)
                Spacer()
                Image(systemName: "chevron.down")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.secondary.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.button))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Timeline chart

    private func timelineChart(points: [TimelinePoint], testName: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(testName)
                .font(.subheadline.weight(.semibold))

            if let unit = points.first?.unit, !unit.isEmpty {
                Text(unit)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Chart(points) { point in
                LineMark(
                    x: .value(String(localized: "chart.axis.date"), point.date),
                    y: .value(testName, point.value)
                )
                .foregroundStyle(DesignTokens.Colors.labResults)
                .lineStyle(StrokeStyle(lineWidth: 2))
                .interpolationMethod(.catmullRom)

                AreaMark(
                    x: .value(String(localized: "chart.axis.date"), point.date),
                    y: .value(testName, point.value)
                )
                .foregroundStyle(DesignTokens.Colors.labResults.chartGradient())

                PointMark(
                    x: .value(String(localized: "chart.axis.date"), point.date),
                    y: .value(testName, point.value)
                )
                .foregroundStyle(DesignTokens.Colors.labResults)
                .symbolSize(40)
                .annotation(position: .top, spacing: 4) {
                    if let flag = point.flag {
                        Image(systemName: flag == .high || flag == .critical ? "arrow.up.circle.fill" : "arrow.down.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(flag.color)
                    }
                }
            }
            .frame(height: 200)
            .chartXAxis {
                AxisMarks(values: .stride(by: .month, count: 3)) { _ in
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.month(.abbreviated).year(.twoDigits))
                }
            }
            .chartYAxis {
                AxisMarks { _ in
                    AxisGridLine()
                    AxisValueLabel()
                }
            }
        }
        .padding(14)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
    }

    // MARK: - Points table

    private func pointsTable(points: [TimelinePoint], testName: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(String(localized: "lab.timeline.history"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)

            Divider()

            ForEach(points.reversed()) { point in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(point.sourceName)
                            .font(.subheadline)
                            .lineLimit(1)
                        Text(point.formattedDate)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(point.formattedValue)
                            .font(.subheadline.bold().monospacedDigit())
                        Text(point.unit)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if let flag = point.flag {
                        Text(flag.displayName)
                            .font(.caption2.weight(.medium))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(flag.color.opacity(0.12))
                            .foregroundStyle(flag.color)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)

                Divider()
                    .padding(.leading, 14)
            }
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
    }

    // MARK: - Single-point note

    private func singlePointNote(_ point: TimelinePoint, testName: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.title2)
                .foregroundStyle(DesignTokens.Colors.labResults.opacity(0.4))
            Text(String(localized: "lab.timeline.needMoreData"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(point.formattedValue)
                    .font(.title2.bold().monospacedDigit())
                Text(point.unit)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(point.formattedDate)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
    }

    private func noDataForTest(_ testName: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "questionmark.circle")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(String(localized: "lab.timeline.noDataForTest"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
    }

    // MARK: - Select test prompt

    private var selectTestPrompt: some View {
        VStack(spacing: 12) {
            Image(systemName: "flask.fill")
                .font(.system(size: 40))
                .foregroundStyle(DesignTokens.Colors.labResults.opacity(0.3))
            Text(String(localized: "lab.timeline.selectPrompt"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }

    // MARK: - Test picker sheet

    private var testPickerSheet: some View {
        NavigationStack {
            List(availableTestNames, id: \.self) { name in
                Button {
                    selectedTestName = name
                    showTestPicker = false
                } label: {
                    HStack {
                        Text(name)
                            .foregroundStyle(.primary)
                        Spacer()
                        if name == selectedTestName {
                            Image(systemName: "checkmark")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(DesignTokens.Colors.labResults)
                        }
                    }
                }
            }
            .navigationTitle(String(localized: "lab.timeline.selectTest"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(String(localized: "common.done")) { showTestPicker = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Data helpers

    /// All distinct test names that appear in at least one result.
    private var availableTestNames: [String] {
        var names = Set<String>()
        for result in labResults {
            if let values = result.structuredValues {
                names.formUnion(values.keys)
            }
        }
        return names.sorted()
    }

    /// `TimelinePoint` series for a given test name, sorted by date ascending.
    private func timelinePoints(for testName: String) -> [TimelinePoint] {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withFullDate]
        var points: [TimelinePoint] = []

        for result in labResults {
            guard let values = result.structuredValues,
                  let val = values[testName],
                  let date = isoFormatter.date(from: result.date)
            else { continue }

            points.append(TimelinePoint(
                id: "\(result.id):\(testName)",
                date: date,
                value: val.value,
                unit: val.unit,
                flag: val.flag,
                sourceName: result.fileName
            ))
        }

        return points.sorted { $0.date < $1.date }
    }
}

// MARK: - TimelinePoint

private struct TimelinePoint: Identifiable {
    let id: String
    let date: Date
    let value: Double
    let unit: String
    let flag: LabValue.LabFlag?
    let sourceName: String

    var formattedDate: String {
        date.formatted(date: .abbreviated, time: .omitted)
    }

    var formattedValue: String {
        value.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", value)
            : String(format: "%.2f", value)
    }
}

// MARK: - Preview

#Preview {
    LabTimelineView()
        .modelContainer(for: LabResult.self, inMemory: true)
}
