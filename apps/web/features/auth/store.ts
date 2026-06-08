'use client'

import { create } from 'zustand'
import { type UserRole } from '@features/canvas/store'
import { getRoleFromToken, isTokenExpired } from './utils'
import type { AuthResponse } from './api'

const TOKEN_KEY    = 'voxelplace:token'
const USERNAME_KEY = 'voxelplace:username'

interface AuthState {
  username: string
  token:    string | null
  role:     UserRole | null

  login:           (data: AuthResponse) => void
  logout:          () => void
  loadFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  username: '',
  token:    null,
  role:     null,

  login: (data) => {
    if (data.token)    localStorage.setItem(TOKEN_KEY,    data.token)
    if (data.username) localStorage.setItem(USERNAME_KEY, data.username)
    const role = getRoleFromToken(data.token) as UserRole | null
    set({ username: data.username, token: data.token, role })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
    set({ token: null, role: null })
  },

  loadFromStorage: () => {
    const token    = localStorage.getItem(TOKEN_KEY)
    if (isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USERNAME_KEY)
      set({ token: null, username: '', role: null })
      return
    }
    const username = localStorage.getItem(USERNAME_KEY) ?? ''
    const role     = getRoleFromToken(token) as UserRole | null
    set({ token, username, role })
  },
}))
