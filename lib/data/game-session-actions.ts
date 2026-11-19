"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import type { GameActionResult } from "@/lib/data/game-action-result"
import { getCurrentHouse } from "@/lib/data/house"
import { rejectGameAction } from "@/lib/data/reject-game-action"
import {
  gameSessionConfigSchema,
  toPatternJson,
  type GameSessionConfig,
} from "@/lib/round-pattern"
import { createClient } from "@/lib/supabase/server"

// "Iniciar jornada" from the home page. The live game's own actions go
// straight from the browser to the SQL functions (lib/round-draft/game-api.ts);
// this one is a Server Action because it redirects to /new-game.

// The active game session (created if none, with its first ticket), then
// /new-game. Manual by default; in automatic mode the pattern is stored and
// the first block's round is opened (start_game_session).
export async function startGameSession(
  requestId: string,
  config: GameSessionConfig = { mode: "manual" }
): Promise<GameActionResult> {
  const house = await getCurrentHouse()
  if (!house) return { ok: false, error: "read_only" }
  const parsedConfig = gameSessionConfigSchema.safeParse(config)
  if (!z.uuid().safeParse(requestId).success || !parsedConfig.success)
    return { ok: false, error: "invalid" }

  const supabase = await createClient()
  const { data: gameSessionId, error } = await supabase.rpc("start_game_session", {
    p_house_id: house.houseId,
    p_request_id: requestId,
    ...(parsedConfig.data.mode === "auto"
      ? { p_round_mode: "auto", p_pattern: toPatternJson(parsedConfig.data.pattern) }
      : {}),
  })
  if (error) return rejectGameAction(supabase, error)

  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("game_session_id", gameSessionId)
  if (count === 0) {
    const { error: ticketError } = await supabase.rpc("add_ticket", {
      p_game_session_id: gameSessionId,
      p_request_id: crypto.randomUUID(),
    })
    if (ticketError) return rejectGameAction(supabase, ticketError)
  }
  redirect("/new-game")
}
