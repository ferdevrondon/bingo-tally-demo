import Link from "next/link"

import { Button } from "@/components/ui/button"

// Any URL that matches no route (Phase 7), in Spanish with a way back. It
// renders under the root layout only, so it has no sidebar.
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <h2 className="text-lg font-semibold">No encontramos esta página</h2>
      <p className="text-sm text-muted-foreground">Puede que el enlace esté mal o que ya no exista.</p>
      <Button nativeButton={false} render={<Link href="/" />}>
        Ir al inicio
      </Button>
    </div>
  )
}
