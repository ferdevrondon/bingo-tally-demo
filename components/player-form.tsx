"use client"

import * as React from "react"
import { Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { BANK_OPTIONS, isBank } from "@/lib/banks"
import { isPaymentMethod, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-methods"
import type { PlayerInput } from "@/lib/players"

// Select value for "no bank" (the bank is optional).
const NO_BANK = "none"

const emptyPlayer: PlayerInput = {
  name: "",
  username: "",
  paymentMethod: null,
  bank: null,
  isVip: false,
}

export interface PlayerFormProps {
  /** callback con los datos del jugador al enviar; si devuelve una promesa, el botón queda en espera */
  onSubmit: (player: PlayerInput) => void | Promise<void>
  /** callback opcional, ej. para cerrar el drawer/dialog que contiene el formulario */
  onCancel?: () => void
  /** valores iniciales, ej. al editar un jugador existente */
  initialValues?: PlayerInput
  /** texto del botón de enviar. Default: "Agregar jugador" */
  submitLabel?: string
  className?: string
  /**
   * "card" (default) envuelve el formulario en un Card con su propio título,
   * útil como componente independiente. "plain" solo renderiza los campos,
   * útil cuando el formulario ya va dentro de un Dialog/Drawer con su propio header.
   */
  variant?: "card" | "plain"
}

// Los saldos no se capturan aquí: son por jornada (BACKEND_PLAN.md regla 7).
export function PlayerForm({
  onSubmit,
  onCancel,
  initialValues = emptyPlayer,
  submitLabel = "Agregar jugador",
  className,
  variant = "card",
}: PlayerFormProps) {
  const [player, setPlayer] = React.useState<PlayerInput>(initialValues)
  const [isPending, startTransition] = React.useTransition()

  function updateField<K extends keyof PlayerInput>(key: K, value: PlayerInput[K]) {
    setPlayer((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      await onSubmit(player)
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className={cn(variant === "plain" && className)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="player-name">Nombre</FieldLabel>
          <Input
            id="player-name"
            value={player.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Juan Pérez"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="player-username">Usuario</FieldLabel>
          <Input
            id="player-username"
            value={player.username}
            onChange={(e) => updateField("username", e.target.value)}
            placeholder="@juanperez"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="player-payment-method">Método de pago</FieldLabel>
          <Select
            value={player.paymentMethod ?? ""}
            onValueChange={(value) =>
              updateField("paymentMethod", isPaymentMethod(value) ? value : null)
            }
            items={PAYMENT_METHOD_OPTIONS}
          >
            <SelectTrigger id="player-payment-method" className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="player-bank">Entidad bancaria</FieldLabel>
          <Select
            value={player.bank ?? NO_BANK}
            onValueChange={(value) => updateField("bank", isBank(value) ? value : null)}
            items={[{ value: NO_BANK, label: "Sin banco" }, ...BANK_OPTIONS]}
          >
            <SelectTrigger id="player-bank" className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_BANK}>Sin banco</SelectItem>
                {BANK_OPTIONS.map((bank) => (
                  <SelectItem key={bank.value} value={bank.value}>
                    {bank.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Jugador VIP</FieldLabel>
          <Toggle
            pressed={player.isVip}
            onPressedChange={(pressed) => updateField("isVip", pressed)}
            variant="outline"
            aria-label="Marcar como jugador VIP"
            className="w-fit data-[pressed]:border-amber-500/40 data-[pressed]:bg-amber-50 data-[pressed]:text-amber-600 dark:data-[pressed]:bg-amber-950 dark:data-[pressed]:text-amber-400"
          >
            <Star className={cn("size-4", player.isVip && "fill-current")} />
            VIP
          </Toggle>
          <FieldDescription>Los jugadores VIP se destacan en el listado.</FieldDescription>
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </FieldGroup>
    </form>
  )

  if (variant === "plain") {
    return form
  }

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader>
        <CardTitle>Nuevo jugador</CardTitle>
        <CardDescription>Completa los datos para agregar un jugador.</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  )
}
