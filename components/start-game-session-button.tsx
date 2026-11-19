import Link from "next/link"
import { ArrowRightIcon, PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// "Iniciar jornada": opens the steps of /start-game (Tipo de jornada →
// Patrón de rondas → Cartones y jugadores), which also warn about what is
// still pending from earlier game sessions. With a game session already
// active, /start-game goes on to /new-game.
export function StartGameSessionButton({ className }: { className?: string }) {
  return (
    <Button
      size="lg"
      className={cn("w-fit gap-2", className)}
      nativeButton={false}
      render={<Link href="/start-game" />}
    >
      <PlayIcon className="size-5" />
      Iniciar jornada
      <ArrowRightIcon className="size-4" />
    </Button>
  )
}
