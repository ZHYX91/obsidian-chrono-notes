import { I18n } from "lunar-typescript";

type LunarLanguage = "chs" | "cht" | "en";

const EN_SOLAR_TERM_NAMES: Readonly<Record<string, string>> = Object.freeze({
  冬至: "Winter Solstice",
  "Winter Solstice": "Winter Solstice",
  小寒: "Minor Cold",
  "Lesser Cold": "Minor Cold",
  大寒: "Major Cold",
  "Great Cold": "Major Cold",
  立春: "Start of Spring",
  "Spring Beginning": "Start of Spring",
  雨水: "Rain Water",
  "Rain Water": "Rain Water",
  惊蛰: "Awakening of Insects",
  "Awakening from Hibernation": "Awakening of Insects",
  春分: "Spring Equinox",
  "Spring Equinox": "Spring Equinox",
  清明: "Pure Brightness",
  "Fresh Green": "Pure Brightness",
  谷雨: "Grain Rain",
  "Grain Rain": "Grain Rain",
  立夏: "Start of Summer",
  "Beginning of Summer": "Start of Summer",
  小满: "Grain Buds",
  "Lesser Fullness": "Grain Buds",
  芒种: "Grain in Ear",
  "Grain in Ear": "Grain in Ear",
  夏至: "Summer Solstice",
  "Summer Solstice": "Summer Solstice",
  小暑: "Minor Heat",
  "Lesser Heat": "Minor Heat",
  大暑: "Major Heat",
  "Greater Heat": "Major Heat",
  立秋: "Start of Autumn",
  "Beginning of Autumn": "Start of Autumn",
  处暑: "End of Heat",
  "End of Heat": "End of Heat",
  白露: "White Dew",
  "White Dew": "White Dew",
  秋分: "Autumn Equinox",
  "Autumnal Equinox": "Autumn Equinox",
  寒露: "Cold Dew",
  "Cold Dew": "Cold Dew",
  霜降: "Frost's Descent",
  "First Frost": "Frost's Descent",
  立冬: "Start of Winter",
  "Beginning of Winter": "Start of Winter",
  小雪: "Minor Snow",
  "Light Snow": "Minor Snow",
  大雪: "Major Snow",
  "Heavy Snow": "Major Snow",
});

const CHT_SOLAR_TERM_NAMES: Readonly<Record<string, string>> = Object.freeze({
  惊蛰: "驚蟄",
  谷雨: "穀雨",
  小满: "小滿",
  芒种: "芒種",
  处暑: "處暑",
});

const CHT_MESSAGES: Readonly<Record<string, string>> = {
  "m.twelve": "臘",
  "jq.jingZhe": "驚蟄",
  "jq.xiaoMan": "小滿",
  "jq.mangZhong": "芒種",
  "jq.chuShu": "處暑",
  "jr.chuXi": "除夕",
  "jr.chunJie": "春節",
  "jr.yuanXiao": "元宵節",
  "jr.longTou": "龍頭節",
  "jr.duanWu": "端午節",
  "jr.qiXi": "七夕節",
  "jr.zhongQiu": "中秋節",
  "jr.chongYang": "重陽節",
  "jr.laBa": "臘八節",
};

const EN_MESSAGES: Readonly<Record<string, string>> = {
  "jr.chuXi": "Chinese New Year's Eve",
  "jr.chunJie": "Lunar New Year",
  "jr.yuanXiao": "Lantern Festival",
  "jr.longTou": "Dragon-Head-Raising Day",
  "jr.duanWu": "Dragon Boat Festival",
  "jr.qiXi": "Qixi Festival",
  "jr.zhongQiu": "Mid-Autumn Festival",
  "jr.chongYang": "Double Ninth Festival",
  "jr.laBa": "Laba Festival",
};

let messagesRegistered = false;

export function withLunarLibraryLanguage<T>(locale: string, operation: () => T): T {
  registerMessages();
  const previousLanguage = I18n.getLanguage();
  const targetLanguage = resolveLunarLanguage(locale);
  if (targetLanguage !== previousLanguage) I18n.setLanguage(targetLanguage);
  try {
    return operation();
  } finally {
    if (I18n.getLanguage() !== previousLanguage) {
      I18n.setLanguage(previousLanguage);
    }
  }
}

export function localizeSolarTermName(name: string, locale: string): string {
  const language = resolveLunarLanguage(locale);
  if (language === "en") return EN_SOLAR_TERM_NAMES[name] ?? name;
  if (language === "cht") return CHT_SOLAR_TERM_NAMES[name] ?? name;
  return name;
}

function resolveLunarLanguage(locale: string): LunarLanguage {
  const normalized = locale.toLowerCase();
  if (normalized === "cht") return "cht";
  if (normalized === "chs") return "chs";
  if (normalized === "en") return "en";
  if (
    normalized.startsWith("zh-tw") ||
    normalized.startsWith("zh-hk") ||
    normalized.includes("hant")
  ) return "cht";
  if (normalized.startsWith("zh")) return "chs";
  return "en";
}

function registerMessages(): void {
  if (messagesRegistered) return;
  I18n.setMessages("cht", CHT_MESSAGES);
  I18n.setMessages("en", EN_MESSAGES);
  messagesRegistered = true;
}
