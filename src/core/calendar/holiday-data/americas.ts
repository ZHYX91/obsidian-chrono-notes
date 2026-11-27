import type { HolidaySchedule } from "./schedule";

export const AMERICAS = {
  // OPM’s observed dates for a standard Monday–Friday federal schedule. Follow the civil date,
  // including New Year’s Day 2028 observed on the last day of 2027.
  "us": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/",
      },
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-01-19", "2027-01-18", "2028-01-17"], en: "Birthday of Martin Luther King, Jr.", names: { "zh-CN": "马丁·路德·金纪念日", "zh-TW": "馬丁・路德・金恩紀念日" } },
      { dates: ["2026-02-16", "2027-02-15", "2028-02-21"], en: "Washington’s Birthday", names: { "zh-CN": "华盛顿诞辰纪念日", "zh-TW": "華盛頓誕辰紀念日" } },
      { dates: ["2026-05-25", "2027-05-31", "2028-05-29"], en: "Memorial Day", names: { "zh-CN": "阵亡将士纪念日", "zh-TW": "陣亡將士紀念日" } },
      { dates: ["2026-06-19", "2028-06-19"], en: "Juneteenth National Independence Day", names: { "zh-CN": "六月节（奴隶解放纪念日）", "zh-TW": "六月節（奴隸解放紀念日）" } },
      { dates: ["2026-07-03", "2027-07-05"], en: "Independence Day (observed)", names: { "zh-CN": "独立日（补假）", "zh-TW": "獨立日（補假）" } },
      { dates: ["2026-09-07", "2027-09-06", "2028-09-04"], en: "Labor Day", names: { "zh-CN": "劳动节", "zh-TW": "勞工節" } },
      { dates: ["2026-10-12", "2027-10-11", "2028-10-09"], en: "Columbus Day", names: { "zh-CN": "哥伦布日", "zh-TW": "哥倫布日" } },
      { dates: ["2026-11-11", "2027-11-11"], en: "Veterans Day", names: { "zh-CN": "退伍军人节", "zh-TW": "退伍軍人節" } },
      { dates: ["2026-11-26", "2027-11-25", "2028-11-23"], en: "Thanksgiving Day", names: { "zh-CN": "感恩节", "zh-TW": "感恩節" } },
      { dates: ["2026-12-25", "2028-12-25"], en: "Christmas Day", names: { "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2027-06-18"], en: "Juneteenth National Independence Day (observed)", names: { "zh-CN": "六月节（奴隶解放纪念日）（补假）", "zh-TW": "六月節（奴隸解放紀念日）（補假）" } },
      { dates: ["2027-12-24"], en: "Christmas Day (observed)", names: { "zh-CN": "圣诞节（补假）", "zh-TW": "聖誕節（補假）" } },
      { dates: ["2027-12-31"], en: "New Year’s Day (observed)", names: { "zh-CN": "元旦（补假）", "zh-TW": "元旦（補假）" } },
      { dates: ["2028-07-04"], en: "Independence Day", names: { "zh-CN": "独立日", "zh-TW": "獨立日" } },
      { dates: ["2028-11-10"], en: "Veterans Day (observed)", names: { "zh-CN": "退伍军人节（补假）", "zh-TW": "退伍軍人節（補假）" } },
    ],
  },
  // Fixed holidays declared nationwide by federal law. Lei 662/1949, Lei 6802/1980 and Lei 14759/2023.
  // Good Friday is designated under municipal law (Lei 9093/1995, art. 2).
  // https://www.planalto.gov.br/ccivil_03/leis/l6802.htm
  // https://www2.camara.leg.br/legin/fed/lei/2023/lei-14759-21-dezembro-2023-795091-publicacaooriginal-170522-pl.html
  // https://www2.camara.leg.br/legin/fed/lei/1995/lei-9093-12-setembro-1995-348594-normaatualizada-pl.html
  "br": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www2.camara.leg.br/legin/fed/lei/1940-1949/lei-662-6-abril-1949-347136-normaatualizada-pl.html",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www2.camara.leg.br/legin/fed/lei/1940-1949/lei-662-6-abril-1949-347136-normaatualizada-pl.html",
      },
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www2.camara.leg.br/legin/fed/lei/1940-1949/lei-662-6-abril-1949-347136-normaatualizada-pl.html",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01", "2028-01-01"], en: "New Year’s Day", names: { "pt": "Confraternização Universal", "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-04-21", "2027-04-21", "2028-04-21"], en: "Tiradentes Day", names: { "pt": "Tiradentes", "zh-CN": "拔牙者纪念日", "zh-TW": "拔牙者紀念日" } },
      { dates: ["2026-05-01", "2027-05-01", "2028-05-01"], en: "Labour Day", names: { "pt": "Dia Mundial do Trabalho", "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2026-09-07", "2027-09-07", "2028-09-07"], en: "Independence Day", names: { "pt": "Independência do Brasil", "zh-CN": "独立日", "zh-TW": "獨立日" } },
      {
        dates: ["2026-10-12", "2027-10-12", "2028-10-12"],
        en: "Our Lady of Aparecida",
        names: { "pt": "Nossa Senhora Aparecida", "zh-CN": "阿帕雷西达圣母庆日", "zh-TW": "阿帕雷西達聖母慶日" },
      },
      { dates: ["2026-11-02", "2027-11-02", "2028-11-02"], en: "All Souls’ Day", names: { "pt": "Finados", "zh-CN": "万灵节", "zh-TW": "萬靈節" } },
      {
        dates: ["2026-11-15", "2027-11-15", "2028-11-15"],
        en: "Republic Proclamation Day",
        names: { "pt": "Proclamação da República", "zh-CN": "共和国成立日", "zh-TW": "共和國成立日" },
      },
      {
        dates: ["2026-11-20", "2027-11-20", "2028-11-20"],
        en: "National Zumbi and Black Awareness Day",
        names: { "pt": "Dia Nacional de Zumbi e da Consciência Negra", "zh-CN": "尊比纪念日暨黑人意识日", "zh-TW": "尊比紀念日暨黑人意識日" },
      },
      { dates: ["2026-12-25", "2027-12-25", "2028-12-25"], en: "Christmas Day", names: { "pt": "Natal", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
    ],
  },
  // Federal Labour Law art. 74. Only federal ordinary election days are nationwide.
  // https://www.imss.gob.mx/sites/all/statics/pdf/leyes/4107_LFT.pdf
  "mx": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gob.mx/profedet/articulos/sabes-cuales-son-los-dias-de-descanso-obligatorio-para-este-2026?idiom=es",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://ine.mx/elecciones-2027/",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "es": "Año Nuevo", "zh-CN": "元旦", "zh-TW": "元旦" } },
      {
        dates: ["2026-02-02", "2027-02-01"],
        en: "Constitution Day (observed)",
        names: { "es": "Día de la Constitución (descanso obligatorio)", "zh-CN": "宪法日（法定休假日）", "zh-TW": "憲法日（法定休假日）" },
      },
      {
        dates: ["2026-03-16", "2027-03-15"],
        en: "Benito Juárez’s Birthday (observed)",
        names: { "es": "Natalicio de Benito Juárez (descanso obligatorio)", "zh-CN": "贝尼托·胡亚雷斯诞辰（法定休假日）", "zh-TW": "貝尼托・胡亞雷斯誕辰（法定休假日）" },
      },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "es": "Día del Trabajo", "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2026-09-16", "2027-09-16"], en: "Independence Day", names: { "es": "Día de la Independencia", "zh-CN": "独立日", "zh-TW": "獨立日" } },
      {
        dates: ["2026-11-16", "2027-11-15"],
        en: "Revolution Day (observed)",
        names: { "es": "Día de la Revolución (descanso obligatorio)", "zh-CN": "革命纪念日（法定休假日）", "zh-TW": "革命紀念日（法定休假日）" },
      },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "es": "Navidad", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2027-06-06"], en: "Federal election day", names: { "es": "Jornada electoral federal", "zh-CN": "联邦选举日", "zh-TW": "聯邦選舉日" } },
    ],
  },
  // Québec provincial labour standards. Employers choose one of the two Easter dates.
  "ca-qc": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.cnesst.gouv.qc.ca/fr/conditions-travail/conges/jours-feries/liste-jours-feries",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.cnesst.gouv.qc.ca/fr/conditions-travail/conges/jours-feries/liste-jours-feries",
      },
      2028: {
        status: "published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www.cnesst.gouv.qc.ca/fr/conditions-travail/conges/jours-feries/liste-jours-feries",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01", "2028-01-01"], en: "New Year’s Day", names: { "fr": "Jour de l’An", "zh-CN": "元旦", "zh-TW": "元旦" } },
      {
        dates: ["2026-04-03", "2027-03-26", "2028-04-14"],
        en: "Good Friday (employer chooses Good Friday or Easter Monday)",
        names: { "fr": "Vendredi saint (vendredi saint ou lundi de Pâques, au choix de l’employeur)", "zh-CN": "耶稣受难日（雇主可在此日和复活节星期一中择一放假）", "zh-TW": "耶穌受難日（雇主可在此日和復活節星期一中擇一放假）" },
        kind: "conditional",
      },
      {
        dates: ["2026-04-06", "2027-03-29", "2028-04-17"],
        en: "Easter Monday (employer chooses Good Friday or Easter Monday)",
        names: { "fr": "Lundi de Pâques (vendredi saint ou lundi de Pâques, au choix de l’employeur)", "zh-CN": "复活节星期一（雇主可在此日和耶稣受难日中择一放假）", "zh-TW": "復活節星期一（雇主可在此日和耶穌受難日中擇一放假）" },
        kind: "conditional",
      },
      {
        dates: ["2026-05-18", "2027-05-24", "2028-05-22"],
        en: "National Patriots’ Day",
        names: { "fr": "Journée nationale des patriotes", "zh-CN": "爱国者纪念日", "zh-TW": "愛國者紀念日" },
      },
      {
        dates: ["2026-06-24", "2027-06-24", "2028-06-24"],
        en: "Québec National Holiday",
        names: { "fr": "Fête nationale du Québec", "zh-CN": "魁北克省庆日", "zh-TW": "魁北克省慶日" },
      },
      { dates: ["2026-07-01", "2027-07-01", "2028-07-01"], en: "Canada Day", names: { "fr": "Fête du Canada", "zh-CN": "加拿大国庆日", "zh-TW": "加拿大國慶日" } },
      { dates: ["2026-09-07", "2027-09-06", "2028-09-04"], en: "Labour Day", names: { "fr": "Fête du Travail", "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2026-10-12", "2027-10-11", "2028-10-09"], en: "Thanksgiving Day", names: { "fr": "Action de grâces", "zh-CN": "感恩节", "zh-TW": "感恩節" } },
      { dates: ["2026-12-25", "2027-12-25", "2028-12-25"], en: "Christmas Day", names: { "fr": "Noël", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
    ],
  },
} as const satisfies Readonly<Record<string, HolidaySchedule>>;
