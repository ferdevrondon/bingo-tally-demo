"use client"

import { useActionState } from "react"
import { InfoIcon, TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signInWithGoogle, signInWithPassword } from "@/lib/supabase/actions";
import {titleFont} from '@/fonts';

export interface LoginNotice {
  tone: "info" | "error"
  message: string
}

export function LoginForm({
  className,
  notice,
  ...props
}: React.ComponentProps<"div"> & { notice?: LoginNotice }) {
  const [state, formAction, pending] = useActionState(signInWithPassword, {})

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {notice && (
        <Alert variant={notice.tone === "error" ? "destructive" : "default"}>
          {notice.tone === "error" ? <TriangleAlertIcon /> : <InfoIcon />}
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className={"text-xl " + titleFont.className}>Bienvenido de nuevo</CardTitle>
          <CardDescription>¡Comienza la jornada de hoy!</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <form action={signInWithGoogle}>
                <Button variant="outline" type="submit" className="w-full">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Entrar con Google
                </Button>
              </form>
            </Field>
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
              O continúa con tu correo
            </FieldSeparator>
            <form action={formAction}>
              <FieldGroup>
                <Field data-invalid={!!state.errors?.email}>
                  <FieldLabel htmlFor="email">Correo</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tu@correo.com"
                    required
                  />
                  <FieldError
                    errors={state.errors?.email?.map((message) => ({
                      message,
                    }))}
                  />
                </Field>
                <Field data-invalid={!!state.errors?.password}>
                  <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                  />
                  <FieldError
                    errors={state.errors?.password?.map((message) => ({
                      message,
                    }))}
                  />
                  <FieldDescription>
                    ¿Olvidaste tu contraseña? Pídele al administrador de tu casa que te ayude.
                  </FieldDescription>
                </Field>
                <Field>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Entrando…" : "Iniciar sesión"}
                  </Button>
                  <FieldError
                    errors={state.errors?.form?.map((message) => ({
                      message,
                    }))}
                  />
                </Field>
              </FieldGroup>
            </form>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}
