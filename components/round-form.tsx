"use client"

import * as React from "react"

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
import { winnerCountForKind, type RoundKind } from "@/lib/round-draft/prize-rules"
import type { RoundInput } from "@/lib/rounds"

// Estado del formulario: los premios se editan como texto ("100$") y se
// convierten a números al enviar. El tipo de dominio es `Round` (lib/rounds.ts).
interface RoundFormState {
  name: string
  kind: RoundKind
  linePrice: number
  prizes: string[]
}

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function toFormState(round: RoundInput): RoundFormState {
  const winnerCount = winnerCountForKind(round.kind)
  return {
    name: round.name,
    kind: round.kind,
    linePrice: round.linePrice,
    prizes: Array.from({ length: winnerCount }, (_, i) =>
      round.prizes[i] !== undefined ? String(round.prizes[i]) : ""
    ),
  }
}

const kindOptions: { value: RoundKind; label: string }[] = [
  { value: "regular", label: "Regular (1 número ganador)" },
  { value: "special", label: "Especial (2 números ganadores)" },
]

const prizeOrdinals = [
  "Primer",
  "Segundo",
  "Tercer",
  "Cuarto",
  "Quinto",
  "Sexto",
  "Séptimo",
  "Octavo",
  "Noveno",
  "Décimo",
]

function prizeLabel(index: number) {
  return `${prizeOrdinals[index] ?? `#${index + 1}`} premio (#${index + 1})`
}

const emptyRound: RoundInput = {
  name: "",
  kind: "regular",
  linePrice: 10,
  prizes: [],
}

export interface RoundFormProps {
  /** callback con los datos de la ronda al enviar; si devuelve una promesa, el botón queda en espera */
  onSubmit: (round: RoundInput) => void | Promise<void>
  /** callback opcional, ej. para cerrar el drawer/dialog que contiene el formulario */
  onCancel?: () => void
  /** valores iniciales, ej. al editar una ronda existente */
  initialValues?: RoundInput
  /** texto del botón de enviar. Default: "Agregar ronda" */
  submitLabel?: string
  className?: string
  /**
   * "card" (default) envuelve el formulario en un Card con su propio título,
   * útil como componente independiente. "plain" solo renderiza los campos,
   * útil cuando el formulario ya va dentro de un Dialog/Drawer con su propio header.
   */
  variant?: "card" | "plain"
}

export function RoundForm({
  onSubmit,
  onCancel,
  initialValues = emptyRound,
  submitLabel = "Agregar ronda",
  className,
  variant = "card",
}: RoundFormProps) {
  const [round, setRound] = React.useState<RoundFormState>(() => toFormState(initialValues))
  const [isPending, startTransition] = React.useTransition()
  const winnerCount = winnerCountForKind(round.kind)

  function updateKind(value: string | null) {
    const kind: RoundKind = value === "special" ? "special" : "regular"
    setRound((prev) => ({
      ...prev,
      kind,
      prizes: Array.from({ length: winnerCountForKind(kind) }, (_, i) => prev.prizes[i] ?? ""),
    }))
  }

  function updatePrize(index: number, value: string) {
    setRound((prev) => ({
      ...prev,
      prizes: prev.prizes.map((prize, i) => (i === index ? value : prize)),
    }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      await onSubmit({
        name: round.name,
        kind: round.kind,
        linePrice: round.linePrice,
        prizes: round.prizes.map(parseMoney),
      })
    })
  }

  const form = (
    <form onSubmit={handleSubmit} className={cn(variant === "plain" && className)}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="round-name">Nombre</FieldLabel>
            <Input
              id="round-name"
              value={round.name}
              onChange={(e) => setRound((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ronda 1"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="line-price">Precio de línea</FieldLabel>
            <Input
              id="line-price"
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              value={Number.isNaN(round.linePrice) ? "" : round.linePrice}
              onChange={(e) =>
                setRound((prev) => ({ ...prev, linePrice: e.target.valueAsNumber }))
              }
              placeholder="10"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="round-kind">Tipo</FieldLabel>
            <Select value={round.kind} onValueChange={updateKind} items={kindOptions}>
              <SelectTrigger id="round-kind" className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {kindOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {winnerCount} número{winnerCount > 1 ? "s" : ""} ganador
              {winnerCount > 1 ? "es" : ""} — determinado por el tipo de ronda.
            </FieldDescription>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {round.prizes.map((prize, index) => (
            <Field key={index}>
              <FieldLabel htmlFor={`round-prize-${index}`}>{prizeLabel(index)}</FieldLabel>
              <Input
                id={`round-prize-${index}`}
                value={prize}
                onChange={(e) => updatePrize(index, e.target.value)}
                placeholder="Premio, ej. 100$"
                required
              />
              <FieldDescription>
                Solo referencia — el premio real se calcula automáticamente.
              </FieldDescription>
            </Field>
          ))}
        </div>
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
        <CardTitle>Nueva ronda</CardTitle>
        <CardDescription>Completa los datos para agregar una ronda.</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  )
}
