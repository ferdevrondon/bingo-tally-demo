import { Calendar, CirclePower } from "lucide-react"

import { WinningNumbersCard } from "./winning-numbers-card"
import React from "react"
import { Button } from "@/components/ui/button"
import { EndGameDialog } from "./end-game-dialog"

export default function PageHeadingWithActions() {
  const [isEndGameOpen, setIsEndGameOpen] = React.useState(false)
  return (
    <div className="container mx-auto px-4 py-4 md:px-6 2xl:max-w-[1400px]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
            Jornada #42
          </h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Monday, Sept 7</span>
            </div>
          </div>
        </div>

        {/* <Card className="card gap-2 bg-gradient-to-br from-primary/25 via-primary/5 to-background dark:from-primary/30 dark:via-background dark:to-background">
          <CardHeader>
            <CardDescription className="flex items-center gap-1 whitespace-nowrap">
              <span>Ronda Especial</span>
            </CardDescription>

            <CardTitle className="flex items-center justify-center gap-2 text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              <span>100$</span>
              <AwardIcon color="gold" />
            </CardTitle>
          </CardHeader>

          <CardFooter className="flex-col items-start pt-0 text-sm">
            <div className="text-muted-foreground">Numero ganador</div>
          </CardFooter>
        </Card> */}
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => setIsEndGameOpen(true)}
          >
            <CirclePower />
            Terminar jornada
          </Button>
          <EndGameDialog
            open={isEndGameOpen}
            onOpenChange={setIsEndGameOpen}
          />
        </div>
      </div>
    </div>
  )
}
