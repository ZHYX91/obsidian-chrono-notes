export const OBSERVANCE_GROUPS = [
  "western", "orthodox", "nowruz", "hebrew-feasts", "ethiopian-new-year",
] as const;
export type ObservanceGroup = typeof OBSERVANCE_GROUPS[number];

export function isObservanceGroup(value: unknown): value is ObservanceGroup {
  return OBSERVANCE_GROUPS.some(group => group === value);
}
