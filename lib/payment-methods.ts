// Values of the payment_method check constraints on players and activity_log
// (payment methods v2, Phase 6a2). Labels are the only Spanish part.

/** What can be chosen: on every recharge, collection and payout, and as a
 *  player's default. */
export const PAYMENT_METHODS = [
  "cash",
  "zelle",
  "venmo",
  "majority",
  "paypal",
  "square",
  "other",
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Retired in Phase 6a2: ledger rows written before keep them (the ledger is
 *  immutable), but the database rejects them on new rows. */
export const LEGACY_PAYMENT_METHODS = ["transfer", "credit_card", "debit_card"] as const

export type LegacyPaymentMethod = (typeof LEGACY_PAYMENT_METHODS)[number]

/** A method as stored on a ledger row: a current one or a retired one. */
export type RecordedPaymentMethod = PaymentMethod | LegacyPaymentMethod

export const PAYMENT_METHOD_LABELS: Record<RecordedPaymentMethod, string> = {
  cash: "Efectivo",
  zelle: "Zelle",
  venmo: "Venmo",
  majority: "Majority",
  paypal: "PayPal",
  square: "Square",
  other: "Otro",
  transfer: "Transferencia",
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
}

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}))

/** A method that can be chosen today. */
export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value)
}

/** Any method a ledger row may carry, retired ones included. */
export function isRecordedPaymentMethod(value: unknown): value is RecordedPaymentMethod {
  return (
    isPaymentMethod(value) ||
    (typeof value === "string" && (LEGACY_PAYMENT_METHODS as readonly string[]).includes(value))
  )
}

export function paymentMethodLabel(value: RecordedPaymentMethod | null): string {
  return value ? PAYMENT_METHOD_LABELS[value] : ""
}
