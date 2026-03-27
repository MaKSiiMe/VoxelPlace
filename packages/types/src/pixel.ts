export interface Pixel {
  x: number
  y: number
  colorId: number
  username: string
  source: Platform
  placedAt?: string
}

export interface PixelHistory extends Pixel {
  placedAt: string
}
