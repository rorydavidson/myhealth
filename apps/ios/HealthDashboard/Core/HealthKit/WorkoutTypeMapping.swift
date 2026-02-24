import HealthKit

/// Maps `HKWorkoutActivityType` to internal workout type strings and localised display names.
///
/// The internal type strings mirror the Phase 1 web app constants so that data
/// exported from iOS and imported into the web app (or vice versa) is consistent.
enum WorkoutTypeMapping {

    // MARK: - Internal type string

    /// Returns the stable internal workout type string for a given HealthKit activity type.
    static func internalType(for activityType: HKWorkoutActivityType) -> String {
        switch activityType {
        case .running:                              return "running"
        case .walking:                              return "walking"
        case .cycling:                              return "cycling"
        case .swimming:                             return "swimming"
        case .yoga:                                 return "yoga"
        case .highIntensityIntervalTraining:        return "hiit"
        case .functionalStrengthTraining,
             .traditionalStrengthTraining:          return "strength_training"
        case .hiking:                               return "hiking"
        case .elliptical:                           return "elliptical"
        case .rowing:                               return "rowing"
        case .soccer:                               return "soccer"
        case .basketball:                           return "basketball"
        case .tennis:                               return "tennis"
        case .dance, .socialDance:                  return "dance"
        case .pilates:                              return "pilates"
        case .crossTraining:                        return "cross_training"
        case .stairClimbing:                        return "stair_climbing"
        case .jumpRope:                             return "jump_rope"
        case .boxing:                               return "boxing"
        case .martialArts:                          return "martial_arts"
        case .baseball:                             return "baseball"
        case .volleyball:                           return "volleyball"
        case .golf:                                 return "golf"
        case .downhillSkiing, .crossCountrySkiing:  return "skiing"
        case .snowboarding:                         return "snowboarding"
        case .waterFitness:                         return "water_fitness"
        case .wheelchairWalkPace,
             .wheelchairRunPace:                    return "wheelchair"
        default:                                    return "other"
        }
    }

    // MARK: - SF Symbol icon

    /// Returns the SF Symbols icon name for a given internal workout type.
    static func sfSymbol(for internalType: String) -> String {
        switch internalType {
        case "running":          return "figure.run"
        case "walking":          return "figure.walk"
        case "cycling":          return "figure.outdoor.cycle"
        case "swimming":         return "figure.pool.swim"
        case "yoga":             return "figure.yoga"
        case "hiit":             return "bolt.heart.fill"
        case "strength_training": return "dumbbell.fill"
        case "hiking":           return "figure.hiking"
        case "elliptical":       return "figure.elliptical"
        case "rowing":           return "figure.rowing"
        case "soccer":           return "soccerball"
        case "basketball":       return "basketball.fill"
        case "tennis":           return "tennisball.fill"
        case "dance":            return "figure.dance"
        case "pilates":          return "figure.pilates"
        case "cross_training":   return "figure.cross.training"
        case "stair_climbing":   return "figure.stair.stepper"
        case "jump_rope":        return "figure.jumprope"
        case "boxing":           return "figure.boxing"
        default:                 return "figure.mixed.cardio"
        }
    }

    // MARK: - Localised display name

    static func displayName(for internalType: String) -> String {
        switch internalType {
        case "running":           return String(localized: "workout.type.running")
        case "walking":           return String(localized: "workout.type.walking")
        case "cycling":           return String(localized: "workout.type.cycling")
        case "swimming":          return String(localized: "workout.type.swimming")
        case "yoga":              return String(localized: "workout.type.yoga")
        case "hiit":              return String(localized: "workout.type.hiit")
        case "strength_training": return String(localized: "workout.type.strengthTraining")
        case "hiking":            return String(localized: "workout.type.hiking")
        case "elliptical":        return String(localized: "workout.type.elliptical")
        case "rowing":            return String(localized: "workout.type.rowing")
        case "soccer":            return String(localized: "workout.type.soccer")
        case "basketball":        return String(localized: "workout.type.basketball")
        case "tennis":            return String(localized: "workout.type.tennis")
        case "dance":             return String(localized: "workout.type.dance")
        case "pilates":           return String(localized: "workout.type.pilates")
        case "cross_training":    return String(localized: "workout.type.crossTraining")
        case "stair_climbing":    return String(localized: "workout.type.stairClimbing")
        case "jump_rope":         return String(localized: "workout.type.jumpRope")
        case "boxing":            return String(localized: "workout.type.boxing")
        case "martial_arts":      return String(localized: "workout.type.martialArts")
        case "baseball":          return String(localized: "workout.type.baseball")
        case "volleyball":        return String(localized: "workout.type.volleyball")
        case "golf":              return String(localized: "workout.type.golf")
        case "skiing":            return String(localized: "workout.type.skiing")
        case "snowboarding":      return String(localized: "workout.type.snowboarding")
        case "water_fitness":     return String(localized: "workout.type.waterFitness")
        case "wheelchair":        return String(localized: "workout.type.wheelchair")
        default:                  return String(localized: "workout.type.other")
        }
    }
}
