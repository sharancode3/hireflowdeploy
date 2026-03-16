export function normalizePhoneInput(value: string) {
  return value.replace(/[^\d\s()-]/g, "");
}

export function countDigits(value: string) {
  return (value.match(/\d/g) || []).length;
}

export function splitPhoneWithCode(value: string | null | undefined, fallbackCode = "+91") {
  const raw = (value ?? "").trim();
  const match = raw.match(/^(\+\d{1,4})\s*(.*)$/);
  if (!match) {
    return {
      countryCode: fallbackCode,
      phone: normalizePhoneInput(raw),
    };
  }

  return {
    countryCode: match[1],
    phone: normalizePhoneInput(match[2] ?? ""),
  };
}

export function composePhoneWithCode(countryCode: string, phone: string) {
  const normalized = normalizePhoneInput(phone).trim();
  if (!normalized) return "";
  return `${countryCode} ${normalized}`;
}
