"use client"

import * as React from "react"
import { ImageIcon, TrashIcon, UploadCloudIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useNow } from "@/hooks/use-now"
import { GAME_ACTION_ERROR_MESSAGES, type GameActionResult } from "@/lib/data/game-action-result"
import type { CurrentHouse } from "@/lib/data/house"
import { setHouseLogo, updateHouse } from "@/lib/data/settings-actions"
import {
  HOUSE_LOGOS_BUCKET,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  logoExtension,
  timezoneOptions,
} from "@/lib/house-settings"
import { createClient } from "@/lib/supabase/client"

function succeeded(result: GameActionResult, message: string): boolean {
  if (result.ok) {
    toast.success(message)
    return true
  }
  if (result.error !== "session_replaced") toast.error(GAME_ACTION_ERROR_MESSAGES[result.error])
  return false
}

/** "3:45 p. m." in that zone, to tell the options apart. */
function timeIn(now: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone }).format(now)
  } catch {
    return ""
  }
}

// Configuración → the current house: logo, name, ID, time zone and phone.
// The admin edits them (SQL functions update_house / set_house_logo); an
// observer sees the same fields read only.
const HouseInfo = ({ house }: { house: CurrentHouse }) => {
  const isAdmin = house.role === "admin"
  const [name, setName] = React.useState(house.houseName)
  const [identifier, setIdentifier] = React.useState(house.identifier)
  const [timezone, setTimezone] = React.useState(house.timezone)
  const [phone, setPhone] = React.useState(house.phone ?? "")
  const [requestId, setRequestId] = React.useState(() => crypto.randomUUID())
  const [isPending, startTransition] = React.useTransition()
  const [isLogoPending, startLogoTransition] = React.useTransition()
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  // The time next to each zone only on the client (null while hydrating).
  const now = useNow()
  const options = timezoneOptions(house.timezone).map((o) => ({
    ...o,
    label: now === null ? o.label : `${o.label} · ${timeIn(now, o.value)}`,
  }))
  const isDirty =
    name !== house.houseName ||
    identifier !== house.identifier ||
    timezone !== house.timezone ||
    phone !== (house.phone ?? "")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const saved = succeeded(
        await updateHouse({ name, identifier, timezone, phone }, requestId),
        "Datos de la casa guardados"
      )
      // A new request id for the next save; the same one while retrying a failure.
      if (saved) setRequestId(crypto.randomUUID())
    })
  }

  // The file goes to house-logos/{houseId}/ (only the admin can write there),
  // then the house points to it; the previous file is removed afterwards.
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Elige una imagen PNG, JPG, WEBP o SVG.")
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("La imagen debe pesar menos de 1 MB.")
      return
    }
    startLogoTransition(async () => {
      const supabase = createClient()
      const path = `${house.houseId}/logo-${crypto.randomUUID()}.${logoExtension(file.type)}`
      const { error } = await supabase.storage
        .from(HOUSE_LOGOS_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: "3600" })
      if (error) {
        toast.error("No se pudo subir el logo. Inténtalo de nuevo.")
        return
      }
      if (succeeded(await setHouseLogo(path, crypto.randomUUID()), "Logo actualizado")) {
        if (house.logoPath) await supabase.storage.from(HOUSE_LOGOS_BUCKET).remove([house.logoPath])
      } else {
        await supabase.storage.from(HOUSE_LOGOS_BUCKET).remove([path])
      }
    })
  }

  function handleRemoveLogo() {
    if (!house.logoPath) return
    const previous = house.logoPath
    startLogoTransition(async () => {
      if (succeeded(await setHouseLogo(null, crypto.randomUUID()), "Logo quitado")) {
        await createClient().storage.from(HOUSE_LOGOS_BUCKET).remove([previous])
      }
    })
  }

  return (
    <div className="grid grid-cols-1 gap-10 px-2 py-6 lg:grid-cols-3">
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold">Información de la casa</h3>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "El nombre, el logo y la zona horaria se ven en toda la app y en los reportes."
            : "Solo el administrador de la casa puede cambiar estos datos."}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-2">
        <Field>
          <FieldLabel>Logo</FieldLabel>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed bg-muted/40">
              {house.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- public Storage URL, any size
                <img src={house.logoUrl} alt={`Logo de ${house.houseName}`} className="size-full object-cover" />
              ) : (
                <ImageIcon className="text-muted-foreground" />
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept={LOGO_TYPES.join(",")}
                  className="hidden"
                  onChange={handleFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLogoPending}
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadCloudIcon />
                  {house.logoUrl ? "Cambiar logo" : "Subir logo"}
                </Button>
                {house.logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isLogoPending}
                    onClick={handleRemoveLogo}
                    className="text-destructive!"
                    aria-label="Quitar logo"
                  >
                    <TrashIcon />
                  </Button>
                )}
              </div>
            )}
          </div>
          <FieldDescription>
            Se muestra en Inicio y junto a tu nombre en el menú lateral.
            {isAdmin && " PNG, JPG, WEBP o SVG de hasta 1 MB."}
          </FieldDescription>
        </Field>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="house-name">Nombre de la casa</FieldLabel>
              <Input
                id="house-name"
                value={name}
                maxLength={60}
                disabled={!isAdmin}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="house-identifier">ID de la casa</FieldLabel>
              <Input
                id="house-identifier"
                value={identifier}
                maxLength={30}
                disabled={!isAdmin}
                onChange={(e) => setIdentifier(e.target.value.toUpperCase().replace(/\s+/g, "-"))}
                className="uppercase"
                required
              />
              <FieldDescription>Letras, números y guiones. Debe ser único.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="house-timezone">Zona horaria</FieldLabel>
              <Select
                value={timezone}
                onValueChange={(value) => value && setTimezone(value)}
                disabled={!isAdmin}
                items={options}
              >
                <SelectTrigger id="house-timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>La hora de Inicio y las fechas de los reportes.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="house-phone">Teléfono</FieldLabel>
              <Input
                id="house-phone"
                type="tel"
                value={phone}
                maxLength={30}
                disabled={!isAdmin}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </Field>
          </div>
          {isAdmin && (
            <div className="flex justify-end">
              <Button type="submit" disabled={!isDirty || isPending} className="max-sm:w-full">
                Guardar cambios
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default HouseInfo
