import { io } from 'socket.io-client'

import { API_URL } from '@shared/api'

const TOKEN_KEY = 'voxelplace:token'

export const socket = io(API_URL, {
  autoConnect: false,
  transports:  ['websocket'],
  auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) ?? '' }),
})
