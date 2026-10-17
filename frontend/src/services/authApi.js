import api from './api.js'
import {
  buildRegistrationPayload,
  LOGIN_PATH,
  REGISTER_PATH,
} from './authRequests.js'

let accessToken = sessionStorage.getItem('qiro.accessToken')
let authenticatedUser = null

try {
  const storedUser = sessionStorage.getItem('qiro.user')
  authenticatedUser = storedUser ? JSON.parse(storedUser) : null
} catch {
  sessionStorage.removeItem('qiro.user')
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

function credentialsResponse(response) {
  const payload = response.data ?? {}
  const token = payload.accessToken ?? payload.access_token
  accessToken = token ?? accessToken
  authenticatedUser = payload.user
  if (accessToken) sessionStorage.setItem('qiro.accessToken', accessToken)
  if (authenticatedUser) sessionStorage.setItem('qiro.user', JSON.stringify(authenticatedUser))
  window.dispatchEvent(new Event('qiro-auth-change'))
  return { ...payload, accessToken: accessToken }
}

function clearCredentials() {
  accessToken = null
  authenticatedUser = null
  sessionStorage.removeItem('qiro.accessToken')
  sessionStorage.removeItem('qiro.user')
  window.dispatchEvent(new Event('qiro-auth-change'))
}

export const authApi = {
  async register({ name, email, password, role }) {
    const response = await api.post(
      REGISTER_PATH,
      buildRegistrationPayload({ name, email, password, role }),
    )
    return credentialsResponse(response)
  },
  async login(credentials) {
    return credentialsResponse(await api.post(LOGIN_PATH, credentials))
  },
  async me() {
    try {
      authenticatedUser = (await api.get('/auth/me')).data
      sessionStorage.setItem('qiro.user', JSON.stringify(authenticatedUser))
      return authenticatedUser
    } catch (error) {
      if (error.response?.status === 401) clearCredentials()
      throw error
    }
  },
  async updateProfile(profile) {
    authenticatedUser = (await api.patch('/auth/me', profile)).data
    sessionStorage.setItem('qiro.user', JSON.stringify(authenticatedUser))
    window.dispatchEvent(new Event('qiro-auth-change'))
    return authenticatedUser
  },
  currentUser() {
    return authenticatedUser
  },
  logout() {
    clearCredentials()
  },
}
