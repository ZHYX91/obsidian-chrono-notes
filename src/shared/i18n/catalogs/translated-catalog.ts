import type { MessageValue } from "../message-value";
import type { MessageCatalog } from "../types";
import { EN_MESSAGES } from "./en";

const MESSAGE_KEYS = Object.freeze(Object.keys(EN_MESSAGES));

export function createTranslatedCatalog(
  values: readonly MessageValue[],
): MessageCatalog {
  if (values.length !== MESSAGE_KEYS.length) {
    throw new RangeError(
      `Translated catalog has ${values.length} values; expected ${MESSAGE_KEYS.length}`,
    );
  }
  return Object.freeze(Object.fromEntries(MESSAGE_KEYS.map((key, index) => [
    key,
    freezeMessage(values[index]),
  ]))) as MessageCatalog;
}

function freezeMessage(value: MessageValue | undefined): MessageValue {
  if (value === undefined) throw new RangeError("Translated catalog value is missing");
  return typeof value === "string" ? value : Object.freeze({ ...value });
}
