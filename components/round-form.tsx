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
import { MAX_PRIZES, type RoundInput } from "@/lib/rounds"

// Estado del formulario: los premios se editan como texto y se convierten a
// números al enviar. El tipo de dominio es `Round` (lib/rounds.ts).
interface RoundFormState {
  name: string
  linePrice: number
  prizes: string[]
}

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function toFormState(round: RoundInput): RoundFormState {
  return {
    name: round.name,
    linePrice: round.linePrice,
    prizes: round.prizes.length > 0 ? round.prizes.map(String) : [""],
  }
}

const prizeCountOptions = Array.from({ length: MAX_PRIZES }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} premio${i === 0 ? "" : "s"} (${i + 1} número${i === 0 ? "" : "s"} ganador${i === 0 ? "" : "es"})`,
}))

const prizeOrdinals = ["Primer", "Segundo", "Tercer", "Cuarto", "Quinto"]

function prizeLabel(index: number) {
  return `${prizeOrdinals[index] ?? `#${index + 1}`} premio`
}

const emptyRound: RoundInput = {
  name: "",
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

  function updatePrizeCount(value: string | null) {
    const count = Math.min(Math.max(Number(value) || 1, 1), MAX_PRIZES)
    setRound((prev) => ({
      ...prev,
      prizes: Array.from({ length: count }, (_, i) => prev.prizes[i] ?? ""),
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
          <Field className="col-span-2">
            <FieldLabel htmlFor="round-prize-count">Número de premios</FieldLabel>
            <Select
              value={String(round.prizes.length)}
              onValueChange={updatePrizeCount}
              items={prizeCountOptions}
            >
              <SelectTrigger id="round-prize-count" className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {prizeCountOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              Cada número ganador paga su premio por cada cartón que lo tenga.
            </FieldDescription>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {round.prizes.map((prize, index) => (
            <Field key={index}>
              <FieldLabel htmlFor={`round-prize-${index}`}>{prizeLabel(index)}</FieldLabel>
              <Input
                id={`round-prize-${index}`}
                type="number"
                inputMode="decimal"
                min={0.01}
                step={0.01}
                value={prize}
                onChange={(e) => updatePrize(index, e.target.value)}
                placeholder="100"
                required
              />
              <FieldDescription>Por cartón con el número ganador.</FieldDescription>
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
