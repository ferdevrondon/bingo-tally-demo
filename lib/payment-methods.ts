// Values of the payment_method check constraint on players and activity_log
// (see the init migration). Labels are the only Spanish part.
export const PAYMENT_METHODS = [
  "cash",
  "transfer",
  "paypal",
  "credit_card",
  "debit_card",
  "other",
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  paypal: "Paypal",
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  other: "Otro",
}

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}))

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  )
}

export function paymentMethodLabel(value: PaymentMethod | null): string {
  return value ? PAYMENT_METHOD_LABELS[value] : ""
}
