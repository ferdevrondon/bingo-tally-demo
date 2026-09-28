import { formatMoney } from "@/lib/rounds"

/** The player's signed balance (business rule B) in words: "Debe $30",
 *  "A favor $50" or "Al día". */
export function balanceLabel(balance: number): string {
  if (balance < 0) return `Debe ${formatMoney(-balance)}`
  if (balance > 0) return `A favor ${formatMoney(balance)}`
  return "Al día"
}

/** "-$30", "+$50", "$0". */
export function signedMoney(value: number): string {
  if (value < 0) return `-${formatMoney(-value)}`
  if (value > 0) return `+${formatMoney(value)}`
  return formatMoney(0)
}
