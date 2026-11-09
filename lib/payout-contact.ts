/** The contact of a payout ("Registrar pago") as the SQL functions take it:
 *  an empty value is not sent, so it never clears the player's contact
 *  (*_payout_contact.sql). */
export function payoutContact(data: {
  contactEmail?: string
  contactPhone?: string
}): { p_contact_email?: string; p_contact_phone?: string } {
  return {
    ...(data.contactEmail ? { p_contact_email: data.contactEmail } : {}),
    ...(data.contactPhone ? { p_contact_phone: data.contactPhone } : {}),
  }
}
