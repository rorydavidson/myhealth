/**
 * Maps Apple Health workout activity type identifiers to i18n translation keys.
 * Used by the workout log to display human-readable workout type names.
 */

const APPLE_WORKOUT_TYPE_MAP: Record<string, string> = {
  HKWorkoutActivityTypeRunning: "running",
  HKWorkoutActivityTypeWalking: "walking",
  HKWorkoutActivityTypeCycling: "cycling",
  HKWorkoutActivityTypeSwimming: "swimming",
  HKWorkoutActivityTypeHiking: "hiking",
  HKWorkoutActivityTypeYoga: "yoga",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "strength",
  HKWorkoutActivityTypeHighIntensityIntervalTraining: "hiit",
  HKWorkoutActivityTypeDance: "dance",
  HKWorkoutActivityTypeElliptical: "elliptical",
  HKWorkoutActivityTypeRowing: "rowing",
  HKWorkoutActivityTypeStairClimbing: "stairClimbing",
  HKWorkoutActivityTypeCrossTraining: "crossTraining",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "functionalStrength",
  HKWorkoutActivityTypeCoreTraining: "coreTraining",
  HKWorkoutActivityTypeFlexibility: "flexibility",
  HKWorkoutActivityTypePilates: "pilates",
  HKWorkoutActivityTypeKickboxing: "kickboxing",
  HKWorkoutActivityTypeTennis: "tennis",
  HKWorkoutActivityTypeBasketball: "basketball",
  HKWorkoutActivityTypeSoccer: "soccer",
  HKWorkoutActivityTypeGolf: "golf",
  HKWorkoutActivityTypeDownhillSkiing: "skiing",
  HKWorkoutActivityTypeCrossCountrySkiing: "skiing",
  HKWorkoutActivityTypeSnowboarding: "snowboarding",
  HKWorkoutActivityTypeSurfingSports: "surfing",
  HKWorkoutActivityTypeClimbing: "climbing",
  HKWorkoutActivityTypeMartialArts: "martialArts",
  HKWorkoutActivityTypeCooldown: "cooldown",
  HKWorkoutActivityTypeOther: "other",
};

/**
 * Returns the i18n key for a workout activity type.
 * Falls back to "other" for unknown types.
 */
export function getWorkoutTypeKey(activityType: string): string {
  return APPLE_WORKOUT_TYPE_MAP[activityType] ?? "other";
}

/**
 * Returns all unique workout type keys from a list of activity types.
 */
export function getUniqueWorkoutTypeKeys(activityTypes: string[]): string[] {
  const keys = new Set(activityTypes.map(getWorkoutTypeKey));
  return [...keys].sort();
}
