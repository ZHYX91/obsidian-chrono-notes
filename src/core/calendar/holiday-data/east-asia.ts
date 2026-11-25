import type { HolidaySchedule } from "./schedule";

export const EAST_ASIA = {
  // Taiwan government administrative offices. Only named dates or exceptional working days from the DGPA CSV.
  // https://data.gov.tw/dataset/14718
  "tw": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.dgpa.gov.tw/information?pid=12574&uid=2",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.dgpa.gov.tw/information?pid=12983&uid=82",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "Founding Day", names: { "zh-CN": "开国纪念日", "zh-TW": "開國紀念日" } },
      {
        dates: ["2026-02-15", "2027-02-04"],
        en: "Day before Lunar New Year’s Eve",
        names: {
          "zh-CN": "小年夜",
          "zh-TW": "小年夜",
        },
      },
      {
        dates: ["2026-02-16", "2027-02-05"],
        en: "Lunar New Year’s Eve",
        names: {
          "zh-CN": "农历除夕",
          "zh-TW": "農曆除夕",
        },
      },
      {
        dates: ["2026-02-17", "2026-02-18", "2026-02-19", "2027-02-06", "2027-02-07", "2027-02-08"],
        en: "Lunar New Year",
        names: {
          "zh-CN": "春节",
          "zh-TW": "春節",
        },
      },
      {
        dates: [
          "2026-02-20", "2026-02-27", "2026-04-03", "2026-04-06", "2026-10-09", "2026-10-26",
          "2027-02-09", "2027-02-10", "2027-03-01", "2027-04-06", "2027-04-30", "2027-10-11", "2027-12-24", "2027-12-31",
        ],
        en: "Substitute holiday",
        names: {
          "zh-CN": "补假",
          "zh-TW": "補假",
        },
        kind: "rest",
      },
      {
        dates: ["2026-02-28", "2027-02-28"],
        en: "Peace Memorial Day",
        names: {
          "zh-CN": "和平纪念日",
          "zh-TW": "和平紀念日",
        },
      },
      { dates: ["2026-04-04", "2027-04-04"], en: "Children’s Day", names: { "zh-CN": "儿童节", "zh-TW": "兒童節" } },
      { dates: ["2026-04-05", "2027-04-05"], en: "Tomb Sweeping Day", names: { "zh-CN": "清明节", "zh-TW": "清明節" } },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2026-06-19", "2027-06-09"], en: "Dragon Boat Festival", names: { "zh-CN": "端午节", "zh-TW": "端午節" } },
      { dates: ["2026-09-25", "2027-09-15"], en: "Mid-Autumn Festival", names: { "zh-CN": "中秋节", "zh-TW": "中秋節" } },
      {
        dates: ["2026-09-28", "2027-09-28"],
        en: "Confucius’ Birthday / Teachers’ Day",
        names: {
          "zh-CN": "孔子诞辰纪念日／教师节",
          "zh-TW": "孔子誕辰紀念日/教師節",
        },
      },
      { dates: ["2026-10-10", "2027-10-10"], en: "National Day", names: { "zh-CN": "国庆日", "zh-TW": "國慶日" } },
      {
        dates: ["2026-10-25", "2027-10-25"],
        en: "Taiwan Retrocession and Kinmen Guningtou Victory Commemoration Day",
        names: {
          "zh-CN": "台湾光复暨金门古宁头大捷纪念日",
          "zh-TW": "臺灣光復暨金門古寧頭大捷紀念日",
        },
      },
      { dates: ["2026-12-25", "2027-12-25"], en: "Constitution Day", names: { "zh-CN": "行宪纪念日", "zh-TW": "行憲紀念日" } },
    ],
  },
  // Named general holidays published by 1823. Ordinary Sundays do not add a separate holiday badge.
  "hk": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.1823.gov.hk/en/hong-kong-public-holidays-ical",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.1823.gov.hk/en/hong-kong-public-holidays-ical",
      },
    },
    entries: [
      {
        dates: ["2026-01-01", "2027-01-01"],
        en: "The first day of January",
        names: {
          "zh-CN": "一月一日",
          "zh-TW": "一月一日",
        },
      },
      {
        dates: ["2026-02-17", "2027-02-06"],
        en: "Lunar New Year's Day",
        names: {
          "zh-CN": "农历年初一",
          "zh-TW": "農曆年初一",
        },
      },
      {
        dates: ["2026-02-18"],
        en: "The second day of Lunar New Year",
        names: {
          "zh-CN": "农历年初二",
          "zh-TW": "農曆年初二",
        },
      },
      {
        dates: ["2026-02-19", "2027-02-08"],
        en: "The third day of Lunar New Year",
        names: {
          "zh-CN": "农历年初三",
          "zh-TW": "農曆年初三",
        },
      },
      { dates: ["2026-04-03", "2027-03-26"], en: "Good Friday", names: { "zh-CN": "耶稣受难节", "zh-TW": "耶穌受難節" } },
      {
        dates: ["2026-04-04", "2027-03-27"],
        en: "The day following Good Friday",
        names: {
          "zh-CN": "耶稣受难节翌日",
          "zh-TW": "耶穌受難節翌日",
        },
      },
      {
        dates: ["2026-04-06"],
        en: "The day following Ching Ming Festival",
        names: {
          "zh-CN": "清明节翌日",
          "zh-TW": "清明節翌日",
        },
      },
      {
        dates: ["2026-04-07"],
        en: "The day following Easter Monday",
        names: {
          "zh-CN": "复活节星期一翌日",
          "zh-TW": "復活節星期一翌日",
        },
      },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      {
        dates: ["2026-05-25"],
        en: "The day following the Birthday of the Buddha",
        names: {
          "zh-CN": "佛诞翌日",
          "zh-TW": "佛誕翌日",
        },
      },
      { dates: ["2026-06-19", "2027-06-09"], en: "Tuen Ng Festival", names: { "zh-CN": "端午节", "zh-TW": "端午節" } },
      {
        dates: ["2026-07-01", "2027-07-01"],
        en: "Hong Kong Special Administrative Region Establishment Day",
        names: {
          "zh-CN": "香港特别行政区成立纪念日",
          "zh-TW": "香港特別行政區成立紀念日",
        },
      },
      {
        dates: ["2026-09-26", "2027-09-16"],
        en: "The day following the Chinese Mid-Autumn Festival",
        names: {
          "zh-CN": "中秋节翌日",
          "zh-TW": "中秋節翌日",
        },
      },
      { dates: ["2026-10-01", "2027-10-01"], en: "National Day", names: { "zh-CN": "国庆日", "zh-TW": "國慶日" } },
      {
        dates: ["2026-10-19"],
        en: "The day following Chung Yeung Festival",
        names: {
          "zh-CN": "重阳节翌日",
          "zh-TW": "重陽節翌日",
        },
      },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      {
        dates: ["2026-12-26", "2027-12-27"],
        en: "The first weekday after Christmas Day",
        names: {
          "zh-CN": "圣诞节后第一个周日",
          "zh-TW": "聖誕節後第一個周日",
        },
      },
      {
        dates: ["2027-02-09"],
        en: "The fourth day of Lunar New Year",
        names: {
          "zh-CN": "农历年初四",
          "zh-TW": "農曆年初四",
        },
      },
      { dates: ["2027-03-29"], en: "Easter Monday", names: { "zh-CN": "复活节星期一", "zh-TW": "復活節星期一" } },
      { dates: ["2027-04-05"], en: "Ching Ming Festival", names: { "zh-CN": "清明节", "zh-TW": "清明節" } },
      { dates: ["2027-05-13"], en: "The Birthday of the Buddha", names: { "zh-CN": "佛诞", "zh-TW": "佛誕" } },
      { dates: ["2027-10-08"], en: "Chung Yeung Festival", names: { "zh-CN": "重阳节", "zh-TW": "重陽節" } },
    ],
  },
  // First (public-holidays) table of the Macao government calendar only. Civil-service half-days and
  // compensatory rest days are separate tables and do not apply to this region selection.
  "mo": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gov.mo/en/public-holidays/year-2026/",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www.gov.mo/en/public-holidays/year-2027/",
      },
    },
    entries: [
      {
        dates: ["2026-01-01", "2027-01-01"],
        en: "New Year’s Day",
        names: {
          "zh-CN": "元旦",
          "zh-TW": "元旦",
          "pt": "Fraternidade Universal",
        },
      },
      {
        dates: ["2026-02-17", "2027-02-06"],
        en: "Lunar New Year's Day",
        names: {
          "zh-CN": "农历正月初一",
          "zh-TW": "農曆正月初一",
          "pt": "1.º dia do Novo Ano Lunar",
        },
      },
      {
        dates: ["2026-02-18", "2027-02-07"],
        en: "The second day of the Lunar New Year",
        names: {
          "zh-CN": "农历正月初二",
          "zh-TW": "農曆正月初二",
          "pt": "2.º dia do Novo Ano Lunar",
        },
      },
      {
        dates: ["2026-02-19", "2027-02-08"],
        en: "The third day of the Lunar New Year",
        names: {
          "zh-CN": "农历正月初三",
          "zh-TW": "農曆正月初三",
          "pt": "3.º dia do Novo Ano Lunar",
        },
      },
      {
        dates: ["2026-04-03", "2027-03-26"],
        en: "Good Friday",
        names: {
          "zh-CN": "耶稣受难日",
          "zh-TW": "耶穌受難日",
          "pt": "Morte de Cristo",
        },
      },
      {
        dates: ["2026-04-04", "2027-03-27"],
        en: "The Day before Easter",
        names: {
          "zh-CN": "复活节前日",
          "zh-TW": "復活節前日",
          "pt": "Véspera da Ressurreição de Cristo",
        },
      },
      {
        dates: ["2026-04-05", "2027-04-05"],
        en: "Cheng Ming Festival",
        names: {
          "zh-CN": "清明节",
          "zh-TW": "清明節",
          "pt": "Cheng Ming (Dia de Finados)",
        },
      },
      {
        dates: ["2026-05-01", "2027-05-01"],
        en: "Labour Day",
        names: {
          "zh-CN": "劳动节",
          "zh-TW": "勞動節",
          "pt": "Dia do Trabalhador",
        },
      },
      {
        dates: ["2026-05-24", "2027-05-13"],
        en: "The Buddha’s Birthday (Feast of Buddha)",
        names: {
          "zh-CN": "佛诞节",
          "zh-TW": "佛誕節",
          "pt": "Dia do Buda",
        },
      },
      {
        dates: ["2026-06-19", "2027-06-09"],
        en: "Tung Ng Festival (Dragon Boat Festival)",
        names: {
          "zh-CN": "端午节",
          "zh-TW": "端午節",
          "pt": "Tung Ng (Barco Dragão)",
        },
      },
      {
        dates: ["2026-09-26", "2027-09-16"],
        en: "The Day following Chong Chao (Mid-Autumn) Festival",
        names: {
          "zh-CN": "中秋节翌日",
          "zh-TW": "中秋節翌日",
          "pt": "Dia seguinte ao Chong Chao (Bolo Lunar)",
        },
      },
      {
        dates: ["2026-10-01", "2027-10-01"],
        en: "National Day of the People’s Republic of China",
        names: {
          "zh-CN": "中华人民共和国国庆日",
          "zh-TW": "中華人民共和國國慶日",
          "pt": "Implantação da República Popular da China",
        },
      },
      {
        dates: ["2026-10-02", "2027-10-02"],
        en: "The Day following National Day of the People’s Republic of China",
        names: {
          "zh-CN": "中华人民共和国国庆日翌日",
          "zh-TW": "中華人民共和國國慶日翌日",
          "pt": "Dia seguinte à Implantação da República Popular da China",
        },
      },
      {
        dates: ["2026-10-18", "2027-10-08"],
        en: "Chong Yeung Festival (Festival of Ancestors)",
        names: {
          "zh-CN": "重阳节",
          "zh-TW": "重陽節",
          "pt": "Chong Yeong (Culto dos Antepassados)",
        },
      },
      {
        dates: ["2026-11-02", "2027-11-02"],
        en: "All Soul’s Day",
        names: {
          "zh-CN": "追思节",
          "zh-TW": "追思節",
          "pt": "Dia de Finados",
        },
      },
      {
        dates: ["2026-12-08", "2027-12-08"],
        en: "Feast of Immaculate Conception",
        names: {
          "zh-CN": "圣母无原罪瞻礼",
          "zh-TW": "聖母無原罪瞻禮",
          "pt": "Imaculada Conceição",
        },
      },
      {
        dates: ["2026-12-20", "2027-12-20"],
        en: "Macao S.A.R. Establishment Day",
        names: {
          "zh-CN": "澳门特别行政区成立纪念日",
          "zh-TW": "澳門特別行政區成立紀念日",
          "pt": "Dia Comemorativo do Estabelecimento da Região Administrativa Especial de Macau",
        },
      },
      {
        dates: ["2026-12-22", "2027-12-22"],
        en: "Winter Solstice",
        names: {
          "zh-CN": "冬至",
          "zh-TW": "冬至",
          "pt": "Solstício de Inverno",
        },
      },
      {
        dates: ["2026-12-24", "2027-12-24"],
        en: "Christmas Eve",
        names: {
          "zh-CN": "圣诞节前日",
          "zh-TW": "聖誕節前日",
          "pt": "Véspera de Natal",
        },
      },
      {
        dates: ["2026-12-25", "2027-12-25"],
        en: "Christmas Day",
        names: {
          "zh-CN": "圣诞节",
          "zh-TW": "聖誕節",
          "pt": "Natal",
        },
      },
    ],
  },
  // The Cabinet Office distinguishes article 3(2) substitutes from article 3(3) days between holidays.
  "jp": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "ja": "元日", "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-01-12", "2027-01-11"], en: "Coming of Age Day", names: { "ja": "成人の日", "zh-CN": "成人节", "zh-TW": "成人節" } },
      { dates: ["2026-02-11", "2027-02-11"], en: "National Foundation Day", names: { "ja": "建国記念の日", "zh-CN": "建国纪念日", "zh-TW": "建國紀念日" } },
      { dates: ["2026-02-23", "2027-02-23"], en: "Emperor’s Birthday", names: { "ja": "天皇誕生日", "zh-CN": "天皇诞辰", "zh-TW": "天皇誕辰" } },
      { dates: ["2026-03-20", "2027-03-21"], en: "Vernal Equinox Day", names: { "ja": "春分の日", "zh-CN": "春分日", "zh-TW": "春分日" } },
      { dates: ["2026-04-29", "2027-04-29"], en: "Shōwa Day", names: { "ja": "昭和の日", "zh-CN": "昭和之日", "zh-TW": "昭和之日" } },
      { dates: ["2026-05-03", "2027-05-03"], en: "Constitution Memorial Day", names: { "ja": "憲法記念日", "zh-CN": "宪法纪念日", "zh-TW": "憲法紀念日" } },
      { dates: ["2026-05-04", "2027-05-04"], en: "Greenery Day", names: { "ja": "みどりの日", "zh-CN": "绿之日", "zh-TW": "綠之日" } },
      { dates: ["2026-05-05", "2027-05-05"], en: "Children’s Day", names: { "ja": "こどもの日", "zh-CN": "儿童节", "zh-TW": "兒童節" } },
      { dates: ["2026-05-06", "2027-03-22"], en: "Substitute holiday", names: { "ja": "振替休日", "zh-CN": "补假", "zh-TW": "補假" }, kind: "rest" },
      { dates: ["2026-07-20", "2027-07-19"], en: "Marine Day", names: { "ja": "海の日", "zh-CN": "海之日", "zh-TW": "海之日" } },
      { dates: ["2026-08-11", "2027-08-11"], en: "Mountain Day", names: { "ja": "山の日", "zh-CN": "山之日", "zh-TW": "山之日" } },
      { dates: ["2026-09-21", "2027-09-20"], en: "Respect for the Aged Day", names: { "ja": "敬老の日", "zh-CN": "敬老日", "zh-TW": "敬老日" } },
      { dates: ["2026-09-22"], en: "Citizens’ Holiday", names: { "ja": "国民の休日", "zh-CN": "国民休假日", "zh-TW": "國民休假日" } },
      { dates: ["2026-09-23", "2027-09-23"], en: "Autumnal Equinox Day", names: { "ja": "秋分の日", "zh-CN": "秋分日", "zh-TW": "秋分日" } },
      { dates: ["2026-10-12", "2027-10-11"], en: "Sports Day", names: { "ja": "スポーツの日", "zh-CN": "体育日", "zh-TW": "體育日" } },
      { dates: ["2026-11-03", "2027-11-03"], en: "Culture Day", names: { "ja": "文化の日", "zh-CN": "文化日", "zh-TW": "文化日" } },
      { dates: ["2026-11-23", "2027-11-23"], en: "Labor Thanksgiving Day", names: { "ja": "勤労感謝の日", "zh-CN": "勤劳感谢日", "zh-TW": "勤勞感謝日" } },
    ],
  },
  // The 2026 almanac predates the amendment that added Labour Day and Constitution Day.
  // https://www.korea.net/Government/Briefing-Room/Press-Releases/view?articleId=2016796&insttCode=A260225&type=N
  "kr": {
    sources: {
      2026: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://astro.kasi.re.kr/kor/life/post/calendarData?year=2026",
      },
      2027: {
        status: "published",
        verifiedOn: "2026-11-25",
        sourceUrl: "https://astro.kasi.re.kr/kor/life/post/calendarData?year=2027",
      },
    },
    entries: [
      { dates: ["2026-01-01", "2027-01-01"], en: "New Year’s Day", names: { "ko": "1월 1일", "zh-CN": "元旦", "zh-TW": "元旦" } },
      { dates: ["2026-08-15", "2027-08-15"], en: "Liberation Day", names: { "ko": "광복절", "zh-CN": "光复节", "zh-TW": "光復節" } },
      {
        dates: ["2026-02-16", "2026-02-17", "2026-02-18", "2027-02-06", "2027-02-07", "2027-02-08"],
        en: "Seollal",
        names: { "ko": "설날", "zh-CN": "韩国春节", "zh-TW": "韓國春節" },
      },
      {
        dates: ["2026-08-17", "2027-08-16"],
        en: "Liberation Day (substitute holiday)",
        names: { "ko": "대체공휴일(광복절)", "zh-CN": "光复节（补假）", "zh-TW": "光復節（補假）" },
        kind: "rest",
      },
      { dates: ["2026-03-01", "2027-03-01"], en: "Independence Movement Day", names: { "ko": "3.1절", "zh-CN": "三一独立运动纪念日", "zh-TW": "三一獨立運動紀念日" } },
      {
        dates: ["2026-09-24", "2026-09-25", "2026-09-26", "2027-09-14", "2027-09-15", "2027-09-16"],
        en: "Chuseok",
        names: { "ko": "추석", "zh-CN": "秋夕（韩国中秋节）", "zh-TW": "秋夕（韓國中秋節）" },
      },
      {
        dates: ["2026-03-02"],
        en: "Independence Movement Day (substitute holiday)",
        names: { "ko": "대체공휴일(3.1절)", "zh-CN": "三一独立运动纪念日（补假）", "zh-TW": "三一獨立運動紀念日（補假）" },
        kind: "rest",
      },
      { dates: ["2026-10-03", "2027-10-03"], en: "National Foundation Day", names: { "ko": "개천절", "zh-CN": "开天节", "zh-TW": "開天節" } },
      { dates: ["2026-05-05", "2027-05-05"], en: "Children’s Day", names: { "ko": "어린이날", "zh-CN": "儿童节", "zh-TW": "兒童節" } },
      {
        dates: ["2026-10-05", "2027-10-04"],
        en: "National Foundation Day (substitute holiday)",
        names: { "ko": "대체공휴일(개천절)", "zh-CN": "开天节（补假）", "zh-TW": "開天節（補假）" },
        kind: "rest",
      },
      { dates: ["2026-05-24", "2027-05-13"], en: "Buddha’s Birthday", names: { "ko": "부처님오신날", "zh-CN": "佛诞日", "zh-TW": "佛誕日" } },
      { dates: ["2026-10-09", "2027-10-09"], en: "Hangeul Day", names: { "ko": "한글날", "zh-CN": "韩文日", "zh-TW": "韓文日" } },
      {
        dates: ["2026-05-25"],
        en: "Buddha’s Birthday (substitute holiday)",
        names: { "ko": "대체공휴일(부처님오신날)", "zh-CN": "佛诞日（补假）", "zh-TW": "佛誕日（補假）" },
        kind: "rest",
      },
      { dates: ["2026-12-25", "2027-12-25"], en: "Christmas Day", names: { "ko": "기독탄신일", "zh-CN": "圣诞节", "zh-TW": "聖誕節" } },
      { dates: ["2026-06-03"], en: "Nationwide local elections", names: { "ko": "전국동시지방선거", "zh-CN": "全国地方选举日", "zh-TW": "全國地方選舉日" } },
      { dates: ["2026-06-06", "2027-06-06"], en: "Memorial Day", names: { "ko": "현충일", "zh-CN": "显忠日", "zh-TW": "顯忠日" } },
      { dates: ["2026-07-17", "2027-07-17"], en: "Constitution Day", names: { "ko": "제헌절", "zh-CN": "制宪节", "zh-TW": "制憲節" } },
      { dates: ["2027-02-09"], en: "Seollal (substitute holiday)", names: { "ko": "대체공휴일(설날)", "zh-CN": "韩国春节（补假）", "zh-TW": "韓國春節（補假）" }, kind: "rest" },
      { dates: ["2026-05-01", "2027-05-01"], en: "Labour Day", names: { "ko": "노동절", "zh-CN": "劳动节", "zh-TW": "勞動節" } },
      { dates: ["2027-05-03"], en: "Labour Day (substitute holiday)", names: { "ko": "대체공휴일(노동절)", "zh-CN": "劳动节（补假）", "zh-TW": "勞動節（補假）" }, kind: "rest" },
      { dates: ["2027-10-11"], en: "Hangeul Day (substitute holiday)", names: { "ko": "대체공휴일(한글날)", "zh-CN": "韩文日（补假）", "zh-TW": "韓文日（補假）" }, kind: "rest" },
      {
        dates: ["2027-12-27"],
        en: "Christmas Day (substitute holiday)",
        names: { "ko": "대체공휴일(기독탄신일)", "zh-CN": "圣诞节（补假）", "zh-TW": "聖誕節（補假）" },
        kind: "rest",
      },
      {
        dates: ["2027-07-19"],
        en: "Constitution Day (substitute holiday)",
        names: { "ko": "대체공휴일(제헌절)", "zh-CN": "制宪节（补假）", "zh-TW": "制憲節（補假）" },
        kind: "rest",
      },
    ],
  },
} as const satisfies Readonly<Record<string, HolidaySchedule>>;
