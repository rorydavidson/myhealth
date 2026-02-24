import HealthKit

/// Actor wrapping HKHealthStore.
/// All HealthKit interactions go through this single entry point to ensure
/// safe concurrent access and a clean API boundary.
actor HealthKitManager {
    static let shared = HealthKitManager()

    private let store = HKHealthStore()

    private init() {}

    // MARK: - Read types (Phase 2 — mirrors Phase 1 web app metrics)

    static let readTypes: Set<HKObjectType> = buildReadTypes()

    private static func buildReadTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()

        let quantityIdentifiers: [HKQuantityTypeIdentifier] = [
            // Activity
            .stepCount,
            .distanceWalkingRunning,
            .activeEnergyBurned,
            .flightsClimbed,
            // Heart
            .heartRate,
            .restingHeartRate,
            .heartRateVariabilitySDNN,
            // Body
            .bodyMass,
            .bodyFatPercentage,
            // Vitals
            .oxygenSaturation,
            .bloodPressureSystolic,
            .bloodPressureDiastolic,
            .respiratoryRate,
        ]

        for id in quantityIdentifiers {
            if let type = HKQuantityType.quantityType(forIdentifier: id) {
                types.insert(type)
            }
        }

        // Sleep
        if let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(sleepType)
        }

        // Workouts
        types.insert(HKObjectType.workoutType())

        return types
    }

    // MARK: - Availability

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    // MARK: - Authorisation

    /// Requests read authorisation for all Phase 2 metric types.
    /// Throws if HealthKit is unavailable (e.g. iPad or Simulator).
    func requestAuthorisation() async throws {
        guard isAvailable else {
            throw HealthKitError.unavailable
        }
        try await store.requestAuthorization(toShare: [], read: Self.readTypes)
    }

    func authorizationStatus(for type: HKObjectType) -> HKAuthorizationStatus {
        store.authorizationStatus(for: type)
    }

    // MARK: - Quantity Sample Queries

    /// Fetches quantity samples for a given type within a date range.
    func fetchQuantitySamples(
        type identifier: HKQuantityTypeIdentifier,
        from startDate: Date,
        to endDate: Date,
        limit: Int = HKObjectQueryNoLimit
    ) async throws -> [HKQuantitySample] {
        guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else {
            throw HealthKitError.invalidType(identifier.rawValue)
        }

        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: limit,
                sortDescriptors: [
                    NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
                ]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: (samples as? [HKQuantitySample]) ?? [])
                }
            }
            store.execute(query)
        }
    }

    // MARK: - Category Sample Queries

    /// Fetches category samples (e.g. sleep analysis) within a date range.
    func fetchCategorySamples(
        type identifier: HKCategoryTypeIdentifier,
        from startDate: Date,
        to endDate: Date
    ) async throws -> [HKCategorySample] {
        guard let type = HKCategoryType.categoryType(forIdentifier: identifier) else {
            throw HealthKitError.invalidType(identifier.rawValue)
        }

        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [
                    NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
                ]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: (samples as? [HKCategorySample]) ?? [])
                }
            }
            store.execute(query)
        }
    }

    // MARK: - Workout Queries

    func fetchWorkouts(from startDate: Date, to endDate: Date) async throws -> [HKWorkout] {
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: .workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [
                    NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
                ]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
                }
            }
            store.execute(query)
        }
    }

    // MARK: - Background Delivery

    func enableBackgroundDelivery(for type: HKObjectType, frequency: HKUpdateFrequency) async throws {
        guard isAvailable else { return }
        try await store.enableBackgroundDelivery(for: type, frequency: frequency)
    }
}

// MARK: - Errors

enum HealthKitError: Error, LocalizedError {
    case unavailable
    case invalidType(String)
    case queryFailed(Error)

    var errorDescription: String? {
        switch self {
        case .unavailable:
            String(localized: "healthKit.error.unavailable")
        case .invalidType(let id):
            String(localized: "healthKit.error.invalidType \(id)")
        case .queryFailed(let underlying):
            underlying.localizedDescription
        }
    }
}
