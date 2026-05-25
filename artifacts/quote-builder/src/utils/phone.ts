export function formatPhoneUS(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);

  if (digits.startsWith("1")) {
    const d = digits.slice(1);
    if (d.length === 0) return "+1 ";
    if (d.length <= 3) return `+1 (${d}`;
    if (d.length <= 6) return `+1 (${d.slice(0, 3)}) ${d.slice(3)}`;
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  const d = digits;
  if (d.length === 0) return "";
  if (d.length <= 3) return `+1 (${d}`;
  if (d.length <= 6) return `+1 (${d.slice(0, 3)}) ${d.slice(3)}`;
  return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function onPhoneChange(
  raw: string,
  prev: string,
  set: (v: string) => void
) {
  const formatted = formatPhoneUS(raw);
  if (formatted !== prev) set(formatted);
}
