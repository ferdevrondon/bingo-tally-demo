import type { PayoutType } from "@/lib/payout-types"

/** The contact of a cash move ("Registrar pago", "Recibir pago", a recharge)
 *  as the SQL functions take it: an empty value is not sent, so it never
 *  clears the player's contact (*_payout_contact.sql, *_collection_contact.sql). */
export function payoutContact(data: {
  contactEmail?: string
  contactPhone?: string
}): { p_contact_email?: string; p_contact_phone?: string } {
  return {
    ...(data.contactEmail ? { p_contact_email: data.contactEmail } : {}),
    ...(data.contactPhone ? { p_contact_phone: data.contactPhone } : {}),
  }
}

/** The payout type of a cash move as the SQL functions take it
 *  (*_payout_type.sql): not sent when absent. */
export function payoutTags(data: { payoutType?: PayoutType }): {
  p_payout_type?: PayoutType
} {
  return data.payoutType ? { p_payout_type: data.payoutType } : {}
}
