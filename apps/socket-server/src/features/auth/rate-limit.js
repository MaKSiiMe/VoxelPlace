const attempts = new Map()

export function checkRateLimit(ip, max = 10, windowMs = 60_000) {
  const now   = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

export function _resetAttempts() {
  attempts.clear()
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(ip)
  }
}, 300_000).unref()
