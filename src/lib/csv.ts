/**
 * Escapes a CSV field value according to RFC 4180.
 * Wraps in double quotes if the value contains commas, double quotes, or newlines.
 * Internal double quotes are escaped by doubling them.
 */
export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
