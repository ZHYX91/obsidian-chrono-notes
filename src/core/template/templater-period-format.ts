import { getCenturyNumber, getDecadeStart } from "../periodic/periodic-date";
import { splitMomentFormat } from "../periodic/moment-format";

/** Self-contained bridge source for Templater's isolated evaluation context. */
export function buildTemplaterPeriodFormatter(): string {
  return [
    `const chronoCentury = ${getCenturyNumber.toString()};`,
    `const chronoDecade = ${getDecadeStart.toString()};`,
    `const chronoSplitFormat = ${splitMomentFormat.toString()};`,
    "const chronoDate = (format, offset = 0, reference) => {",
    "  const chunks = chronoSplitFormat(format);",
    "  if (chunks === null || !chunks.some(part => part.token !== null && /DEC|CEN/.test(part.value))) {",
    "    return tp.date.now(format, offset, reference, 'YYYY-MM-DD');",
    "  }",
    "  const moment = tp.obsidian.moment;",
    "  const date = moment(reference, 'YYYY-MM-DD');",
    "  if (!date.isValid()) throw new Error('Invalid calendar reference date');",
    "  date.add(typeof offset === 'string' ? moment.duration(offset) : moment.duration(offset, 'days'));",
    "  const year = date.year();",
    "  let marker = '\\uE000';",
    "  while (format.includes(marker)) marker += '\\uE000';",
    "  const replacements = new Map();",
    "  const expanded = chunks.map(part => {",
    "    if (part.token === null) return Array.from(part.value, c => '\\\\' + c).join('');",
    "    return part.value.replace(/DEC|CEN/g, token => {",
    "      const key = marker + token;",
    "      replacements.set(key, token === 'DEC' ? String(chronoDecade(year)).padStart(4, '0') : String(chronoCentury(year)));",
    "      return '[' + key + ']';",
    "    });",
    "  }).join('');",
    // Substitute after Moment's locale postformat so extension digits remain ASCII.
    "  let result = date.format(expanded);",
    "  for (const [key, value] of replacements) result = result.replaceAll(key, value);",
    "  return result;",
    "};",
  ].join("\n");
}
