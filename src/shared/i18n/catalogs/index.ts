import type { MessageCatalogs } from "../types";
import { EN_MESSAGES } from "./en";
import { ZH_CN_MESSAGES } from "./zh-cn";
import { ZH_TW_MESSAGES } from "./zh-tw";

export const MESSAGE_CATALOGS: MessageCatalogs = Object.freeze({
  en: Object.freeze(EN_MESSAGES),
  "zh-CN": Object.freeze(ZH_CN_MESSAGES),
  "zh-TW": Object.freeze(ZH_TW_MESSAGES),
});
