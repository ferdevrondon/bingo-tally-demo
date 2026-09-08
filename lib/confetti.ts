export async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default
  const duration = 2000
  const end = Date.now() + duration

  confetti({ particleCount: 120, spread: 100, origin: { y: 0.4 } })
  ;(function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } })
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}
