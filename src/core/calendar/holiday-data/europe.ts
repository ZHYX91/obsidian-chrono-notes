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
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-04-03", "2027-03-26", "2028-04-14"], en: "Good Friday", names: { "zh-CN": "耶稣受难日", "zh-TW": "耶穌受難日" } },
      { dates: ["2026-04-06", "2027-03-29", "2028-04-17"], en: "Easter Monday", names: { "zh-CN": "复活节星期一", "zh-TW": "復活節星期一" } },
      { dates: ["2026-05-04", "2027-05-03", "2028-05-01"], en: "Early May bank holiday", names: { "zh-CN": "五月初银行假日", "zh-TW": "五月初銀行假日" } },
      { dates: ["2026-05-25", "2027-05-31", "2028-05-29"], en: "Spring bank holiday", names: { "zh-CN": "春季银行假日", "zh-TW": "春季銀行假日" } },
      { dates: ["2026-08-31", "2027-08-30", "2028-08-28"], en: "Summer bank holiday", names: { "zh-CN": "夏季银行假日", "zh-TW": "夏季銀行假日" } },
      { dates: ["2026-12-25", "2028-12-25"], en: "Christmas Day", names: { "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2026-12-28", "2027-12-28"], en: "Boxing Day (substitute day)", names: { "zh-CN": "节礼日（补假）", "zh-TW": "節禮日（補假）" } },
      { dates: ["2027-12-27"], en: "Christmas Day (substitute day)", names: { "zh-CN": "圣诞节（补假）", "zh-TW": "聖誕節（補假）" } },
      { dates: ["2028-01-03"], en: "New Year’s Day (substitute day)", names: { "zh-CN": "元旦（补假）", "zh-TW": "元旦（補假）" } },
      { dates: ["2028-12-26"], en: "Boxing Day", names: { "zh-CN": "节礼日", "zh-TW": "節禮日" } },
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
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-01-02"], en: "2nd January", names: { "zh-CN": "一月二日假期", "zh-TW": "一月二日假期" } },
      { dates: ["2026-04-03", "2027-03-26", "2028-04-14"], en: "Good Friday", names: { "zh-CN": "耶稣受难日", "zh-TW": "耶穌受難日" } },
      { dates: ["2026-05-04", "2027-05-03", "2028-05-01"], en: "Early May bank holiday", names: { "zh-CN": "五月初银行假日", "zh-TW": "五月初銀行假日" } },
      { dates: ["2026-05-25", "2027-05-31", "2028-05-29"], en: "Spring bank holiday", names: { "zh-CN": "春季银行假日", "zh-TW": "春季銀行假日" } },
      { dates: ["2026-06-15"], en: "World Cup bank holiday", names: { "zh-CN": "世界杯银行假日", "zh-TW": "世界盃銀行假日" } },
      { dates: ["2026-08-03", "2027-08-02", "2028-08-07"], en: "Summer bank holiday", names: { "zh-CN": "夏季银行假日", "zh-TW": "夏季銀行假日" } },
      { dates: ["2026-11-30", "2027-11-30", "2028-11-30"], en: "St Andrew’s Day", names: { "zh-CN": "圣安德鲁日", "zh-TW": "聖安德魯日" } },
      { dates: ["2026-12-25", "2028-12-25"], en: "Christmas Day", names: { "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2026-12-28", "2027-12-28"], en: "Boxing Day (substitute day)", names: { "zh-CN": "节礼日（补假）", "zh-TW": "節禮日（補假）" } },
      { dates: ["2027-01-04", "2028-01-04"], en: "2nd January (substitute day)", names: { "zh-CN": "一月二日假期（补假）", "zh-TW": "一月二日假期（補假）" } },
      { dates: ["2027-12-27"], en: "Christmas Day (substitute day)", names: { "zh-CN": "圣诞节（补假）", "zh-TW": "聖誕節（補假）" } },
      { dates: ["2028-01-03"], en: "New Year’s Day (substitute day)", names: { "zh-CN": "元旦（补假）", "zh-TW": "元旦（補假）" } },
      { dates: ["2028-12-26"], en: "Boxing Day", names: { "zh-CN": "节礼日", "zh-TW": "節禮日" } },
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
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www.gov.uk/bank-holidays.json",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-03-17", "2027-03-17", "2028-03-17"], en: "St Patrick’s Day", names: { "zh-CN": "圣帕特里克节", "zh-TW": "聖派翠克節" } },
      { dates: ["2026-04-03", "2027-03-26", "2028-04-14"], en: "Good Friday", names: { "zh-CN": "耶稣受难日", "zh-TW": "耶穌受難日" } },
      { dates: ["2026-04-06", "2027-03-29", "2028-04-17"], en: "Easter Monday", names: { "zh-CN": "复活节星期一", "zh-TW": "復活節星期一" } },
      { dates: ["2026-05-04", "2027-05-03", "2028-05-01"], en: "Early May bank holiday", names: { "zh-CN": "五月初银行假日", "zh-TW": "五月初銀行假日" } },
      { dates: ["2026-05-25", "2027-05-31", "2028-05-29"], en: "Spring bank holiday", names: { "zh-CN": "春季银行假日", "zh-TW": "春季銀行假日" } },
      { dates: ["2026-07-13"], en: "Battle of the Boyne (Orangemen’s Day) (substitute day)", names: { "zh-CN": "博因河战役纪念日（奥兰治日）（补假）", "zh-TW": "博因河戰役紀念日（奧蘭治日）（補假）" } },
      { dates: ["2026-08-31", "2027-08-30", "2028-08-28"], en: "Summer bank holiday", names: { "zh-CN": "夏季银行假日", "zh-TW": "夏季銀行假日" } },
      { dates: ["2026-12-25", "2028-12-25"], en: "Christmas Day", names: { "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2026-12-28", "2027-12-28"], en: "Boxing Day (substitute day)", names: { "zh-CN": "节礼日（补假）", "zh-TW": "節禮日（補假）" } },
      { dates: ["2027-07-12", "2028-07-12"], en: "Battle of the Boyne (Orangemen’s Day)", names: { "zh-CN": "博因河战役纪念日（奥兰治日）", "zh-TW": "博因河戰役紀念日（奧蘭治日）" } },
      { dates: ["2027-12-27"], en: "Christmas Day (substitute day)", names: { "zh-CN": "圣诞节（补假）", "zh-TW": "聖誕節（補假）" } },
      { dates: ["2028-01-03"], en: "New Year’s Day (substitute day)", names: { "zh-CN": "元旦（补假）", "zh-TW": "元旦（補假）" } },
      { dates: ["2028-12-26"], en: "Boxing Day", names: { "zh-CN": "节礼日", "zh-TW": "節禮日" } },
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
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "de": "Neujahr", "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday", names: { "de": "Karfreitag", "zh-CN": "耶稣受难日", "zh-TW": "耶穌受難日" } },
      { dates: ["2026-04-06", "2027-03-29"], en: "Easter Monday", names: { "de": "Ostermontag", "zh-CN": "复活节星期一", "zh-TW": "復活節星期一" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "de": "Tag der Arbeit", "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2026-05-14", "2027-05-06"], en: "Ascension Day", names: { "de": "Christi Himmelfahrt", "zh-CN": "耶稣升天节", "zh-TW": "耶穌升天節" } },
      { dates: ["2026-05-25", "2027-05-17"], en: "Whit Monday", names: { "de": "Pfingstmontag", "zh-CN": "圣灵降临节星期一", "zh-TW": "聖靈降臨節星期一" } },
      { dates: ["2026-10-03", "2027-10-03"], en: "German Unity Day", names: { "de": "Tag der Deutschen Einheit", "zh-CN": "德国统一日", "zh-TW": "德國統一日" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "de": "Erster Weihnachtsfeiertag", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      {
        dates: ["2026-12-26", "2027-12-26"],
        en: "Second Day of Christmas",
        names: { "de": "Zweiter Weihnachtsfeiertag", "zh-CN": "圣诞节第二天", "zh-TW": "聖誕節第二天" },
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
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://calendrier.api.gouv.fr/jours-feries/metropole/2028.json",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01", "2028-01-01"], en: "New Year’s Day", names: { "fr": "1er janvier", "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-04-06", "2027-03-29", "2028-04-17"], en: "Easter Monday", names: { "fr": "Lundi de Pâques", "zh-CN": "复活节星期一", "zh-TW": "復活節星期一" } },
      { dates: ["2026-05-01", "2027-05-01", "2028-05-01"], en: "Labour Day", names: { "fr": "1er mai", "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2026-05-08", "2027-05-08", "2028-05-08"], en: "Victory Day", names: { "fr": "8 mai", "zh-CN": "欧洲胜利日", "zh-TW": "歐洲勝利日" } },
      { dates: ["2026-05-14", "2027-05-06", "2028-05-25"], en: "Ascension Day", names: { "fr": "Ascension", "zh-CN": "耶稣升天节", "zh-TW": "耶穌升天節" } },
      { dates: ["2026-05-25", "2027-05-17", "2028-06-05"], en: "Whit Monday", names: { "fr": "Lundi de Pentecôte", "zh-CN": "圣灵降临节星期一", "zh-TW": "聖靈降臨節星期一" } },
      { dates: ["2026-07-14", "2027-07-14", "2028-07-14"], en: "National Day", names: { "fr": "14 juillet", "zh-CN": "国庆日", "zh-TW": "國慶日" } },
      { dates: ["2026-08-15", "2027-08-15", "2028-08-15"], en: "Assumption of Mary", names: { "fr": "Assomption", "zh-CN": "圣母升天节", "zh-TW": "聖母升天節" } },
      { dates: ["2026-11-01", "2027-11-01", "2028-11-01"], en: "All Saints’ Day", names: { "fr": "Toussaint", "zh-CN": "诸圣节", "zh-TW": "諸聖節" } },
      { dates: ["2026-11-11", "2027-11-11", "2028-11-11"], en: "Armistice Day", names: { "fr": "11 novembre", "zh-CN": "一战停战纪念日", "zh-TW": "一戰停戰紀念日" } },
      { dates: ["2026-12-25", "2027-12-25", "2028-12-25"], en: "Christmas Day", names: { "fr": "Jour de Noël", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
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
      // The BOE annual table currently ends in 2027. Article 45.4 governs the regional submission cycle.
      2028: {
        status: "not-published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www.boe.es/buscar/act.php?id=BOE-A-1983-20906#art45",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "es": "Año Nuevo", "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-01-06", "2027-01-06"], en: "Epiphany", names: { "es": "Epifanía del Señor", "zh-CN": "主显节", "zh-TW": "主顯節" } },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday", names: { "es": "Viernes Santo", "zh-CN": "耶稣受难日", "zh-TW": "耶穌受難日" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "es": "Fiesta del Trabajo", "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2026-08-15"], en: "Assumption of Mary", names: { "es": "Asunción de la Virgen", "zh-CN": "圣母升天节", "zh-TW": "聖母升天節" } },
      {
        dates: ["2026-10-12", "2027-10-12"],
        en: "National Day of Spain",
        names: { "es": "Fiesta Nacional de España", "zh-CN": "西班牙国庆日", "zh-TW": "西班牙國慶日" },
      },
      { dates: ["2026-12-08", "2027-12-08"], en: "Immaculate Conception", names: { "es": "Inmaculada Concepción", "zh-CN": "圣母无原罪始胎节", "zh-TW": "聖母無原罪始胎節" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "es": "Natividad del Señor", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2027-11-01"], en: "All Saints’ Day", names: { "es": "Todos los Santos", "zh-CN": "诸圣节", "zh-TW": "諸聖節" } },
      { dates: ["2027-12-06"], en: "Constitution Day", names: { "es": "Día de la Constitución Española", "zh-CN": "宪法日", "zh-TW": "憲法日" } },
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
        names: { "ru": "Новогодние каникулы", "zh-CN": "新年假期", "zh-TW": "新年假期" },
      },
      { dates: ["2026-01-07", "2027-01-07"], en: "Christmas Day", names: { "ru": "Рождество Христово", "zh-CN": "东正教圣诞节", "zh-TW": "東正教聖誕節" } },
      {
        dates: ["2026-02-23", "2027-02-23"],
        en: "Defender of the Fatherland Day",
        names: { "ru": "День защитника Отечества", "zh-CN": "祖国保卫者日", "zh-TW": "祖國保衛者日" },
      },
      {
        dates: ["2026-03-08", "2027-03-08"],
        en: "International Women’s Day",
        names: { "ru": "Международный женский день", "zh-CN": "国际妇女节", "zh-TW": "國際婦女節" },
      },
      { dates: ["2026-05-01", "2027-05-01"], en: "Spring and Labour Day", names: { "ru": "Праздник Весны и Труда", "zh-CN": "春天和劳动节", "zh-TW": "春天和勞動節" } },
      { dates: ["2026-05-09", "2027-05-09"], en: "Victory Day", names: { "ru": "День Победы", "zh-CN": "卫国战争胜利日", "zh-TW": "衛國戰爭勝利日" } },
      { dates: ["2026-06-12", "2027-06-12"], en: "Russia Day", names: { "ru": "День России", "zh-CN": "俄罗斯日", "zh-TW": "俄羅斯日" } },
      { dates: ["2026-11-04", "2027-11-04"], en: "National Unity Day", names: { "ru": "День народного единства", "zh-CN": "民族团结日", "zh-TW": "民族團結日" } },
      {
        dates: [
          "2026-01-09", "2026-03-09", "2026-05-11", "2026-12-31",
          "2027-02-22", "2027-05-03", "2027-05-10", "2027-06-14", "2027-11-05", "2027-12-31",
        ],
        en: "Transferred day off",
        names: { "ru": "Перенесённый выходной", "zh-CN": "调休日", "zh-TW": "調休日" },
        kind: "rest",
      },
      { dates: ["2027-02-20"], en: "Substitute working Saturday", names: { "ru": "Рабочая суббота", "zh-CN": "周六补班", "zh-TW": "週六補班" }, kind: "work" },
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
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www.wien.gv.at/inhalt/feiertage",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01", "2028-01-01"], en: "New Year’s Day", names: { "de": "Neujahr", "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-01-06", "2027-01-06", "2028-01-06"], en: "Epiphany", names: { "de": "Heilige Drei Könige", "zh-CN": "主显节", "zh-TW": "主顯節" } },
      { dates: ["2026-04-06", "2027-03-29", "2028-04-17"], en: "Easter Monday", names: { "de": "Ostermontag", "zh-CN": "复活节星期一", "zh-TW": "復活節星期一" } },
      { dates: ["2026-05-01", "2027-05-01", "2028-05-01"], en: "State Holiday", names: { "de": "Staatsfeiertag", "zh-CN": "国家节日（五一劳动节）", "zh-TW": "國家節日（五一勞動節）" } },
      { dates: ["2026-05-14", "2027-05-06", "2028-05-25"], en: "Ascension Day", names: { "de": "Christi Himmelfahrt", "zh-CN": "耶稣升天节", "zh-TW": "耶穌升天節" } },
      { dates: ["2026-05-25", "2027-05-17", "2028-06-05"], en: "Whit Monday", names: { "de": "Pfingstmontag", "zh-CN": "圣灵降临节星期一", "zh-TW": "聖靈降臨節星期一" } },
      { dates: ["2026-06-04", "2027-05-27", "2028-06-15"], en: "Corpus Christi", names: { "de": "Fronleichnam", "zh-CN": "基督圣体节", "zh-TW": "基督聖體節" } },
      { dates: ["2026-08-15", "2027-08-15", "2028-08-15"], en: "Assumption of Mary", names: { "de": "Mariä Himmelfahrt", "zh-CN": "圣母升天节", "zh-TW": "聖母升天節" } },
      { dates: ["2026-10-26", "2027-10-26", "2028-10-26"], en: "National Day", names: { "de": "Nationalfeiertag", "zh-CN": "国庆日", "zh-TW": "國慶日" } },
      { dates: ["2026-11-01", "2027-11-01", "2028-11-01"], en: "All Saints’ Day", names: { "de": "Allerheiligen", "zh-CN": "诸圣节", "zh-TW": "諸聖節" } },
      { dates: ["2026-12-08", "2027-12-08", "2028-12-08"], en: "Immaculate Conception", names: { "de": "Mariä Empfängnis", "zh-CN": "圣母无原罪始胎节", "zh-TW": "聖母無原罪始胎節" } },
      { dates: ["2026-12-25", "2027-12-25", "2028-12-25"], en: "Christmas Day", names: { "de": "Christtag", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2026-12-26", "2027-12-26", "2028-12-26"], en: "St Stephen’s Day", names: { "de": "Stefanitag", "zh-CN": "圣斯德望日", "zh-TW": "聖斯德望日" } },
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
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475-46746675",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01", "2028-01-01"], en: "New Year’s Day", names: { "pt": "Ano Novo", "zh-CN": "元旦", "zh-TW": "元旦" } },
      {
        dates: ["2026-04-03", "2027-03-26", "2028-04-14"],
        en: "Good Friday (may be observed on another local Easter date)",
        names: { "pt": "Sexta-Feira Santa (pode ser observada noutra data local da Páscoa)", "zh-CN": "耶稣受难日（可依当地习俗在复活节期间另择一日放假）", "zh-TW": "耶穌受難日（可依當地習俗在復活節期間另擇一日放假）" },
      },
      { dates: ["2026-04-05", "2027-03-28", "2028-04-16"], en: "Easter Sunday", names: { "pt": "Domingo de Páscoa", "zh-CN": "复活节星期日", "zh-TW": "復活節星期日" } },
      { dates: ["2026-04-25", "2027-04-25", "2028-04-25"], en: "Freedom Day", names: { "pt": "Dia da Liberdade", "zh-CN": "自由日", "zh-TW": "自由日" } },
      { dates: ["2026-05-01", "2027-05-01", "2028-05-01"], en: "Labour Day", names: { "pt": "Dia do Trabalhador", "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2026-06-04", "2027-05-27", "2028-06-15"], en: "Corpus Christi", names: { "pt": "Corpo de Deus", "zh-CN": "基督圣体节", "zh-TW": "基督聖體節" } },
      {
        dates: ["2026-06-10", "2027-06-10", "2028-06-10"],
        en: "Portugal Day",
        names: { "pt": "Dia de Portugal, de Camões e das Comunidades Portuguesas", "zh-CN": "葡萄牙日", "zh-TW": "葡萄牙日" },
      },
      { dates: ["2026-08-15", "2027-08-15", "2028-08-15"], en: "Assumption of Mary", names: { "pt": "Assunção de Nossa Senhora", "zh-CN": "圣母升天节", "zh-TW": "聖母升天節" } },
      { dates: ["2026-10-05", "2027-10-05", "2028-10-05"], en: "Republic Day", names: { "pt": "Implantação da República", "zh-CN": "共和国成立纪念日", "zh-TW": "共和國成立紀念日" } },
      { dates: ["2026-11-01", "2027-11-01", "2028-11-01"], en: "All Saints’ Day", names: { "pt": "Dia de Todos os Santos", "zh-CN": "诸圣节", "zh-TW": "諸聖節" } },
      {
        dates: ["2026-12-01", "2027-12-01", "2028-12-01"],
        en: "Restoration of Independence",
        names: { "pt": "Restauração da Independência", "zh-CN": "恢复独立纪念日", "zh-TW": "恢復獨立紀念日" },
      },
      { dates: ["2026-12-08", "2027-12-08", "2028-12-08"], en: "Immaculate Conception", names: { "pt": "Imaculada Conceição", "zh-CN": "圣母无原罪始胎节", "zh-TW": "聖母無原罪始胎節" } },
      { dates: ["2026-12-25", "2027-12-25", "2028-12-25"], en: "Christmas Day", names: { "pt": "Natal", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
    ],
  },
} as const satisfies Readonly<Record<string, HolidaySchedule>>;
