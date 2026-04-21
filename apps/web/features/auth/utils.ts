export function getRoleFromToken(token: string | null): string | null {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}
