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
      2028: {
        status: "not-published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://www.csir.res.in/en/Notification/holidays-be-observed-central-government-offices-during-year-2027-reg",
      },
    },
    entries: [
      { dates: ["2026-01-26", "2027-01-26"], en: "Republic Day", names: { "hi": "गणतंत्र दिवस", "zh-CN": "共和国日", "zh-TW": "共和國日" } },
      { dates: ["2026-03-04", "2027-03-23"], en: "Holi", names: { "hi": "होली", "zh-CN": "洒红节", "zh-TW": "灑紅節" } },
      { dates: ["2026-03-21", "2027-03-10"], en: "Eid al-Fitr", names: { "hi": "ईद-उल-फ़ित्र", "zh-CN": "开斋节", "zh-TW": "開齋節" } },
      { dates: ["2026-03-26", "2027-04-15"], en: "Ram Navami", names: { "hi": "राम नवमी", "zh-CN": "罗摩诞辰", "zh-TW": "羅摩誕辰" } },
      { dates: ["2026-03-31", "2027-04-19"], en: "Mahavir Jayanti", names: { "hi": "महावीर जयंती", "zh-CN": "耆那教大雄诞辰", "zh-TW": "耆那教大雄誕辰" } },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday", names: { "hi": "गुड फ्राइडे", "zh-CN": "耶稣受难日", "zh-TW": "耶穌受難日" } },
      { dates: ["2026-05-01", "2027-05-20"], en: "Buddha Purnima", names: { "hi": "बुद्ध पूर्णिमा", "zh-CN": "佛诞节", "zh-TW": "佛誕節" } },
      { dates: ["2026-05-28", "2027-05-17"], en: "Eid al-Adha (Bakrid)", names: { "hi": "ईद-उल-जुहा (बकरीद)", "zh-CN": "宰牲节", "zh-TW": "宰牲節" } },
      { dates: ["2026-06-26", "2027-06-16"], en: "Muharram", names: { "hi": "मुहर्रम", "zh-CN": "穆哈兰节（阿舒拉日）", "zh-TW": "穆哈蘭節（阿舒拉日）" } },
      { dates: ["2026-08-15", "2027-08-15"], en: "Independence Day", names: { "hi": "स्वतंत्रता दिवस", "zh-CN": "独立日", "zh-TW": "獨立日" } },
      { dates: ["2026-08-26", "2027-08-15"], en: "Eid-e-Milad", names: { "hi": "ईद-ए-मिलाद", "zh-CN": "先知穆罕默德诞辰", "zh-TW": "先知穆罕默德誕辰" } },
      { dates: ["2026-09-04", "2027-08-25"], en: "Janmashtami", names: { "hi": "जन्माष्टमी", "zh-CN": "黑天诞辰", "zh-TW": "黑天誕辰" } },
      {
        dates: ["2026-10-02", "2027-10-02"],
        en: "Mahatma Gandhi’s Birthday",
        names: { "hi": "महात्मा गांधी की जयंती", "zh-CN": "圣雄甘地诞辰", "zh-TW": "聖雄甘地誕辰" },
      },
      { dates: ["2026-10-20", "2027-10-09"], en: "Dussehra", names: { "hi": "दशहरा", "zh-CN": "十胜节", "zh-TW": "十勝節" } },
      { dates: ["2026-11-08", "2027-10-29"], en: "Diwali", names: { "hi": "दीपावली", "zh-CN": "排灯节", "zh-TW": "排燈節" } },
      { dates: ["2026-11-24", "2027-11-14"], en: "Guru Nanak’s Birthday", names: { "hi": "गुरु नानक जयंती", "zh-CN": "锡克教祖师那纳克诞辰", "zh-TW": "錫克教祖師那納克誕辰" } },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "hi": "क्रिसमस", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2026-04-14"], en: "Dr. B. R. Ambedkar’s Birthday", names: { "hi": "डॉ. भीमराव आंबेडकर जयंती", "zh-CN": "安贝德卡尔博士诞辰", "zh-TW": "安貝德卡爾博士誕辰" } },
    ],
  },
  // Vietnamese public employees on a five-day week; omit ordinary weekends from contiguous breaks.
  // The labour law amendment adds the 27 July holiday starting in 2027.
  // https://baochinhphu.vn/quoc-hoi-dong-y-bo-sung-2-ngay-nghi-le-duoc-huong-nguyen-luong-102261121121448218.htm
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
      2028: {
        status: "not-published",
        verifiedOn: "2026-11-27",
        sourceUrl: "https://baochinhphu.vn/nghi-tet-am-lich-2027-keo-dai-7-ngay-nghi-quoc-khanh-4-ngay-102261010095648278.htm",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "vi": "Tết Dương lịch", "zh-CN": "元旦", "zh-TW": "元旦" } },
      {
        dates: [
          "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20",
          "2027-02-04", "2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08",
        ],
        en: "Lunar New Year (Tết)",
        names: { "vi": "Tết Nguyên đán", "zh-CN": "越南春节", "zh-TW": "越南春節" },
      },
      {
        dates: ["2026-04-26", "2027-04-16"],
        en: "Hùng Kings Commemoration Day",
        names: { "vi": "Giỗ Tổ Hùng Vương", "zh-CN": "雄王祭祖日", "zh-TW": "雄王祭祖日" },
      },
      { dates: ["2026-04-30", "2027-04-30"], en: "Reunification Day", names: { "vi": "Ngày Chiến thắng", "zh-CN": "越南统一日", "zh-TW": "越南統一日" } },
      {
        dates: ["2026-05-01", "2027-05-01"],
        en: "International Workers’ Day",
        names: { "vi": "Ngày Quốc tế Lao động", "zh-CN": "国际劳动节", "zh-TW": "國際勞動節" },
      },
      {
        dates: ["2026-09-01", "2026-09-02", "2027-09-02", "2027-09-03"],
        en: "National Day holiday",
        names: { "vi": "Nghỉ lễ Quốc khánh", "zh-CN": "国庆假期", "zh-TW": "國慶假期" },
      },
      {
        dates: ["2027-07-27"],
        en: "National Gratitude Day (War Invalids and Martyrs Day)",
        names: { "vi": "Ngày Tổ quốc tri ân – Ngày Thương binh, liệt sĩ", "zh-CN": "国家感恩日（伤残军人与烈士纪念日）", "zh-TW": "國家感恩日（傷殘軍人與烈士紀念日）" },
      },
      { dates: ["2026-11-24", "2027-11-24"], en: "Vietnamese Culture Day", names: { "vi": "Ngày Văn hóa Việt Nam", "zh-CN": "越南文化日", "zh-TW": "越南文化日" } },
      {
        dates: ["2026-04-27", "2027-02-09", "2027-02-10", "2027-05-03"],
        en: "Compensatory day off",
        names: { "vi": "Ngày nghỉ bù", "zh-CN": "补休日", "zh-TW": "補休日" },
        kind: "rest",
      },
      {
        dates: ["2026-01-02", "2026-08-31"],
        en: "Swapped day off",
        names: { "vi": "Ngày nghỉ hoán đổi", "zh-CN": "调休日", "zh-TW": "調休日" },
        kind: "rest",
      },
      {
        dates: ["2026-01-10", "2026-08-22"],
        en: "Substitute working Saturday",
        names: { "vi": "Ngày làm việc hoán đổi", "zh-CN": "周六补班", "zh-TW": "週六補班" },
        kind: "work",
      },
    ],
  },
} as const satisfies Readonly<Record<string, HolidaySchedule>>;
