/**
 * Templater 2.26.0 InternalModuleDate.generate_now contract: both reference
 * arguments reach Moment unchanged, including an absent reference. Keep this
 * boundary faithful rather than replacing moment(undefined, format) with now.
 * Source: SilentVoid13/Templater commit 28c1ff7c7f0e535692dc829b3ed46f70a25d0c66,
 * src/core/functions/internal_functions/date/InternalModuleDate.ts (generate_now).
 */
export function createTemplaterDateNow(moment: typeof import("moment")) {
  return (format = "YYYY-MM-DD", offset?: number | string, reference?: string, referenceFormat?: string) => {
    if (reference && !moment(reference, referenceFormat).isValid()) {
      throw new Error("Invalid reference date format");
    }
    const duration = typeof offset === "string" ? moment.duration(offset)
      : typeof offset === "number" ? moment.duration(offset, "days") : undefined;
    return moment(reference, referenceFormat).add(duration).format(format);
  };
}
