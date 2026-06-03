export type ChargeCategory =
  | "DUI"
  | "Drug"
  | "Theft"
  | "Battery"
  | "Weapon"
  | "Fraud"
  | "Other";

const PATTERNS: [ChargeCategory, RegExp][] = [
  ["DUI",     /\b(dui|dwi|driving under|impaired driving|bac|breath test)\b/i],
  ["Drug",    /\b(cocaine|marijuana|cannabis|heroin|methamphetamine|meth|narcotic|controlled substance|drug|fentanyl|possession of a controlled)\b/i],
  ["Theft",   /\b(theft|larceny|burglary|robbery|shoplifting|stolen|grand theft|petit theft|carjacking)\b/i],
  ["Battery", /\b(battery|assault|domestic violence|aggravated assault|strangulation)\b/i],
  ["Weapon",  /\b(firearm|weapon|gun|armed|ccw|concealed weapon|carrying a)\b/i],
  ["Fraud",   /\b(fraud|forgery|identity theft|counterfeit|scheme|uttering|deception|false)\b/i],
];

export function getChargeCategory(charges: string[]): ChargeCategory {
  const combined = charges.join(" ");
  for (const [cat, pattern] of PATTERNS) {
    if (pattern.test(combined)) return cat;
  }
  return "Other";
}

export const CATEGORY_COLORS: Record<ChargeCategory, string> = {
  DUI:     "bg-orange-100 text-orange-800 border-orange-200",
  Drug:    "bg-purple-100 text-purple-800 border-purple-200",
  Theft:   "bg-blue-100 text-blue-800 border-blue-200",
  Battery: "bg-red-100 text-red-800 border-red-200",
  Weapon:  "bg-red-200 text-red-900 border-red-300",
  Fraud:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  Other:   "bg-gray-100 text-gray-700 border-gray-200",
};
