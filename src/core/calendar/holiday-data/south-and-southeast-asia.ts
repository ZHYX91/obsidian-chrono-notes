import type { HolidaySchedule } from "./schedule";

export const SOUTH_AND_SOUTHEAST_ASIA = {
  // Gazetted holidays in the central government’s Delhi/New Delhi administrative offices.
  // The 2026 supplements declared Ambedkar’s birthday and moved Eid al-Adha to May 28.
  // https://mowr.nic.in/core/Circulars/2026/Admin_09-04-2026_1156.pdf
  // https://www.pib.gov.in/PressReleasePage.aspx?PRID=2264022
  "in": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://dda.gov.in/sites/default/files/employee-corner/holidays_2026.pdf",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://utilities.cept.gov.in/dop/pdfbind.ashx?id=15435",
      },
    },
    entries: [
      { dates: ["2026-01-26", "2027-01-26"], en: "Republic Day", names: { "hi": "गणतंत्र दिवस" } },
      { dates: ["2026-03-04", "2027-03-23"], en: "Holi", names: { "hi": "होली" } },
      { dates: ["2026-03-21", "2027-03-10"], en: "Eid al-Fitr", names: { "hi": "ईद-उल-फ़ित्र" } },
      { dates: ["2026-03-26", "2027-04-15"], en: "Ram Navami", names: { "hi": "राम नवमी" } },
      { dates: ["2026-03-31", "2027-04-19"], en: "Mahavir Jayanti", names: { "hi": "महावीर जयंती" } },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday", names: { "hi": "गुड फ्राइडे" } },
      { dates: ["2026-05-01", "2027-05-20"], en: "Buddha Purnima", names: { "hi": "बुद्ध पूर्णिमा" } },
      { dates: ["2026-05-28", "2027-05-17"], en: "Eid al-Adha (Bakrid)", names: { "hi": "ईद-उल-जुहा (बकरीद)" } },
      { dates: ["2026-06-26", "2027-06-16"], en: "Muharram", names: { "hi": "मुहर्रम" } },
      { dates: ["2026-08-15", "2027-08-15"], en: "Independence Day", names: { "hi": "स्वतंत्रता दिवस" } },
      { dates: ["2026-08-26", "2027-08-15"], en: "Eid-e-Milad", names: { "hi": "ईद-ए-मिलाद" } },
      { dates: ["2026-09-04", "2027-08-25"], en: "Janmashtami", names: { "hi": "जन्माष्टमी" } },
      {
        dates: ["2026-10-02", "2027-10-02"],
        en: "Mahatma Gandhi’s Birthday",
        names: { "hi": "महात्मा गांधी की जयंती" },
      },
      { dates: ["2026-10-20", "2027-10-09"], en: "Dussehra", names: { "hi": "दशहरा" } },
      { dates: ["2026-11-08", "2027-10-29"], en: "Diwali", names: { "hi": "दीपावली" } },
      { dates: ["2026-11-24", "2027-11-14"], en: "Guru Nanak’s Birthday", names: { "hi": "गुरु नानक जयंती" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "hi": "क्रिसमस" } },
      { dates: ["2026-04-14"], en: "Dr. B. R. Ambedkar’s Birthday", names: { "hi": "डॉ. भीमराव आंबेडकर जयंती" } },
    ],
  },
  // Vietnamese public employees on a five-day week; omit ordinary weekends from contiguous breaks.
  // The 2026 New Year exchange and Vietnamese Culture Day supplemented the annual announcement.
  // https://en.baochinhphu.vn/govt-approves-4-day-break-for-2026-new-year-holiday-111251225145321864.htm
  // https://en.baochinhphu.vn/viet-nam-to-have-two-public-holidays-in-april-111260306171800163.htm
  // https://moha.gov.vn/bo-truong/tin-tuc/thong-bao-lich-nghi-tet-am-lich-va-le-quoc-khanh-nam-2027---id19741
  "vn": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://en.baochinhphu.vn/ministry-of-home-affairs-announces-2026-holiday-schedule-111251017163421877.htm",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://en.baochinhphu.vn/viet-nam-announces-2027-public-holiday-schedule-111261012155048477.htm",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "vi": "Tết Dương lịch" } },
      {
        dates: [
          "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20",
          "2027-02-04", "2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08",
        ],
        en: "Lunar New Year (Tết)",
        names: { "vi": "Tết Nguyên đán" },
      },
      {
        dates: ["2026-04-26", "2027-04-16"],
        en: "Hùng Kings Commemoration Day",
        names: { "vi": "Giỗ Tổ Hùng Vương" },
      },
      { dates: ["2026-04-30", "2027-04-30"], en: "Reunification Day", names: { "vi": "Ngày Chiến thắng" } },
      {
        dates: ["2026-05-01", "2027-05-01"],
        en: "International Workers’ Day",
        names: { "vi": "Ngày Quốc tế Lao động" },
      },
      {
        dates: ["2026-09-01", "2026-09-02", "2027-09-02", "2027-09-03"],
        en: "National Day holiday",
        names: { "vi": "Nghỉ lễ Quốc khánh" },
      },
      { dates: ["2026-11-24", "2027-11-24"], en: "Vietnamese Culture Day", names: { "vi": "Ngày Văn hóa Việt Nam" } },
      {
        dates: ["2026-04-27", "2027-02-09", "2027-02-10", "2027-05-03"],
        en: "Compensatory day off",
        names: { "vi": "Ngày nghỉ bù" },
        kind: "rest",
      },
      {
        dates: ["2026-01-02", "2026-08-31"],
        en: "Swapped day off",
        names: { "vi": "Ngày nghỉ hoán đổi" },
        kind: "rest",
      },
      {
        dates: ["2026-01-10", "2026-08-22"],
        en: "Substitute working Saturday",
        names: { "vi": "Ngày làm việc hoán đổi" },
        kind: "work",
      },
    ],
  },
} as const satisfies Readonly<Record<string, HolidaySchedule>>;
