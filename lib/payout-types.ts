// Values of the public.payout_type enum (*_payout_type.sql): the house tags
// every cash move as ERNIE or DAIRY. Labels are the only user-facing part.

export const PAYOUT_TYPES = ["ernie", "dairy"] as const

export type PayoutType = (typeof PAYOUT_TYPES)[number]

/** Selected when a cash dialog opens. */
export const DEFAULT_PAYOUT_TYPE: PayoutType = "ernie"

export const PAYOUT_TYPE_LABELS: Record<PayoutType, string> = {
  ernie: "ERNIE",
  dairy: "DAIRY",
}

export const PAYOUT_TYPE_OPTIONS = PAYOUT_TYPES.map((value) => ({
  value,
  label: PAYOUT_TYPE_LABELS[value],
}))

export function isPayoutType(value: unknown): value is PayoutType {
  return typeof value === "string" && (PAYOUT_TYPES as readonly string[]).includes(value)
}

export function payoutTypeLabel(value: PayoutType | null): string {
  return value ? PAYOUT_TYPE_LABELS[value] : ""
}
