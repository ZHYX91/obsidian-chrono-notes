export interface PluralMessage {
  readonly one: string;
  readonly other: string;
}

export type MessageValue = string | PluralMessage;
