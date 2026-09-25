"use client"

import { LoadError } from "@/components/load-error"

// Renders inside the (app) layout, so the sidebar and header stay. Catches the
// signed-in pages and the nested (game) layout; errors thrown by the (app)
// layout itself reach app/error.tsx instead.
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <LoadError error={error} onRetry={unstable_retry} />
}
