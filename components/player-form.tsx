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

// ------------------------------------------------------------------
// Estructura de un jugador. Usa nombres de propiedad en inglés,
// equivalentes a las claves en español del dataset original:
// Nombre -> name, usuario -> username, metodo de pago -> paymentMethod,
// saldo positivo -> positiveBalance, saldo negativo -> negativeBalance.
// ------------------------------------------------------------------
export interface Player {
  id: number
  name: string
  username: string
  paymentMethod: string
  positiveBalance: string
  negativeBalance: string
  isVip: boolean
}

export type NewPlayer = Omit<Player, "id">

export interface PaymentMethodOption {
  label: string
  value: string
}

const defaultPaymentMethods: PaymentMethodOption[] = [
  { label: "Paypal", value: "Paypal" },
  { label: "Tarjeta de crédito", value: "Tarjeta de crédito" },
  { label: "Transferencia", value: "Transferencia" },
  { label: "Efectivo", value: "Efectivo" },
]

const emptyPlayer: NewPlayer = {
  name: "",
  username: "",
  paymentMethod: "",
  positiveBalance: "0",
  negativeBalance: "0",
  isVip: false,
}

export interface PlayerFormProps {
  /** callback ejecutado con los datos del nuevo jugador al enviar el formulario */
  onSubmit: (player: NewPlayer) => void
  /** callback opcional, ej. para cerrar el drawer/dialog que contiene el formulario */
  onCancel?: () => void
  /** opciones a mostrar en el select de método de pago */
  paymentMethods?: PaymentMethodOption[]
  className?: string
  /**
   * "card" (default) envuelve el formulario en un Card con su propio título,
   * útil como componente independiente. "plain" solo renderiza los campos,
   * útil cuando el formulario ya va dentro de un Dialog/Drawer con su propio header.
   */
  variant?: "card" | "plain"
}

export function PlayerForm({
  onSubmit,
  onCancel,
  paymentMethods = defaultPaymentMethods,
  className,
  variant = "card",
}: PlayerFormProps) {
  const [player, setPlayer] = React.useState<NewPlayer>(emptyPlayer)

  function updateField<K extends keyof NewPlayer>(key: K, value: NewPlayer[K]) {
    setPlayer((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSubmit(player)
    setPlayer(emptyPlayer)
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
            value={player.paymentMethod}
            onValueChange={(value) => updateField("paymentMethod", value ?? "")}
            items={paymentMethods}
          >
            <SelectTrigger id="player-payment-method" className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="player-positive-balance">Saldo positivo</FieldLabel>
            <Input
              id="player-positive-balance"
              value={player.positiveBalance}
              onChange={(e) => updateField("positiveBalance", e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="player-negative-balance">Saldo negativo</FieldLabel>
            <Input
              id="player-negative-balance"
              value={player.negativeBalance}
              onChange={(e) => updateField("negativeBalance", e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
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
          <Button type="submit">Agregar jugador</Button>
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
