/** Concatène des classes en ignorant les valeurs vides. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
