import type { MessageCatalogs } from "../types";
import { VI_MESSAGES } from "./vi";
import { KO_MESSAGES } from "./ko";
import { JA_MESSAGES } from "./ja";
import { RU_MESSAGES } from "./ru";
import { PT_BR_MESSAGES } from "./pt-br";
import { ES_MESSAGES } from "./es";
import { FR_MESSAGES } from "./fr";
import { DE_MESSAGES } from "./de";
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
  "de-DE": DE_MESSAGES,
  "fr-FR": FR_MESSAGES,
  "es-ES": ES_MESSAGES,
  "pt-BR": PT_BR_MESSAGES,
  "ru-RU": RU_MESSAGES,
  "ja-JP": JA_MESSAGES,
  "ko-KR": KO_MESSAGES,
  "vi-VN": VI_MESSAGES,
});
