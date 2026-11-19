"use client"

import { LoadError } from "@/components/load-error"

// Last-resort boundary for errors thrown by the (app) layout (house and admin
// session queries), which app/(app)/error.tsx can't catch. No sidebar here.
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <LoadError error={error} onRetry={unstable_retry} />
    </div>
  )
}
