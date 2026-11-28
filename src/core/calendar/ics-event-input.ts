import ICAL from "ical.js";

type Component = InstanceType<typeof ICAL.Component>;
type EventInput = Component | "cancelled" | "recurring" | "invalid";

interface EventProperties {
  readonly depth: number;
  readonly lines: string[];
}

/** Keep component boundaries at source scope and property decoding at event scope. */
export function separateIcsEvents(unfolded: string): { calendar: string; events: EventInput[] } {
  const stack: string[] = [];
  const calendar: string[] = [];
  const events: EventInput[] = [];
  let event: EventProperties | null = null;
  for (const line of unfolded.split(/\r\n|\n|\r/u)) {
    if (line.length === 0) continue;
    const marker = /^(BEGIN|END):([A-Z0-9-]+)$/iu.exec(line);
    if (marker === null) {
      if (event === null) calendar.push(line);
      else if (stack.length === event.depth) event.lines.push(line);
      continue;
    }
    const name = marker[2]!.toLowerCase();
    if (marker[1]!.toUpperCase() === "BEGIN") {
      if (event === null) {
        calendar.push(line);
        const atCalendarRoot = stack.length === 0 || (stack.length === 1 && stack[0] === "vcalendar");
        if (name === "vevent" && atCalendarRoot) {
          event = { depth: stack.length + 1, lines: [] };
        }
      }
      stack.push(name);
    } else {
      if (stack.at(-1) !== name) throw new Error("Mismatched ICS component boundaries");
      if (event !== null && event.depth === stack.length) {
        events.push(parseEventProperties(event.lines));
        event = null;
      }
      if (event === null) calendar.push(line);
      stack.pop();
    }
  }
  if (stack.length !== 0) throw new Error("Unclosed ICS component");
  return { calendar: calendar.join("\r\n"), events };
}

function parseEventProperties(lines: readonly string[]): EventInput {
  try {
    const status = lines.find((line) => /^STATUS[;:]/iu.test(line));
    if (status !== undefined &&
      String(ICAL.Property.fromString(status).getFirstValue()).toUpperCase() === "CANCELLED") {
      return "cancelled";
    }
    // The presence of either field establishes recurrence. Decoding its value
    // would reject some rules that we never expand in the first place.
    if (lines.some((line) => /^(RRULE|RDATE)[;:]/iu.test(line))) return "recurring";
    const component = new ICAL.Component("vevent");
    for (const line of lines) {
      const property = ICAL.Property.fromString(line);
      if (property.name === "dtstart" || property.name === "dtend" || property.name === "duration") {
        if (component.hasProperty(property.name) || !validTimeField(line, property)) return "invalid";
      }
      component.addProperty(property);
    }
    return component;
  } catch {
    return "invalid";
  }
}

// RFC 5545 duration components have a fixed order. Weeks stand alone.
const DURATION = /^[+-]?P(?:\d+W|\d+D|(?:\d+D)?T(?:\d+H(?:\d+M(?:\d+S)?)?|\d+M(?:\d+S)?|\d+S))$/u;

export function getIcsPropertyValue(line: string): string | undefined {
  // A quoted parameter may contain colons before the property value.
  return /^(?:[^":]|"[^"]*")*:(.*)$/u.exec(line)?.[1];
}

function validTimeField(line: string, property: InstanceType<typeof ICAL.Property>): boolean {
  // jCal may already have dropped an offset or trailing data.
  const raw = getIcsPropertyValue(line);
  if (raw === undefined) return false;
  if (property.name === "duration") return property.type === "duration" && DURATION.test(raw);
  const tzid = property.getFirstParameter("tzid");
  if (property.type === "date") return tzid === undefined && /^\d{8}$/u.test(raw);
  return property.type === "date-time" && /^\d{8}T\d{6}Z?$/u.test(raw) &&
    !(raw.endsWith("Z") && tzid !== undefined);
}
