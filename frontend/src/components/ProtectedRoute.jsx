import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { authApi } from '../services/authApi.js'

export default function ProtectedRoute({ role, children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    authApi.me()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) return <p className="page-loading" role="status">Checking your account…</p>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) {
    return <Navigate to={user.role === 'employer' ? '/dashboard/employer' : '/dashboard/seeker'} replace />
  }
  return children
}
