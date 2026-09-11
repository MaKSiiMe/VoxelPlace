// Durée écoulée lisible en français : « il y a 3 min », « il y a 2 j ».

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year',   365 * 24 * 3600],
  ['month',   30 * 24 * 3600],
  ['week',     7 * 24 * 3600],
  ['day',          24 * 3600],
  ['hour',              3600],
  ['minute',              60],
]

const formatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto', style: 'short' })

export function relativeTime(date: string | number | Date, now: number = Date.now()): string {
  const seconds = Math.round((new Date(date).getTime() - now) / 1000)
  if (!Number.isFinite(seconds)) return ''
  if (Math.abs(seconds) < 45) return "à l'instant"
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(Math.round(seconds / 60), 'minute')
}
