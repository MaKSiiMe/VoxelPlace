import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_API_URL || window.location.origin

export const socket = io(BACKEND_URL, {
  autoConnect: false,
})
