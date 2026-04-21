import { io } from 'socket.io-client'

import { API_URL } from '@shared/api'

export const socket = io(API_URL, {
  autoConnect: false,
  transports: ['websocket'],
})
