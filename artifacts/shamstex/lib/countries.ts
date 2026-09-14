// Arab countries + Turkey supported by Shams Tex
// Each country: ISO code, dial prefix, flag emoji, name (Arabic), and local phone regex
// (length and starting digit after stripping non-digits and any leading 0).

export type Country = {
  iso: string;
  dial: string;          // e.g. "+20"
  flag: string;          // emoji
  nameAr: string;
  // Min/max length AFTER stripping country code and any leading zero
  minLen: number;
  maxLen: number;
  // Local prefix e.g. for Egypt mobiles starts with "1"
  localPrefix?: RegExp;
};

export const COUNTRIES: Country[] = [
  { iso: "EG", dial: "+20",  flag: "🇪🇬", nameAr: "مصر",        minLen: 10, maxLen: 10, localPrefix: /^1[0125]/ },
  { iso: "SA", dial: "+966", flag: "🇸🇦", nameAr: "السعودية",  minLen: 9,  maxLen: 9,  localPrefix: /^5/ },
  { iso: "AE", dial: "+971", flag: "🇦🇪", nameAr: "الإمارات",  minLen: 9,  maxLen: 9,  localPrefix: /^5/ },
  { iso: "JO", dial: "+962", flag: "🇯🇴", nameAr: "الأردن",     minLen: 9,  maxLen: 9,  localPrefix: /^7/ },
  { iso: "PS", dial: "+970", flag: "🇵🇸", nameAr: "فلسطين",    minLen: 9,  maxLen: 9,  localPrefix: /^5/ },
  { iso: "SY", dial: "+963", flag: "🇸🇾", nameAr: "سوريا",      minLen: 9,  maxLen: 9,  localPrefix: /^9/ },
  { iso: "LB", dial: "+961", flag: "🇱🇧", nameAr: "لبنان",      minLen: 7,  maxLen: 8 },
  { iso: "IQ", dial: "+964", flag: "🇮🇶", nameAr: "العراق",     minLen: 10, maxLen: 10, localPrefix: /^7/ },
  { iso: "KW", dial: "+965", flag: "🇰🇼", nameAr: "الكويت",     minLen: 8,  maxLen: 8 },
  { iso: "QA", dial: "+974", flag: "🇶🇦", nameAr: "قطر",        minLen: 8,  maxLen: 8 },
  { iso: "BH", dial: "+973", flag: "🇧🇭", nameAr: "البحرين",   minLen: 8,  maxLen: 8 },
  { iso: "OM", dial: "+968", flag: "🇴🇲", nameAr: "عمان",       minLen: 8,  maxLen: 8 },
  { iso: "YE", dial: "+967", flag: "🇾🇪", nameAr: "اليمن",      minLen: 9,  maxLen: 9 },
  { iso: "SD", dial: "+249", flag: "🇸🇩", nameAr: "السودان",  minLen: 9,  maxLen: 9 },
  { iso: "LY", dial: "+218", flag: "🇱🇾", nameAr: "ليبيا",      minLen: 9,  maxLen: 10 },
  { iso: "TN", dial: "+216", flag: "🇹🇳", nameAr: "تونس",       minLen: 8,  maxLen: 8 },
  { iso: "DZ", dial: "+213", flag: "🇩🇿", nameAr: "الجزائر",   minLen: 9,  maxLen: 9 },
  { iso: "MA", dial: "+212", flag: "🇲🇦", nameAr: "المغرب",   minLen: 9,  maxLen: 9 },
  { iso: "TR", dial: "+90",  flag: "🇹🇷", nameAr: "تركيا",      minLen: 10, maxLen: 10 },
];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0]; // Egypt

export function findCountryByIso(iso: string): Country | undefined {
  return COUNTRIES.find((c) => c.iso === iso);
}

export function findCountryByDial(dial: string): Country | undefined {
  return COUNTRIES.find((c) => c.dial === dial);
}
