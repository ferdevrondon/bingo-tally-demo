import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldContent,
  Input,
} from "next-appyy"

export function Default() {
  return (
    <FieldGroup className="w-72">
      <Field>
        <FieldLabel htmlFor="field-name">Nombre del jugador</FieldLabel>
        <Input id="field-name" placeholder="Juan Pérez" />
        <FieldDescription>Como aparecerá en la lista de jugadores.</FieldDescription>
      </Field>
    </FieldGroup>
  )
}

export function Invalid() {
  return (
    <FieldGroup className="w-72">
      <Field data-invalid="true">
        <FieldLabel htmlFor="field-invalid">Nombre del jugador</FieldLabel>
        <Input id="field-invalid" defaultValue="a" aria-invalid />
        <FieldError>El nombre debe tener al menos 2 caracteres.</FieldError>
      </Field>
    </FieldGroup>
  )
}

export function Horizontal() {
  return (
    <FieldGroup className="w-80">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="field-balance">Saldo positivo</FieldLabel>
          <FieldDescription>Monto a favor del jugador.</FieldDescription>
        </FieldContent>
        <Input id="field-balance" defaultValue="$40" className="w-28" />
      </Field>
    </FieldGroup>
  )
}
