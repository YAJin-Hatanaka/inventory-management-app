import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeOptionalNote(note: string | null | undefined): string | null {
  const trimmedNote = note?.trim() ?? "";

  if (trimmedNote === "") {
    return null;
  }

  return trimmedNote;
}

function isExistingDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export const outboundRegistrationSchema = z.object({
  itemId: z.uuid("品目を選択してください。"),
  quantity: z.coerce
    .number("出庫数量を入力してください。")
    .int("出庫数量は整数で入力してください。")
    .min(1, "出庫数量は1以上で入力してください。"),
  transactionDate: z
    .string()
    .regex(DATE_PATTERN, "出庫日はYYYY-MM-DD形式で入力してください。")
    .refine(isExistingDate, "実在する出庫日を入力してください。"),
  note: z
    .string()
    .nullish()
    .transform((note) => normalizeOptionalNote(note)),
});

export type OutboundRegistrationInput = z.input<
  typeof outboundRegistrationSchema
>;

export type OutboundRegistrationValues = z.output<
  typeof outboundRegistrationSchema
>;
