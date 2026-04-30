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

export const inboundRegistrationSchema = z.object({
  itemId: z.union([z.uuid(), z.literal("")]).optional(),
  itemName: z
    .string()
    .trim()
    .min(1, "品目名を入力してください。"),
  category: z
    .string()
    .trim()
    .min(1, "カテゴリを選択してください。"),
  unit: z
    .string()
    .trim()
    .min(1, "単位を選択してください。"),
  quantity: z.coerce
    .number("入庫数量を入力してください。")
    .int("入庫数量は整数で入力してください。")
    .min(1, "入庫数量は1以上で入力してください。"),
  transactionDate: z
    .string()
    .regex(DATE_PATTERN, "入庫日はYYYY-MM-DD形式で入力してください。")
    .refine(isExistingDate, "実在する入庫日を入力してください。"),
  note: z
    .string()
    .nullish()
    .transform((note) => normalizeOptionalNote(note)),
});

export type InboundRegistrationInput = z.input<
  typeof inboundRegistrationSchema
>;

export type InboundRegistrationValues = z.output<
  typeof inboundRegistrationSchema
>;
