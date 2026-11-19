// Values of the players.bank check constraint (Phase 6a2, more banks in
// *_player_nickname_uppercase_banks.sql): the player's bank,
// optional, edited on /players. Labels are the only Spanish part. To add a
// bank, add it here and to the constraint in a new migration.

export const BANKS = [
  "chase",
  "bank_of_america",
  "td_bank",
  "wells_fargo",
  "chime",
  "capital_one",
  "first_one_bank",
  "ufcu_bank",
  "regional_bank",
  "southwest_bank",
  "southstate_bank",
  "frost_bank",
  "mid_bank",
  "pnc_business",
  "pnc_personal",
  "other",
] as const

export type Bank = (typeof BANKS)[number]

export const BANK_LABELS: Record<Bank, string> = {
  chase: "Chase",
  bank_of_america: "Bank of America",
  td_bank: "TD Bank",
  wells_fargo: "Wells Fargo",
  chime: "Chime",
  capital_one: "Capital One",
  first_one_bank: "First One Bank",
  ufcu_bank: "UFCU Bank",
  regional_bank: "Regional Bank",
  southwest_bank: "Southwest Bank",
  southstate_bank: "SouthState Bank",
  frost_bank: "Frost Bank",
  mid_bank: "Mid Bank",
  pnc_business: "PNC Negocio",
  pnc_personal: "PNC Personal",
  other: "Otro",
}

/** For selects: by label, with "Otro" last. */
export const BANK_OPTIONS: { value: Bank; label: string }[] = [
  ...BANKS.filter((value) => value !== "other")
    .map((value) => ({ value, label: BANK_LABELS[value] }))
    .sort((a, b) => a.label.localeCompare(b.label, "es")),
  { value: "other", label: BANK_LABELS.other },
]

/** Select value for "no bank": the bank is optional. */
export const NO_BANK = "none"

/** The bank options plus "Sin banco", for selects that can clear it. */
export const BANK_OPTIONS_WITH_NONE = [{ value: NO_BANK, label: "Sin banco" }, ...BANK_OPTIONS]

export function isBank(value: unknown): value is Bank {
  return typeof value === "string" && (BANKS as readonly string[]).includes(value)
}

export function bankLabel(value: Bank | null): string {
  return value ? BANK_LABELS[value] : ""
}
