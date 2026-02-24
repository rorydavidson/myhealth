import HealthKit
import Foundation

/// Groups individual `HKCategorySample` sleep-stage samples into logical sleep sessions.
///
/// Apple Health returns sleep data as separate stage samples — awake, core, deep, REM —
/// that may have small gaps between them (e.g. a brief wake-up between sleep cycles).
/// Samples within 30 minutes of each other are grouped into a single session, mirroring
/// the Phase 1 web app grouping logic in `normalize.ts`.
///
/// Usage:
/// ```swift
/// let samples = try await hkManager.fetchCategorySamples(type: .sleepAnalysis, ...)
/// let sessions = SleepSessionGrouper.group(samples: samples)
/// ```
enum SleepSessionGrouper {

    /// Maximum gap between the end of one sample and the start of the next
    /// for them to still be considered the same sleep session.
    private static let sessionGapThreshold: TimeInterval = 30 * 60  // 30 minutes

    // MARK: - Session type

    struct Session: Sendable {
        /// When the session started (start of the earliest sample in the group).
        let startTime: Date
        /// When the session ended (end of the latest sample in the group).
        let endTime: Date
        /// Total duration in minutes: awake + core + deep + REM.
        /// This is what gets stored in `HealthRecord.value`.
        let totalMinutes: Double
        let awakeMins: Double
        let coreMins: Double
        let deepMins: Double
        let remMins: Double
    }

    // MARK: - Public API

    /// Groups the given samples into sessions.
    ///
    /// - Parameter samples: Raw `HKCategorySample` values from HealthKit.
    ///   May contain any mix of awake / core / deep / REM / in-bed samples.
    ///   The order does not matter — samples are sorted internally.
    /// - Returns: An array of `Session` values in chronological order.
    static func group(samples: [HKCategorySample]) -> [Session] {
        guard !samples.isEmpty else { return [] }

        // Sort ascending so we can scan left-to-right and detect gaps
        let sorted = samples.sorted { $0.startDate < $1.startDate }

        var sessions: [Session] = []
        var bucket: [HKCategorySample] = []

        for sample in sorted {
            if let last = bucket.last,
               sample.startDate.timeIntervalSince(last.endDate) > sessionGapThreshold
            {
                // Gap exceeds threshold — flush the current bucket as a session
                if let session = buildSession(from: bucket) {
                    sessions.append(session)
                }
                bucket = [sample]
            } else {
                bucket.append(sample)
            }
        }

        // Flush the final bucket
        if let session = buildSession(from: bucket) {
            sessions.append(session)
        }

        return sessions
    }

    // MARK: - Private

    private static func buildSession(from samples: [HKCategorySample]) -> Session? {
        guard let first = samples.first, let last = samples.last else { return nil }

        var awakeMins = 0.0
        var coreMins  = 0.0
        var deepMins  = 0.0
        var remMins   = 0.0

        for sample in samples {
            let durationMins = sample.endDate.timeIntervalSince(sample.startDate) / 60.0
            guard let value = HKCategoryValueSleepAnalysis(rawValue: sample.value) else { continue }

            switch value {
            case .awake:
                awakeMins += durationMins
            case .asleepCore:
                coreMins  += durationMins
            case .asleepDeep:
                deepMins  += durationMins
            case .asleepREM:
                remMins   += durationMins
            case .asleepUnspecified:
                // Treat unspecified sleep (pre-iOS 16 records) as core sleep
                coreMins  += durationMins
            case .inBed:
                // "In bed" is not a sleep stage — excluded from stage totals
                break
            @unknown default:
                break
            }
        }

        let totalMins = awakeMins + coreMins + deepMins + remMins

        // A session with zero sleep time (pure in-bed records) is still valid —
        // return it so users can see time in bed on nights with no stage data.
        return Session(
            startTime: first.startDate,
            endTime: last.endDate,
            totalMinutes: totalMins,
            awakeMins: awakeMins,
            coreMins: coreMins,
            deepMins: deepMins,
            remMins: remMins
        )
    }
}
