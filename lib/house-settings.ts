import { z } from "zod"

// Configuración: what the admin edits about their house and their own
// account. Shared by the forms and the Server Actions
// (lib/data/settings-actions.ts); the SQL function update_house checks the
// same rules.

/** The time zones offered: the usual ones for houses in the US and Mexico. */
export const TIMEZONE_OPTIONS = [
  { value: "America/Chicago", label: "Centro de EE. UU. (Texas, Chicago)" },
  { value: "America/New_York", label: "Este de EE. UU. (Nueva York, Florida)" },
  { value: "America/Denver", label: "Montaña de EE. UU. (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacífico de EE. UU. (Los Ángeles)" },
  { value: "America/Mexico_City", label: "Centro de México (Ciudad de México)" },
  { value: "America/Monterrey", label: "Noreste de México (Monterrey)" },
  { value: "America/Tijuana", label: "Noroeste de México (Tijuana)" },
] as const

/** The house's own zone is always offered, even when it isn't in the list. */
export function timezoneOptions(current: string) {
  return TIMEZONE_OPTIONS.some((o) => o.value === current)
    ? [...TIMEZONE_OPTIONS]
    : [{ value: current, label: current }, ...TIMEZONE_OPTIONS]
}

export const houseInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  identifier: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,30}$/),
  timezone: z.string().min(1).max(64),
  phone: z.string().trim().max(30),
})

export type HouseInput = z.input<typeof houseInputSchema>

export const displayNameSchema = z.string().trim().min(1).max(60)

export const passwordSchema = z
  .object({ password: z.string().min(8).max(72), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] })

/** Storage bucket of the house logos (public read, only the admin writes). */
export const HOUSE_LOGOS_BUCKET = "house-logos"

/** Logo files: images up to 1 MB (the house-logos bucket enforces it too). */
export const LOGO_MAX_BYTES = 1024 * 1024
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const

export function logoExtension(type: string): string {
  return type === "image/svg+xml" ? "svg" : type === "image/jpeg" ? "jpg" : type.split("/")[1]
}
