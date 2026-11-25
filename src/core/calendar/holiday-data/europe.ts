import type { HolidaySchedule } from "./schedule";

export const EUROPE = {
  "gb-eng-wls": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day" },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday" },
      { dates: ["2026-04-06", "2027-03-29"], en: "Easter Monday" },
      { dates: ["2026-05-04", "2027-05-03"], en: "Early May bank holiday" },
      { dates: ["2026-05-25", "2027-05-31"], en: "Spring bank holiday" },
      { dates: ["2026-08-31", "2027-08-30"], en: "Summer bank holiday" },
      { dates: ["2026-12-25"], en: "Christmas Day" },
      { dates: ["2026-12-28", "2027-12-28"], en: "Boxing Day (substitute day)" },
      { dates: ["2027-12-27"], en: "Christmas Day (substitute day)" },
    ],
  },
  "gb-sct": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day" },
      { dates: ["2026-01-02"], en: "2nd January" },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday" },
      { dates: ["2026-05-04", "2027-05-03"], en: "Early May bank holiday" },
      { dates: ["2026-05-25", "2027-05-31"], en: "Spring bank holiday" },
      { dates: ["2026-06-15"], en: "World Cup bank holiday" },
      { dates: ["2026-08-03", "2027-08-02"], en: "Summer bank holiday" },
      { dates: ["2026-11-30", "2027-11-30"], en: "St Andrew’s Day" },
      { dates: ["2026-12-25"], en: "Christmas Day" },
      { dates: ["2026-12-28", "2027-12-28"], en: "Boxing Day (substitute day)" },
      { dates: ["2027-01-04"], en: "2nd January (substitute day)" },
      { dates: ["2027-12-27"], en: "Christmas Day (substitute day)" },
    ],
  },
  "gb-nir": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day" },
      { dates: ["2026-03-17", "2027-03-17"], en: "St Patrick’s Day" },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday" },
      { dates: ["2026-04-06", "2027-03-29"], en: "Easter Monday" },
      { dates: ["2026-05-04", "2027-05-03"], en: "Early May bank holiday" },
      { dates: ["2026-05-25", "2027-05-31"], en: "Spring bank holiday" },
      { dates: ["2026-07-13"], en: "Battle of the Boyne (Orangemen’s Day) (substitute day)" },
      { dates: ["2026-08-31", "2027-08-30"], en: "Summer bank holiday" },
      { dates: ["2026-12-25"], en: "Christmas Day" },
      { dates: ["2026-12-28", "2027-12-28"], en: "Boxing Day (substitute day)" },
      { dates: ["2027-07-12"], en: "Battle of the Boyne (Orangemen’s Day)" },
      { dates: ["2027-12-27"], en: "Christmas Day (substitute day)" },
    ],
  },
  "de": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.bundesbank.de/resource/blob/749314/edbf269e7e236ff9dcf3e95dab122a0b/472B63F073F071307366337C94F8C870/feiertage-in-deutschland-1-data.pdf",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.bundesbank.de/de/aufgaben/unbarer-zahlungsverkehr/target/feiertagskalender-2027-749314",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "de": "Neujahr" } },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday", names: { "de": "Karfreitag" } },
      { dates: ["2026-04-06", "2027-03-29"], en: "Easter Monday", names: { "de": "Ostermontag" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "de": "Tag der Arbeit" } },
      { dates: ["2026-05-14", "2027-05-06"], en: "Ascension Day", names: { "de": "Christi Himmelfahrt" } },
      { dates: ["2026-05-25", "2027-05-17"], en: "Whit Monday", names: { "de": "Pfingstmontag" } },
      { dates: ["2026-10-03", "2027-10-03"], en: "German Unity Day", names: { "de": "Tag der Deutschen Einheit" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "de": "Erster Weihnachtsfeiertag" } },
      {
        dates: ["2026-12-26", "2027-12-26"],
        en: "Second Day of Christmas",
        names: { "de": "Zweiter Weihnachtsfeiertag" },
      },
    ],
  },
  "fr": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://calendrier.api.gouv.fr/jours-feries/metropole/2026.json",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://calendrier.api.gouv.fr/jours-feries/metropole/2027.json",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "fr": "1er janvier" } },
      { dates: ["2026-04-06", "2027-03-29"], en: "Easter Monday", names: { "fr": "Lundi de Pâques" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "fr": "1er mai" } },
      { dates: ["2026-05-08", "2027-05-08"], en: "Victory Day", names: { "fr": "8 mai" } },
      { dates: ["2026-05-14", "2027-05-06"], en: "Ascension Day", names: { "fr": "Ascension" } },
      { dates: ["2026-05-25", "2027-05-17"], en: "Whit Monday", names: { "fr": "Lundi de Pentecôte" } },
      { dates: ["2026-07-14", "2027-07-14"], en: "National Day", names: { "fr": "14 juillet" } },
      { dates: ["2026-08-15", "2027-08-15"], en: "Assumption of Mary", names: { "fr": "Assomption" } },
      { dates: ["2026-11-01", "2027-11-01"], en: "All Saints’ Day", names: { "fr": "Toussaint" } },
      { dates: ["2026-11-11", "2027-11-11"], en: "Armistice Day", names: { "fr": "11 novembre" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "fr": "Jour de Noël" } },
    ],
  },
  // Only dates marked in all 19 columns of the BOE employment holiday table.
  "es": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-21667",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-21254",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "es": "Año Nuevo" } },
      { dates: ["2026-01-06", "2027-01-06"], en: "Epiphany", names: { "es": "Epifanía del Señor" } },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday", names: { "es": "Viernes Santo" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "es": "Fiesta del Trabajo" } },
      { dates: ["2026-08-15"], en: "Assumption of Mary", names: { "es": "Asunción de la Virgen" } },
      {
        dates: ["2026-10-12", "2027-10-12"],
        en: "National Day of Spain",
        names: { "es": "Fiesta Nacional de España" },
      },
      { dates: ["2026-12-08", "2027-12-08"], en: "Immaculate Conception", names: { "es": "Inmaculada Concepción" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "es": "Natividad del Señor" } },
      { dates: ["2027-11-01"], en: "All Saints’ Day", names: { "es": "Todos los Santos" } },
      { dates: ["2027-12-06"], en: "Constitution Day", names: { "es": "Día de la Constitución Española" } },
    ],
  },
  // Labour Code art. 112 together with the annual transfer orders for a five-day working week.
  // https://mintrud.gov.ru/labour/relationship/351
  "ru": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://publication.pravo.gov.ru/document/0001202509240023",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://publication.pravo.gov.ru/document/0001202609180037",
      },
    },
    entries: [
      {
        dates: [
          "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-08",
          "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04", "2027-01-05", "2027-01-06", "2027-01-08",
        ],
        en: "New Year holidays",
        names: { "ru": "Новогодние каникулы" },
      },
      { dates: ["2026-01-07", "2027-01-07"], en: "Christmas Day", names: { "ru": "Рождество Христово" } },
      {
        dates: ["2026-02-23", "2027-02-23"],
        en: "Defender of the Fatherland Day",
        names: { "ru": "День защитника Отечества" },
      },
      {
        dates: ["2026-03-08", "2027-03-08"],
        en: "International Women’s Day",
        names: { "ru": "Международный женский день" },
      },
      { dates: ["2026-05-01", "2027-05-01"], en: "Spring and Labour Day", names: { "ru": "Праздник Весны и Труда" } },
      { dates: ["2026-05-09", "2027-05-09"], en: "Victory Day", names: { "ru": "День Победы" } },
      { dates: ["2026-06-12", "2027-06-12"], en: "Russia Day", names: { "ru": "День России" } },
      { dates: ["2026-11-04", "2027-11-04"], en: "National Unity Day", names: { "ru": "День народного единства" } },
      {
        dates: [
          "2026-01-09", "2026-03-09", "2026-05-11", "2026-12-31",
          "2027-02-22", "2027-05-03", "2027-05-10", "2027-06-14", "2027-11-05", "2027-12-31",
        ],
        en: "Transferred day off",
        names: { "ru": "Перенесённый выходной" },
        kind: "rest",
      },
      { dates: ["2027-02-20"], en: "Substitute working Saturday", names: { "ru": "Рабочая суббота" }, kind: "work" },
    ],
  },
  // Nationwide holidays under the Austrian Working Rest Act.
  "at": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.wien.gv.at/inhalt/feiertage",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.wien.gv.at/inhalt/feiertage",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "de": "Neujahr" } },
      { dates: ["2026-01-06", "2027-01-06"], en: "Epiphany", names: { "de": "Heilige Drei Könige" } },
      { dates: ["2026-04-06", "2027-03-29"], en: "Easter Monday", names: { "de": "Ostermontag" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "State Holiday", names: { "de": "Staatsfeiertag" } },
      { dates: ["2026-05-14", "2027-05-06"], en: "Ascension Day", names: { "de": "Christi Himmelfahrt" } },
      { dates: ["2026-05-25", "2027-05-17"], en: "Whit Monday", names: { "de": "Pfingstmontag" } },
      { dates: ["2026-06-04", "2027-05-27"], en: "Corpus Christi", names: { "de": "Fronleichnam" } },
      { dates: ["2026-08-15", "2027-08-15"], en: "Assumption of Mary", names: { "de": "Mariä Himmelfahrt" } },
      { dates: ["2026-10-26", "2027-10-26"], en: "National Day", names: { "de": "Nationalfeiertag" } },
      { dates: ["2026-11-01", "2027-11-01"], en: "All Saints’ Day", names: { "de": "Allerheiligen" } },
      { dates: ["2026-12-08", "2027-12-08"], en: "Immaculate Conception", names: { "de": "Mariä Empfängnis" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "de": "Christtag" } },
      { dates: ["2026-12-26", "2027-12-26"], en: "St Stephen’s Day", names: { "de": "Stefanitag" } },
    ],
  },
  // Article 234 of the Portuguese Labour Code. Carnival and municipal holidays are optional under art. 235.
  "pt": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475-46746675",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475-46746675",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "pt": "Ano Novo" } },
      {
        dates: ["2026-04-03", "2027-03-26"],
        en: "Good Friday (may be observed on another local Easter date)",
        names: { "pt": "Sexta-Feira Santa (pode ser observada noutra data local da Páscoa)" },
      },
      { dates: ["2026-04-05", "2027-03-28"], en: "Easter Sunday", names: { "pt": "Domingo de Páscoa" } },
      { dates: ["2026-04-25", "2027-04-25"], en: "Freedom Day", names: { "pt": "Dia da Liberdade" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "pt": "Dia do Trabalhador" } },
      { dates: ["2026-06-04", "2027-05-27"], en: "Corpus Christi", names: { "pt": "Corpo de Deus" } },
      {
        dates: ["2026-06-10", "2027-06-10"],
        en: "Portugal Day",
        names: { "pt": "Dia de Portugal, de Camões e das Comunidades Portuguesas" },
      },
      { dates: ["2026-08-15", "2027-08-15"], en: "Assumption of Mary", names: { "pt": "Assunção de Nossa Senhora" } },
      { dates: ["2026-10-05", "2027-10-05"], en: "Republic Day", names: { "pt": "Implantação da República" } },
      { dates: ["2026-11-01", "2027-11-01"], en: "All Saints’ Day", names: { "pt": "Dia de Todos os Santos" } },
      {
        dates: ["2026-12-01", "2027-12-01"],
        en: "Restoration of Independence",
        names: { "pt": "Restauração da Independência" },
      },
      { dates: ["2026-12-08", "2027-12-08"], en: "Immaculate Conception", names: { "pt": "Imaculada Conceição" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "pt": "Natal" } },
    ],
  },
} as const satisfies Readonly<Record<string, HolidaySchedule>>;
