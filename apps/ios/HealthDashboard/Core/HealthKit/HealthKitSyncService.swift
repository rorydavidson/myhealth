import HealthKit
import SwiftData
import BackgroundTasks
import Foundation

// MARK: - SyncProgress

/// Progress events emitted during an initial or incremental HealthKit sync.
/// `Sendable` so it can cross actor boundaries into `@MainActor` UI code.
struct SyncProgress: Sendable {
    enum Phase: Sendable, Equatable {
        /// Querying HealthKit for the given metric type.
        case querying(metricType: String)
        /// Writing a batch of records to Swift Data.
        case storing
        /// Recomputing daily summaries after all records are inserted.
        case computingSummaries
        /// All work finished — `recordCount` is the total records inserted this run.
        case complete(recordCount: Int)
        /// A fatal error aborted the sync.
        case failed(String)
    }

    let phase: Phase
    /// Cumulative records processed so far during this sync run.
    let recordsProcessed: Int
}

// MARK: - HealthKitSyncService

/// Orchestrates all HealthKit data ingestion: initial historical load (14.1),
/// real-time observer queries (14.2), background delivery (14.3),
/// workout processing (14.4), and sleep session grouping (14.5).
///
/// Call order (guaranteed by the app):
/// 1. `performInitialLoad(container:onProgress:)` — once, after first HealthKit auth.
/// 2. `startObserving(container:)` — after initial load completes; also on every launch.
/// 3. `enableBackgroundDelivery()` — once, alongside startObserving.
actor HealthKitSyncService {
    static let shared = HealthKitSyncService()
    private init() {}

    private let hk = HealthKitManager.shared
    private let aggregation = AggregationService.shared

    /// `UserDefaults` key that records whether the one-time 5-year load has run.
    static let initialLoadDoneKey = "hk_initial_load_completed"

    /// `UserDefaults` key prefix for per-type anchors: `"hk_anchor_<identifier>"`.
    private static let anchorKeyPrefix = "hk_anchor_"

    /// Maximum records inserted per Swift Data save call (avoids memory spikes).
    private static let batchSize = 500

    // MARK: - 14.1 Initial HealthKit Data Load

    /// Queries all available HealthKit data for the past 5 years, normalises each
    /// sample into a `HealthRecord`, batch-inserts to Swift Data, creates a
    /// synthetic `HealthImport` record, and computes daily summaries.
    ///
    /// Progress is reported via `onProgress`, which is called on the actor's executor.
    /// The caller should dispatch UI updates to `@MainActor`.
    ///
    /// This method is idempotent: re-running it will skip samples whose UUID is
    /// already stored (deduplication by `HealthRecord.id == sample.uuid`).
    func performInitialLoad(
        container: ModelContainer,
        onProgress: @escaping @Sendable (SyncProgress) -> Void
    ) async {
        let context = ModelContext(container)
        let importRecord = HealthImport(platform: .appleHealth, startedAt: .now)
        context.insert(importRecord)
        try? context.save()

        let importId = importRecord.id
        let fiveYearsAgo = Calendar.current.date(byAdding: .year, value: -5, to: .now) ?? .now
        let now = Date.now

        // Pre-fetch existing IDs for fast deduplication (O(1) per lookup)
        var existingIDs: Set<String> = []
        if let existing = try? context.fetch(FetchDescriptor<HealthRecord>()) {
            existingIDs = Set(existing.map(\.id))
        }

        var totalInserted = 0
        var earliestDate = now
        var latestDate = fiveYearsAgo

        // --- Quantity types (activity, heart, body, vitals) ---
        for (identifier, metricType) in MetricTypeMapping.quantityTypeMap {
            onProgress(SyncProgress(phase: .querying(metricType: metricType), recordsProcessed: totalInserted))

            guard let hkUnit = MetricTypeMapping.unit(for: identifier) else { continue }

            do {
                let samples = try await hk.fetchQuantitySamples(
                    type: identifier,
                    from: fiveYearsAgo,
                    to: now
                )

                // Explicit `-> HealthRecord?` annotation lets compactMap return nil for dupes
                let records: [HealthRecord] = samples.compactMap { sample -> HealthRecord? in
                    let sampleID = sample.uuid.uuidString
                    guard !existingIDs.contains(sampleID) else { return nil }
                    return HealthRecord(
                        id: sampleID,
                        metricType: metricType,
                        value: sample.quantity.doubleValue(for: hkUnit),
                        unit: MetricTypeMapping.unitString(for: identifier),
                        startTime: sample.startDate,
                        endTime: sample.endDate,
                        sourcePlatform: "apple_health",
                        sourceDevice: sample.sourceRevision.source.name,
                        sourceType: identifier.rawValue,
                        importId: importId
                    )
                }

                let inserted = try batchInsert(
                    records: records,
                    existingIDs: &existingIDs,
                    context: context,
                    onProgress: { onProgress(SyncProgress(phase: .storing, recordsProcessed: totalInserted + $0)) }
                )
                totalInserted += inserted

                for record in records {
                    if record.startTime < earliestDate { earliestDate = record.startTime }
                    if record.startTime > latestDate   { latestDate   = record.startTime }
                }
            } catch {
                // Non-fatal: one metric type failing should not abort the whole load
            }
        }

        // --- Sleep (14.5) ---
        onProgress(SyncProgress(phase: .querying(metricType: "sleep_session"), recordsProcessed: totalInserted))
        do {
            let sleepSamples = try await hk.fetchCategorySamples(
                type: .sleepAnalysis,
                from: fiveYearsAgo,
                to: now
            )
            let sessions = SleepSessionGrouper.group(samples: sleepSamples)
            let records: [HealthRecord] = sessions.map { session in
                let metadata = SleepMetadata(
                    awakeMins: session.awakeMins,
                    coreMins: session.coreMins,
                    deepMins: session.deepMins,
                    remMins: session.remMins
                )
                return HealthRecord(
                    metricType: "sleep_session",
                    value: session.totalMinutes,
                    unit: "min",
                    startTime: session.startTime,
                    endTime: session.endTime,
                    sourcePlatform: "apple_health",
                    sourceType: HKCategoryTypeIdentifier.sleepAnalysis.rawValue,
                    importId: importId,
                    metadata: metadata
                )
            }
            let inserted = try batchInsert(
                records: records,
                existingIDs: &existingIDs,
                context: context,
                onProgress: { _ in }
            )
            totalInserted += inserted
        } catch {
            // Non-fatal
        }

        // --- Workouts (14.4) ---
        onProgress(SyncProgress(phase: .querying(metricType: "workout"), recordsProcessed: totalInserted))
        do {
            let workouts = try await hk.fetchWorkouts(from: fiveYearsAgo, to: now)
            let records: [HealthRecord] = workouts.compactMap { workout -> HealthRecord? in
                let workoutID = workout.uuid.uuidString
                guard !existingIDs.contains(workoutID) else { return nil }

                let distanceMeters = workout
                    .statistics(for: HKQuantityType(.distanceWalkingRunning))?
                    .sumQuantity()?.doubleValue(for: .meter())
                let energyKcal = workout
                    .statistics(for: HKQuantityType(.activeEnergyBurned))?
                    .sumQuantity()?.doubleValue(for: .kilocalorie())

                let metadata = WorkoutMetadata(
                    workoutType: WorkoutTypeMapping.internalType(for: workout.workoutActivityType),
                    durationSeconds: workout.duration,
                    distanceMeters: distanceMeters,
                    activeEnergyKcal: energyKcal
                )
                return HealthRecord(
                    id: workoutID,
                    metricType: "workout",
                    unit: "",
                    startTime: workout.startDate,
                    endTime: workout.endDate,
                    sourcePlatform: "apple_health",
                    sourceDevice: workout.sourceRevision.source.name,
                    sourceType: "HKWorkoutType",
                    importId: importId,
                    metadata: metadata
                )
            }
            let inserted = try batchInsert(
                records: records,
                existingIDs: &existingIDs,
                context: context,
                onProgress: { _ in }
            )
            totalInserted += inserted
        } catch {
            // Non-fatal
        }

        // --- Compute daily summaries ---
        onProgress(SyncProgress(phase: .computingSummaries, recordsProcessed: totalInserted))
        do {
            // AggregationService creates its own ModelContext from the container
            // so ModelContext (non-Sendable) never crosses the actor boundary.
            try await aggregation.recomputeAll(in: container)
        } catch {
            // Non-fatal — summaries can be recomputed on next launch
        }

        // --- Finalise the import record ---
        importRecord.completedAt = .now
        importRecord.recordCount = totalInserted
        importRecord.status = ImportStatus.completed.rawValue
        if totalInserted > 0 {
            importRecord.dateRangeStart = earliestDate
            importRecord.dateRangeEnd   = latestDate
        }
        try? context.save()

        // Mark as done so we don't re-run the full historical load on next launch
        UserDefaults.standard.set(true, forKey: Self.initialLoadDoneKey)

        onProgress(SyncProgress(phase: .complete(recordCount: totalInserted), recordsProcessed: totalInserted))
    }

    // MARK: - 14.2 Observer Queries

    /// Registers long-running `HKAnchoredObjectQuery` observers for all metric types.
    ///
    /// On first run the anchored query will attempt to re-fetch all historical
    /// records, but the UUID-based deduplication ensures no duplicates are stored.
    /// The anchor advances automatically so subsequent calls only deliver new data.
    ///
    /// Call this once after `performInitialLoad` returns, and again on every app launch
    /// so that any data written while the app was in the background is picked up.
    func startObserving(container: ModelContainer) async {
        guard await hk.isAvailable else { return }

        // Quantity types
        for identifier in MetricTypeMapping.quantityTypeMap.keys {
            guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else { continue }
            let anchor = loadAnchor(for: type.identifier)

            await hk.registerAnchoredObserver(for: type, anchor: anchor) { [weak self] newSamples, newAnchor in
                guard let self else { return }
                Task {
                    await self.processIncrementalSamples(newSamples, container: container)
                    if let newAnchor { await self.saveAnchor(newAnchor, for: type.identifier) }
                }
            }
        }

        // Sleep
        if let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) {
            let anchor = loadAnchor(for: sleepType.identifier)
            await hk.registerAnchoredObserver(for: sleepType, anchor: anchor) { [weak self] newSamples, newAnchor in
                guard let self else { return }
                Task {
                    await self.processIncrementalSleepSamples(
                        newSamples.compactMap { $0 as? HKCategorySample },
                        container: container
                    )
                    if let newAnchor { await self.saveAnchor(newAnchor, for: sleepType.identifier) }
                }
            }
        }

        // Workouts — HKWorkoutType is a subclass of HKSampleType; `as` is sufficient
        let workoutType = HKObjectType.workoutType()
        let workoutAnchor = loadAnchor(for: workoutType.identifier)
        await hk.registerAnchoredObserver(for: workoutType as HKSampleType, anchor: workoutAnchor) {
            [weak self] newSamples, newAnchor in
            guard let self else { return }
            Task {
                await self.processIncrementalWorkouts(
                    newSamples.compactMap { $0 as? HKWorkout },
                    container: container
                )
                if let newAnchor { await self.saveAnchor(newAnchor, for: workoutType.identifier) }
            }
        }
    }

    // MARK: - 14.3 Background Delivery

    /// Enables HealthKit background delivery for all observed types.
    ///
    /// After enabling, HealthKit will wake the app in the background when new data
    /// arrives, firing the registered observer query update handlers.
    ///
    /// Call this once alongside `startObserving`.
    func enableBackgroundDelivery() async {
        guard await hk.isAvailable else { return }

        for identifier in MetricTypeMapping.quantityTypeMap.keys {
            guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else { continue }
            try? await hk.enableBackgroundDelivery(for: type, frequency: .immediate)
        }

        if let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) {
            // Hourly is sufficient for sleep — it's written at the end of a session
            try? await hk.enableBackgroundDelivery(for: sleepType, frequency: .hourly)
        }

        try? await hk.enableBackgroundDelivery(for: .workoutType(), frequency: .immediate)
    }

    // MARK: - Background Task Handler

    /// Called by the `BGAppRefreshTask` registered in `HealthDashboardApp`.
    /// Recomputes daily summaries for today so the dashboard is fresh when the
    /// app returns to the foreground.
    func handleBackgroundRefresh(container: ModelContainer) async {
        let today = isoDateString(from: .now)

        // Recompute today's summaries for every metric type
        let affectedDays = MetricTypeMapping.quantityTypeMap.values.map {
            (metricType: $0, date: today)
        } + [("sleep_session", today), ("workout", today)]

        try? await aggregation.recompute(affectedDays: affectedDays, in: container)
    }

    // MARK: - Incremental processing

    private func processIncrementalSamples(
        _ samples: [HKSample],
        container: ModelContainer
    ) async {
        let quantitySamples = samples.compactMap { $0 as? HKQuantitySample }
        guard !quantitySamples.isEmpty else { return }

        let context = ModelContext(container)
        let importRecord = HealthImport(platform: .appleHealth, startedAt: .now)
        context.insert(importRecord)

        var affectedDays: [(metricType: String, date: String)] = []

        for sample in quantitySamples {
            let identifier = HKQuantityTypeIdentifier(rawValue: sample.sampleType.identifier)
            guard
                let metricType = MetricTypeMapping.metricType(for: identifier),
                let hkUnit = MetricTypeMapping.unit(for: identifier)
            else { continue }

            let sampleID = sample.uuid.uuidString
            // Deduplication
            var dedupDescriptor = FetchDescriptor<HealthRecord>(
                predicate: #Predicate { $0.id == sampleID }
            )
            dedupDescriptor.fetchLimit = 1
            guard (try? context.fetch(dedupDescriptor))?.isEmpty == true else { continue }

            let record = HealthRecord(
                id: sampleID,
                metricType: metricType,
                value: sample.quantity.doubleValue(for: hkUnit),
                unit: MetricTypeMapping.unitString(for: identifier),
                startTime: sample.startDate,
                endTime: sample.endDate,
                sourcePlatform: "apple_health",
                sourceDevice: sample.sourceRevision.source.name,
                sourceType: identifier.rawValue,
                importId: importRecord.id
                // No metadata for quantity records; type inferred as (any Encodable)? = nil
            )
            context.insert(record)
            affectedDays.append((metricType: metricType, date: isoDateString(from: sample.startDate)))
        }

        importRecord.completedAt = .now
        importRecord.recordCount = affectedDays.count
        importRecord.status = ImportStatus.completed.rawValue
        try? context.save()

        try? await aggregation.recompute(affectedDays: affectedDays, in: container)
    }

    private func processIncrementalSleepSamples(
        _ samples: [HKCategorySample],
        container: ModelContainer
    ) async {
        guard !samples.isEmpty else { return }

        let sessions = SleepSessionGrouper.group(samples: samples)
        let context = ModelContext(container)
        let importRecord = HealthImport(platform: .appleHealth, startedAt: .now)
        context.insert(importRecord)

        var affectedDays: [(metricType: String, date: String)] = []

        for session in sessions {
            let metadata = SleepMetadata(
                awakeMins: session.awakeMins,
                coreMins: session.coreMins,
                deepMins: session.deepMins,
                remMins: session.remMins
            )
            let record = HealthRecord(
                metricType: "sleep_session",
                value: session.totalMinutes,
                unit: "min",
                startTime: session.startTime,
                endTime: session.endTime,
                sourcePlatform: "apple_health",
                sourceType: HKCategoryTypeIdentifier.sleepAnalysis.rawValue,
                importId: importRecord.id,
                metadata: metadata
            )
            context.insert(record)
            affectedDays.append((metricType: "sleep_session", date: isoDateString(from: session.startTime)))
        }

        importRecord.completedAt = .now
        importRecord.recordCount = sessions.count
        importRecord.status = ImportStatus.completed.rawValue
        try? context.save()

        try? await aggregation.recompute(affectedDays: affectedDays, in: container)
    }

    private func processIncrementalWorkouts(
        _ workouts: [HKWorkout],
        container: ModelContainer
    ) async {
        guard !workouts.isEmpty else { return }

        let context = ModelContext(container)
        let importRecord = HealthImport(platform: .appleHealth, startedAt: .now)
        context.insert(importRecord)

        var inserted = 0

        for workout in workouts {
            let workoutID = workout.uuid.uuidString
            var dedupDescriptor = FetchDescriptor<HealthRecord>(
                predicate: #Predicate { $0.id == workoutID }
            )
            dedupDescriptor.fetchLimit = 1
            guard (try? context.fetch(dedupDescriptor))?.isEmpty == true else { continue }

            let distanceMeters = workout
                .statistics(for: HKQuantityType(.distanceWalkingRunning))?
                .sumQuantity()?.doubleValue(for: .meter())
            let energyKcal = workout
                .statistics(for: HKQuantityType(.activeEnergyBurned))?
                .sumQuantity()?.doubleValue(for: .kilocalorie())

            let metadata = WorkoutMetadata(
                workoutType: WorkoutTypeMapping.internalType(for: workout.workoutActivityType),
                durationSeconds: workout.duration,
                distanceMeters: distanceMeters,
                activeEnergyKcal: energyKcal
            )
            let record = HealthRecord(
                id: workoutID,
                metricType: "workout",
                unit: "",
                startTime: workout.startDate,
                endTime: workout.endDate,
                sourcePlatform: "apple_health",
                sourceDevice: workout.sourceRevision.source.name,
                sourceType: "HKWorkoutType",
                importId: importRecord.id,
                metadata: metadata
            )
            context.insert(record)
            inserted += 1
        }

        importRecord.completedAt = .now
        importRecord.recordCount = inserted
        importRecord.status = ImportStatus.completed.rawValue
        try? context.save()
    }

    // MARK: - Anchor persistence

    private func loadAnchor(for typeIdentifier: String) -> HKQueryAnchor? {
        let key = Self.anchorKeyPrefix + typeIdentifier
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
    }

    private func saveAnchor(_ anchor: HKQueryAnchor, for typeIdentifier: String) {
        let key = Self.anchorKeyPrefix + typeIdentifier
        if let data = try? NSKeyedArchiver.archivedData(withRootObject: anchor, requiringSecureCoding: true) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    // MARK: - Batch insert helper

    /// Inserts records in batches of `batchSize`, saving after each batch.
    /// Skips records whose id is already in `existingIDs` and mutates the set
    /// to include newly inserted IDs, preventing duplicates within the same load.
    ///
    /// - Returns: Number of records actually inserted.
    @discardableResult
    private func batchInsert(
        records: [HealthRecord],
        existingIDs: inout Set<String>,
        context: ModelContext,
        onProgress: (Int) -> Void
    ) throws -> Int {
        var inserted = 0
        for record in records {
            guard !existingIDs.contains(record.id) else { continue }
            context.insert(record)
            existingIDs.insert(record.id)
            inserted += 1

            // Save and report progress after each batch
            if inserted % Self.batchSize == 0 {
                try context.save()
                onProgress(inserted)
            }
        }
        // Final save for any remaining records in the last partial batch
        if inserted % Self.batchSize != 0 {
            try context.save()
        }
        return inserted
    }

    // MARK: - Utilities

    private static let isoDateFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone = TimeZone(identifier: "UTC")!
        return fmt
    }()

    private func isoDateString(from date: Date) -> String {
        Self.isoDateFormatter.string(from: date)
    }
}
