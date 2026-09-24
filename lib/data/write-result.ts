// Result of a catalog write (lib/data/*-actions.ts). Plain data so Client
// Components can import it without pulling in server code.
export type WriteError = "invalid" | "read_only" | "not_found" | "failed"

export type WriteResult<T> =
  { ok: true; data: T } | { ok: false; error: WriteError }

export const WRITE_ERROR_MESSAGES: Record<WriteError, string> = {
  invalid: "Revisa los datos del formulario.",
  read_only: "Solo lectura: no tienes permiso para hacer cambios.",
  not_found: "El registro ya no existe. Recarga la página.",
  failed: "No se pudo guardar. Inténtalo de nuevo.",
}
