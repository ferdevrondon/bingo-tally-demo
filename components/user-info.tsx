"use client"

import * as React from "react"
import { MailIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import type { HouseRole } from "@/lib/data/house"
import { changePassword, updateDisplayName, type AccountError } from "@/lib/data/settings-actions"

export interface AccountInfo {
  name: string
  email: string
  /** False while the name is still the email (no full_name yet). */
  hasCustomName: boolean
}

const ACCOUNT_ERROR_MESSAGES: Record<AccountError, string> = {
  invalid: "Revisa los datos: la contraseña necesita al menos 8 caracteres y ambas deben coincidir.",
  reauthentication_needed: "Por seguridad, cierra sesión, vuelve a entrar y cambia la contraseña de inmediato.",
  same_password: "La nueva contraseña debe ser distinta a la actual.",
  weak_password: "Esa contraseña es muy débil. Usa una más larga o con más variedad.",
  failed: "No se pudo guardar. Inténtalo de nuevo.",
}

// Configuración → the signed-in account: email and role (read only), the
// display name (greeting and sidebar) and a password change. Each person
// edits only their own account.
const UserInfo = ({ account, role }: { account: AccountInfo; role: HouseRole | null }) => {
  const [name, setName] = React.useState(account.hasCustomName ? account.name : "")
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [isNamePending, startName] = React.useTransition()
  const [isPasswordPending, startPassword] = React.useTransition()

  function handleName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startName(async () => {
      const result = await updateDisplayName(name)
      if (result.ok) toast.success("Nombre guardado")
      else toast.error(ACCOUNT_ERROR_MESSAGES[result.error])
    })
  }

  function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startPassword(async () => {
      const result = await changePassword(password, confirm)
      if (result.ok) {
        toast.success("Contraseña actualizada")
        setPassword("")
        setConfirm("")
      } else {
        toast.error(ACCOUNT_ERROR_MESSAGES[result.error])
      }
    })
  }

  return (
    <div className="grid grid-cols-1 gap-10 px-2 py-6 lg:grid-cols-3">
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold">Tu cuenta</h3>
        <p className="text-sm text-muted-foreground">
          Tu nombre, tu correo y tu contraseña. Solo tú puedes cambiarlos.
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:col-span-2">
        <form onSubmit={handleName} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="account-name">Nombre para mostrar</FieldLabel>
              <Input
                id="account-name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Dairy"
                required
              />
              <FieldDescription>Se usa en el saludo de Inicio y en el menú.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="account-email">Correo</FieldLabel>
              <InputGroup>
                <InputGroupInput id="account-email" type="email" value={account.email} readOnly disabled />
                <InputGroupAddon align="inline-end" className="pr-2.75">
                  <MailIcon className="size-4" />
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription className="flex items-center gap-2">
                Rol en la casa:
                <Badge variant="secondary">
                  {role === "admin" ? "Administrador" : role === "observer" ? "Observador" : "Sin casa"}
                </Badge>
              </FieldDescription>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isNamePending || name.trim() === ""} className="max-sm:w-full">
              Guardar nombre
            </Button>
          </div>
        </form>

        <form onSubmit={handlePassword} className="flex flex-col gap-6">
          <h4 className="text-sm font-semibold">Cambiar contraseña</h4>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="account-password">Nueva contraseña</FieldLabel>
              <Input
                id="account-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <FieldDescription>Al menos 8 caracteres.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="account-password-confirm">Confirmar contraseña</FieldLabel>
              <Input
                id="account-password-confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="outline"
              disabled={isPasswordPending || password === "" || confirm === ""}
              className="max-sm:w-full"
            >
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UserInfo
