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

// ------------------------------------------------------------------
// Estructura de una ronda. "winnerCount" define cuántos números
// ganadores tendrá la ronda, y "prizes" guarda el premio configurado
// para cada uno de esos números (prizes[0] es el premio del número
// ganador 1, prizes[1] el del número ganador 2, etc).
// ------------------------------------------------------------------
export interface Round {
  id: number
  name: string
  winnerCount: number
  prizes: string[]
}

export type NewRound = Omit<Round, "id">

const MAX_WINNER_COUNT = 10
const winnerCountOptions = Array.from({ length: MAX_WINNER_COUNT }, (_, i) => String(i + 1))

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

const emptyRound: NewRound = {
  name: "",
  winnerCount: 1,
  prizes: [""],
}

export interface RoundFormProps {
  /** callback ejecutado con los datos de la nueva ronda al enviar el formulario */
  onSubmit: (round: NewRound) => void
  /** callback opcional, ej. para cerrar el drawer/dialog que contiene el formulario */
  onCancel?: () => void
  className?: string
  /**
   * "card" (default) envuelve el formulario en un Card con su propio título,
   * útil como componente independiente. "plain" solo renderiza los campos,
   * útil cuando el formulario ya va dentro de un Dialog/Drawer con su propio header.
   */
  variant?: "card" | "plain"
}

export function RoundForm({ onSubmit, onCancel, className, variant = "card" }: RoundFormProps) {
  const [round, setRound] = React.useState<NewRound>(emptyRound)

  function updateWinnerCount(value: string | null) {
    const winnerCount = Number(value ?? 1)
    setRound((prev) => ({
      ...prev,
      winnerCount,
      prizes: Array.from({ length: winnerCount }, (_, i) => prev.prizes[i] ?? ""),
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
    onSubmit(round)
    setRound(emptyRound)
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
            <FieldLabel htmlFor="round-winner-count">Números ganadores</FieldLabel>
            <Select value={String(round.winnerCount)} onValueChange={updateWinnerCount}>
              <SelectTrigger id="round-winner-count" className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {winnerCountOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
            </Field>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="submit">Agregar ronda</Button>
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
