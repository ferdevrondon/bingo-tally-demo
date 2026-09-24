import { toast } from "sonner"

import { WRITE_ERROR_MESSAGES, type WriteResult } from "@/lib/data/write-result"

// Client side of a catalog write: shows the Spanish error toast and narrows
// the result, e.g. `if (writeSucceeded(await createPlayer(input))) …`.
export function writeSucceeded<T>(
  result: WriteResult<T>
): result is { ok: true; data: T } {
  if (!result.ok) toast.error(WRITE_ERROR_MESSAGES[result.error])
  return result.ok
}
