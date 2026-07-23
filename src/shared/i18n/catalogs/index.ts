import type { MessageCatalogs } from "../types";
import { EN_MESSAGES } from "./en";
import { AM_MESSAGES } from "./am";
import { AR_MESSAGES } from "./ar";
import { FA_MESSAGES } from "./fa";
import { HE_MESSAGES } from "./he";
import { HI_MESSAGES } from "./hi";
import { ZH_CN_MESSAGES } from "./zh-cn";
import { ZH_TW_MESSAGES } from "./zh-tw";

export const MESSAGE_CATALOGS: MessageCatalogs = Object.freeze({
  en: Object.freeze(EN_MESSAGES),
  ar: AR_MESSAGES,
  fa: FA_MESSAGES,
  he: HE_MESSAGES,
  am: AM_MESSAGES,
  hi: HI_MESSAGES,
  "zh-CN": Object.freeze(ZH_CN_MESSAGES),
  "zh-TW": Object.freeze(ZH_TW_MESSAGES),
});
