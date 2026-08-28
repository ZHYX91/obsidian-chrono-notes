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

const CHT_LUNAR_FESTIVAL_NAMES: Readonly<Record<string, string>> = Object.freeze({
  接神日: "接神日",
  隔开日: "隔開日",
  人日: "人日",
  谷日: "穀日",
  顺星节: "順星節",
  天日: "天日",
  地日: "地日",
  天穿节: "天穿節",
  填仓节: "填倉節",
  正月晦: "正月晦",
  中和节: "中和節",
  社日节: "社日節",
  上巳节: "上巳節",
  分龙节: "分龍節",
  会龙节: "會龍節",
  天贶节: "天貺節",
  观莲节: "觀蓮節",
  五谷母节: "五穀母節",
  中元节: "中元節",
  财神节: "財神節",
  地藏节: "地藏節",
  天灸日: "天灸日",
  寒衣节: "寒衣節",
  十成节: "十成節",
  下元节: "下元節",
  驱傩日: "驅儺日",
  尾牙: "尾牙",
  祭灶日: "祭灶日",
  寒食节: "寒食節",
  春社: "春社",
  秋社: "秋社",
});

const EN_LUNAR_FESTIVAL_NAMES: Readonly<Record<string, string>> = Object.freeze({
  接神日: "Welcoming the Gods Day",
  隔开日: "Separation Day",
  人日: "Renri Festival",
  谷日: "Grain Day",
  顺星节: "Shunxing Festival",
  天日: "Heaven Day",
  地日: "Earth Day",
  天穿节: "Tianchuan Festival",
  填仓节: "Filling the Granaries Festival",
  正月晦: "Last Day of the First Lunar Month",
  中和节: "Zhonghe Festival",
  社日节: "She Festival",
  上巳节: "Shangsi Festival",
  分龙节: "Fenlong Festival",
  会龙节: "Huilong Festival",
  天贶节: "Tiankuang Festival",
  观莲节: "Lotus Viewing Festival",
  五谷母节: "Five Grains Mother Festival",
  中元节: "Zhongyuan Festival",
  财神节: "God of Wealth Festival",
  地藏节: "Dizang Festival",
  天灸日: "Tianjiu Day",
  寒衣节: "Cold Clothes Festival",
  十成节: "Shicheng Festival",
  下元节: "Xiayuan Festival",
  驱傩日: "Nuo Exorcism Day",
  尾牙: "Weiya",
  祭灶日: "Kitchen God Festival",
  寒食节: "Cold Food Festival",
  春社: "Spring She Day",
  秋社: "Autumn She Day",
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

export function localizeLunarFestivalName(name: string, locale: string): string {
  const language = resolveLunarLanguage(locale);
  if (language === "en") return EN_LUNAR_FESTIVAL_NAMES[name] ?? name;
  if (language === "cht") return CHT_LUNAR_FESTIVAL_NAMES[name] ?? name;
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
