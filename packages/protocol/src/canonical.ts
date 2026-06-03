const SELECTED_HEADER_NAMES = new Set([
  "content-type",
  "x-agent-id",
  "x-merchant-id",
  "x-resource-id",
]);

type JsonPrimitive = string | number | boolean | null;
type CanonicalValue =
  | JsonPrimitive
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value ?? {}));
}

export function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  const sortedParams = Array.from(parsed.searchParams.entries()).sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
  );

  parsed.search = "";
  for (const [key, value] of sortedParams) {
    parsed.searchParams.append(key, value);
  }
  parsed.hash = "";

  return parsed.toString();
}

export function canonicalSelectedHeaders(
  headers: Record<string, string | string[] | undefined> = {},
): Record<string, string> {
  const selected: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.toLowerCase();
    if (!SELECTED_HEADER_NAMES.has(lowerName) || value === undefined) {
      continue;
    }
    selected[lowerName] = Array.isArray(value) ? value.join(",") : value;
  }

  return Object.fromEntries(
    Object.entries(selected).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function canonicalize(value: unknown): CanonicalValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Canonical JSON does not support non-finite numbers.");
    }
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value === "object" && value !== null) {
    const result: { [key: string]: CanonicalValue } = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) {
        result[key] = canonicalize(item);
      }
    }
    return result;
  }

  throw new Error(`Canonical JSON does not support ${typeof value}.`);
}
