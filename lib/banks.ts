// Values of the players.bank check constraint (Phase 6a2): the player's bank,
// optional, edited on /players. Labels are the only Spanish part. To add a
// bank, add it here and to the constraint in a new migration.

export const BANKS = [
  "chase",
  "bank_of_america",
  "td_bank",
  "wells_fargo",
  "chime",
  "other",
] as const

export type Bank = (typeof BANKS)[number]

export const BANK_LABELS: Record<Bank, string> = {
  chase: "Chase",
  bank_of_america: "Bank of America",
  td_bank: "TD Bank",
  wells_fargo: "Wells Fargo",
  chime: "Chime",
  other: "Otro",
}

export const BANK_OPTIONS = BANKS.map((value) => ({ value, label: BANK_LABELS[value] }))

export function isBank(value: unknown): value is Bank {
  return typeof value === "string" && (BANKS as readonly string[]).includes(value)
}

export function bankLabel(value: Bank | null): string {
  return value ? BANK_LABELS[value] : ""
}
