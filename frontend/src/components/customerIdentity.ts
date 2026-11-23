// Presentation alias only: routing, edits and persistence retain the original ID/UUID.
export function customerCode(value: string): string {
  const match = /^bulk:([a-f0-9]{64})$/i.exec(value);
  return match ? `KH-${match[1]!.slice(0, 10).toUpperCase()}` : value;
}

export function customerSearch(value: string): string {
  const match = /^KH-([a-f0-9]{10})$/i.exec(value);
  // Existing server search is substring-based; also keep literal KH-* IDs findable.
  return match ? match[1]! : value;
}
