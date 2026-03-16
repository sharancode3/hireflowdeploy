export type PhoneCountry = {
  name: string;
  code: string;
  min: number;
  max: number;
};

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { name: "India", code: "+91", min: 10, max: 10 },
  { name: "United States", code: "+1", min: 10, max: 10 },
  { name: "United Kingdom", code: "+44", min: 10, max: 11 },
  { name: "Canada", code: "+1", min: 10, max: 10 },
  { name: "Australia", code: "+61", min: 9, max: 9 },
  { name: "United Arab Emirates", code: "+971", min: 9, max: 9 },
  { name: "Singapore", code: "+65", min: 8, max: 8 },
  { name: "Germany", code: "+49", min: 10, max: 11 },
] as const;

export function getPhoneCountryByCode(code: string): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.code === code) ?? PHONE_COUNTRIES[0];
}
