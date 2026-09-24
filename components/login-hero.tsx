import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const CARTON_NUMBERS = Array.from({ length: 15 }, (_, i) => i + 1)

const HIGHLIGHTS: Record<number, string> = {
  3: "bg-chart-1 text-primary-foreground",
  7: "bg-chart-4 text-primary-foreground",
}

const CALLED_NUMBER = 12

function TallyMarks({ count }: { count: number }) {
  const groups = Math.floor(count / 5)
  const remainder = count % 5

  return (
    <div className="flex items-end gap-2.5">
      {Array.from({ length: groups }).map((_, i) => (
        <svg key={`group-${i}`} width="24" height="22" viewBox="0 0 24 22" className="text-foreground">
          <line x1="2" y1="1" x2="2" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="8" y1="1" x2="8" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="14" y1="1" x2="14" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="1" x2="20" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-1" y1="21" x2="23" y2="1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ))}
      {remainder > 0 && (
        <svg
          width={remainder * 6 + 2}
          height="22"
          viewBox={`0 0 ${remainder * 6 + 2} 22`}
          className="text-foreground"
        >
          {Array.from({ length: remainder }).map((_, i) => (
            <line
              key={`single-${i}`}
              x1={2 + i * 6}
              y1="1"
              x2={2 + i * 6}
              y2="21"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}
    </div>
  )
}

export function LoginHero() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-14">
      <div className="relative h-[340px] w-full">
        <Card className="absolute top-4 left-0 w-[82%] -rotate-3 shadow-lg" size="sm">
          <CardHeader className="flex-row items-center justify-between gap-2 border-b pb-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Cartón 08 · David C
            </p>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Ronda 4
            </Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2 pt-3">
            {CARTON_NUMBERS.map((n) => {
              const highlight = HIGHLIGHTS[n]
              const isCalled = n === CALLED_NUMBER
              return (
                <div
                  key={n}
                  className={cn(
                    "flex aspect-square items-center justify-center text-sm font-semibold",
                    highlight
                      ? cn("rounded-full", highlight)
                      : isCalled
                        ? "rounded-full bg-ball text-ball-foreground ring-2 ring-foreground/70"
                        : "rounded-lg bg-muted/50 text-foreground"
                  )}
                >
                  {n}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="absolute top-0 right-2 z-20 flex size-16 items-center justify-center rounded-full bg-ball shadow-lg">
          <div className="flex size-11 items-center justify-center rounded-full bg-background">
            <span className="text-lg font-bold text-foreground">{CALLED_NUMBER}</span>
          </div>
        </div>

        <Card className="absolute right-0 bottom-0 z-10 w-[68%] gap-3 rotate-3 shadow-2xl" size="sm">
          <CardHeader className="gap-1 pb-0">
            <p className="text-xs font-bold tracking-wide text-primary uppercase">Ronda 4 · Cerrada</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* <TallyMarks count={9} /> */}
            <div className="flex flex-col gap-1.5 border-t border-dashed border-border pt-2 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Jugado</span>
                <span className="font-semibold text-foreground">$480</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Pagado</span>
                <span className="font-semibold text-foreground">$300</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-border pt-2">
              <span className="text-sm font-semibold">Casa</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">+$180</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-4xl font-bold text-balance text-foreground">
          Cierra el día sabiendo exactamente dónde está la casa.
        </h2>
        <p className="text-lg text-muted-foreground">
          Cartones, sorteos, premios y recargas — balanceado en tiempo real.
        </p>
      </div>
    </div>
  )
}
