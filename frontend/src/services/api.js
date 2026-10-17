import axios from 'axios'
import { resolveApiBaseUrl } from './apiConfig.js'

const api = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export default api
