"use client"

import * as React from "react"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

// Fallback UI shared by the error.tsx boundaries. `onRetry` is the boundary's
// `unstable_retry` (Next 16), which re-fetches and re-renders the segment.
export function LoadError({
  error,
  onRetry,
}: {
  error: Error & { digest?: string }
  onRetry: () => void
}) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-md">
        <TriangleAlertIcon />
        <AlertTitle>No se pudieron cargar los datos</AlertTitle>
        <AlertDescription>
          <p>Revisa tu conexión e inténtalo de nuevo.</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" />
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
