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
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day" },
      { dates: ["2026-01-19", "2027-01-18"], en: "Birthday of Martin Luther King, Jr." },
      { dates: ["2026-02-16", "2027-02-15"], en: "Washington’s Birthday" },
      { dates: ["2026-05-25", "2027-05-31"], en: "Memorial Day" },
      { dates: ["2026-06-19"], en: "Juneteenth National Independence Day" },
      { dates: ["2026-07-03", "2027-07-05"], en: "Independence Day (observed)" },
      { dates: ["2026-09-07", "2027-09-06"], en: "Labor Day" },
      { dates: ["2026-10-12", "2027-10-11"], en: "Columbus Day" },
      { dates: ["2026-11-11", "2027-11-11"], en: "Veterans Day" },
      { dates: ["2026-11-26", "2027-11-25"], en: "Thanksgiving Day" },
      { dates: ["2026-12-25"], en: "Christmas Day" },
      { dates: ["2027-06-18"], en: "Juneteenth National Independence Day (observed)" },
      { dates: ["2027-12-24"], en: "Christmas Day (observed)" },
      { dates: ["2027-12-31"], en: "New Year’s Day (observed)" },
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
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "pt": "Confraternização Universal" } },
      { dates: ["2026-04-21", "2027-04-21"], en: "Tiradentes Day", names: { "pt": "Tiradentes" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "pt": "Dia Mundial do Trabalho" } },
      { dates: ["2026-09-07", "2027-09-07"], en: "Independence Day", names: { "pt": "Independência do Brasil" } },
      {
        dates: ["2026-10-12", "2027-10-12"],
        en: "Our Lady of Aparecida",
        names: { "pt": "Nossa Senhora Aparecida" },
      },
      { dates: ["2026-11-02", "2027-11-02"], en: "All Souls’ Day", names: { "pt": "Finados" } },
      {
        dates: ["2026-11-15", "2027-11-15"],
        en: "Republic Proclamation Day",
        names: { "pt": "Proclamação da República" },
      },
      {
        dates: ["2026-11-20", "2027-11-20"],
        en: "National Zumbi and Black Awareness Day",
        names: { "pt": "Dia Nacional de Zumbi e da Consciência Negra" },
      },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "pt": "Natal" } },
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
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "es": "Año Nuevo" } },
      {
        dates: ["2026-02-02", "2027-02-01"],
        en: "Constitution Day (observed)",
        names: { "es": "Día de la Constitución (descanso obligatorio)" },
      },
      {
        dates: ["2026-03-16", "2027-03-15"],
        en: "Benito Juárez’s Birthday (observed)",
        names: { "es": "Natalicio de Benito Juárez (descanso obligatorio)" },
      },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "es": "Día del Trabajo" } },
      { dates: ["2026-09-16", "2027-09-16"], en: "Independence Day", names: { "es": "Día de la Independencia" } },
      {
        dates: ["2026-11-16", "2027-11-15"],
        en: "Revolution Day (observed)",
        names: { "es": "Día de la Revolución (descanso obligatorio)" },
      },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "es": "Navidad" } },
      { dates: ["2027-06-06"], en: "Federal election day", names: { "es": "Jornada electoral federal" } },
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
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "fr": "Jour de l’An" } },
      {
        dates: ["2026-04-03", "2027-03-26"],
        en: "Good Friday (employer chooses Good Friday or Easter Monday)",
        names: { "fr": "Vendredi saint (vendredi saint ou lundi de Pâques, au choix de l’employeur)" },
        kind: "conditional",
      },
      {
        dates: ["2026-04-06", "2027-03-29"],
        en: "Easter Monday (employer chooses Good Friday or Easter Monday)",
        names: { "fr": "Lundi de Pâques (vendredi saint ou lundi de Pâques, au choix de l’employeur)" },
        kind: "conditional",
      },
      {
        dates: ["2026-05-18", "2027-05-24"],
        en: "National Patriots’ Day",
        names: { "fr": "Journée nationale des patriotes" },
      },
      {
        dates: ["2026-06-24", "2027-06-24"],
        en: "Québec National Holiday",
        names: { "fr": "Fête nationale du Québec" },
      },
      { dates: ["2026-07-01", "2027-07-01"], en: "Canada Day", names: { "fr": "Fête du Canada" } },
      { dates: ["2026-09-07", "2027-09-06"], en: "Labour Day", names: { "fr": "Fête du Travail" } },
      { dates: ["2026-10-12", "2027-10-11"], en: "Thanksgiving Day", names: { "fr": "Action de grâces" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "fr": "Noël" } },
    ],
  },
} as const satisfies Readonly<Record<string, HolidaySchedule>>;
