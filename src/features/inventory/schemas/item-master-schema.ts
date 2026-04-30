import { z } from "zod";

function normalizeOptionalCategory(
  category: string | null | undefined,
): string | null {
  const trimmedCategory = category?.trim() ?? "";

  if (trimmedCategory === "") {
    return null;
  }

  return trimmedCategory;
}

export const itemMasterSchema = z.object({
  name: z.string().trim().min(1, "品目名を入力してください。"),
  category: z
    .string()
    .nullish()
    .transform((category) => normalizeOptionalCategory(category)),
  unit: z.string().trim().min(1, "単位を入力してください。"),
});

export const itemIdSchema = z.uuid("品目IDが不正です。");

export type ItemMasterInput = z.input<typeof itemMasterSchema>;
export type ItemMasterValues = z.output<typeof itemMasterSchema>;
