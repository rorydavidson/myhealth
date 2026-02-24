import HealthKit

/// Maps HealthKit type identifiers to internal metricType strings,
/// mirroring the Phase 1 web app mapping in `normalize.ts`.
enum MetricTypeMapping {
    // MARK: - Quantity Types

    static let quantityTypeMap: [HKQuantityTypeIdentifier: String] = [
        // Activity
        .stepCount: "step_count",
        .distanceWalkingRunning: "distance",
        .activeEnergyBurned: "active_energy",
        .flightsClimbed: "flights_climbed",
        // Heart
        .heartRate: "heart_rate",
        .restingHeartRate: "resting_heart_rate",
        .heartRateVariabilitySDNN: "hrv",
        // Body
        .bodyMass: "body_mass",
        .bodyFatPercentage: "body_fat",
        // Vitals
        .oxygenSaturation: "oxygen_saturation",
        .bloodPressureSystolic: "blood_pressure_systolic",
        .bloodPressureDiastolic: "blood_pressure_diastolic",
        .respiratoryRate: "respiratory_rate",
    ]

    // MARK: - Category Types

    static let categoryTypeMap: [HKCategoryTypeIdentifier: String] = [
        .sleepAnalysis: "sleep_session",
    ]

    // MARK: - Units (SI / metric internal storage)

    /// Returns the HKUnit to use when extracting the double value from a quantity sample.
    static func unit(for identifier: HKQuantityTypeIdentifier) -> HKUnit? {
        switch identifier {
        case .stepCount:                    return .count()
        case .distanceWalkingRunning:       return .meter()
        case .activeEnergyBurned:           return .kilocalorie()
        case .flightsClimbed:              return .count()
        case .heartRate:                    return HKUnit.count().unitDivided(by: .minute())
        case .restingHeartRate:             return HKUnit.count().unitDivided(by: .minute())
        case .heartRateVariabilitySDNN:     return .secondUnit(with: .milli)
        case .bodyMass:                     return .gramUnit(with: .kilo)
        case .bodyFatPercentage:            return .percent()
        case .oxygenSaturation:             return .percent()
        case .bloodPressureSystolic:        return .millimeterOfMercury()
        case .bloodPressureDiastolic:       return .millimeterOfMercury()
        case .respiratoryRate:              return HKUnit.count().unitDivided(by: .minute())
        default:                            return nil
        }
    }

    /// Returns the internal unit string stored in HealthRecord.unit
    static func unitString(for identifier: HKQuantityTypeIdentifier) -> String {
        switch identifier {
        case .stepCount:                    return "count"
        case .distanceWalkingRunning:       return "m"
        case .activeEnergyBurned:           return "kcal"
        case .flightsClimbed:              return "count"
        case .heartRate:                    return "bpm"
        case .restingHeartRate:             return "bpm"
        case .heartRateVariabilitySDNN:     return "ms"
        case .bodyMass:                     return "kg"
        case .bodyFatPercentage:            return "%"
        case .oxygenSaturation:             return "%"
        case .bloodPressureSystolic:        return "mmHg"
        case .bloodPressureDiastolic:       return "mmHg"
        case .respiratoryRate:              return "breaths/min"
        default:                            return ""
        }
    }

    // MARK: - Lookup helpers

    static func metricType(for quantityIdentifier: HKQuantityTypeIdentifier) -> String? {
        quantityTypeMap[quantityIdentifier]
    }

    static func metricType(for categoryIdentifier: HKCategoryTypeIdentifier) -> String? {
        categoryTypeMap[categoryIdentifier]
    }

    static func metricCategory(for metricType: String) -> MetricCategory {
        switch metricType {
        case "step_count", "distance", "active_energy", "flights_climbed":
            return .activity
        case "heart_rate", "resting_heart_rate", "hrv":
            return .heart
        case "sleep_session":
            return .sleep
        case "body_mass", "body_fat":
            return .body
        case "oxygen_saturation", "blood_pressure_systolic", "blood_pressure_diastolic", "blood_pressure", "respiratory_rate":
            return .vitals
        default:
            return .activity
        }
    }
}
