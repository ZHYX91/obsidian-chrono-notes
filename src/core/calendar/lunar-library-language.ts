import { I18n } from "lunar-typescript";

type LunarLanguage = "chs" | "cht" | "en";

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

function resolveLunarLanguage(locale: string): LunarLanguage {
  const normalized = locale.toLowerCase();
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
  I18n.setMessages("en", { "jr.chunJie": "Lunar New Year" });
  messagesRegistered = true;
}
