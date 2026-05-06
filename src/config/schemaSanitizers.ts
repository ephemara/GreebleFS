import { z } from "zod";

export const looseRecordSchema = z.record(z.string(), z.unknown());

const optionalTrimmedStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : undefined),
  z.string().min(1).optional(),
);

const stringArraySchema = z.array(z.string());

export function sanitizeLooseRecord(value: unknown): Record<string, unknown> | null {
  const parsedRecord = looseRecordSchema.safeParse(value);
  return parsedRecord.success ? parsedRecord.data : null;
}

export function sanitizeOptionalTrimmedString(value: unknown): string | undefined {
  const parsedValue = optionalTrimmedStringSchema.safeParse(value);
  return parsedValue.success ? parsedValue.data : undefined;
}

export function sanitizeRequiredTrimmedString(value: unknown, fallback = ""): string {
  return sanitizeOptionalTrimmedString(value) ?? fallback;
}

export function sanitizeFiniteNumber(value: unknown, fallback: number): number {
  const parsedValue = z.number().finite().safeParse(value);
  return parsedValue.success ? parsedValue.data : fallback;
}

export function sanitizeStringArray(value: unknown): string[] {
  const parsedValue = stringArraySchema.safeParse(value);
  if (!parsedValue.success) {
    return [];
  }

  return Array.from(
    new Set(
      parsedValue.data
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
}

export function sanitizeRecordValues<TValue>(
  value: unknown,
  valueSchema: z.ZodType<TValue>,
): Record<string, TValue> {
  const sourceRecord = sanitizeLooseRecord(value);
  if (!sourceRecord) {
    return {};
  }

  const sanitizedEntries = Object.entries(sourceRecord).flatMap(([key, entryValue]) => {
    const parsedValue = valueSchema.safeParse(entryValue);
    return parsedValue.success ? [[key, parsedValue.data] as const] : [];
  });

  return Object.fromEntries(sanitizedEntries);
}

export function sanitizeObjectArray<TValue>(
  value: unknown,
  objectSchema: z.ZodType<TValue>,
): TValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const parsedEntry = objectSchema.safeParse(entry);
    return parsedEntry.success ? [parsedEntry.data] : [];
  });
}
