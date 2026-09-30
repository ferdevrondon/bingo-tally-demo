// Result of a game session action (lib/round-draft/game-api.ts). The
// error is the code raised by the SQL function (the game session, game rules
// v2, player accounts and settlements migrations), or a generic one. Plain data so Client Components can import it.

export type GameActionError =
  | "read_only"
  | "session_replaced"
  | "invalid"
  | "failed"
  | "game_session_not_active"
  | "no_open_round"
  | "number_taken"
  | "number_not_owned"
  | "number_owner_changed"
  | "player_not_in_session"
  | "player_not_found"
  | "round_in_progress"
  | "round_not_open"
  | "round_template_not_found"
  | "slot_already_awarded"
  | "number_already_won"
  | "no_pending_carryover"
  | "pending_carryover"
  | "check_in_pending"
  | "payment_method_required"
  | "payment_method_retired"
  | "invalid_amount"
  | "payout_exceeds_balance"
  | "game_session_has_rounds"
  | "game_session_has_payments"
  | "no_credit_balance"
  | "no_debt_balance"
  | "invalid_status"
  | "note_required"
  | "settlement_closed"
  | "settlement_not_found"
  | "player_not_in_settlement"

export type GameActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: GameActionError }

export const GAME_ACTION_ERROR_MESSAGES: Record<GameActionError, string> = {
  read_only: "Solo lectura: no tienes permiso para hacer cambios.",
  session_replaced: "Tu sesión se cerró porque se inició sesión en otro dispositivo.",
  invalid: "Datos no válidos. Revisa e inténtalo de nuevo.",
  failed: "No se pudo guardar. Inténtalo de nuevo.",
  game_session_not_active: "La jornada ya no está activa.",
  no_open_round: "Primero elige la ronda.",
  number_taken: "Ese número ya fue asignado.",
  number_not_owned: "Ese número ya no es de este jugador.",
  number_owner_changed: "Ese número cambió de dueño. Revisa el cartón e inténtalo de nuevo.",
  player_not_in_session: "Ese jugador no está en la jornada.",
  player_not_found: "Ese jugador ya no existe en la lista de jugadores.",
  round_in_progress:
    "La ronda está en curso: termina de registrar sus números ganadores antes de continuar.",
  round_not_open: "Esa ronda ya no está abierta.",
  round_template_not_found: "Esa ronda ya no existe. Elige otra.",
  slot_already_awarded: "Ese número ganador ya fue registrado.",
  number_already_won: "Ese número ya salió en esta ronda.",
  no_pending_carryover: "Ese jugador ya decidió su jugada.",
  pending_carryover: "Primero decide si el jugador mantiene o libera su jugada.",
  check_in_pending: "Todos los jugadores con números deben hacer check-in antes de anotar ganadores.",
  payment_method_required: "Elige el método de pago.",
  payment_method_retired: "Ese método de pago ya no se usa. Elige otro.",
  invalid_amount: "El monto debe ser mayor a 0.",
  payout_exceeds_balance: "El pago no puede ser mayor al saldo a favor del jugador.",
  game_session_has_rounds: "La jornada ya tiene rondas; no se puede borrar.",
  game_session_has_payments: "La jornada ya tiene recargas o pagos registrados; no se puede borrar.",
  no_credit_balance: "El jugador no tiene saldo a favor.",
  no_debt_balance: "El jugador no tiene deuda.",
  invalid_status: "Elige un estado válido.",
  note_required: "Agrega una nota (por ejemplo, por qué no se pudo pagar).",
  settlement_closed: "Esta liquidación ya está cerrada.",
  settlement_not_found: "No se encontró la liquidación de esta jornada.",
  player_not_in_settlement: "Ese jugador no está en esta liquidación.",
}

const KNOWN_CODES = new Set<string>(Object.keys(GAME_ACTION_ERROR_MESSAGES))

export function toGameActionError(code: string | undefined): GameActionError {
  return code && KNOWN_CODES.has(code) ? (code as GameActionError) : "failed"
}
