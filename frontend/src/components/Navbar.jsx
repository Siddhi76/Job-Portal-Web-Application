import { useEffect, useState } from 'react'
import { BriefcaseBusiness, Menu, X } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import Brand from './Brand.jsx'
import { authApi } from '../services/authApi.js'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState(() => authApi.currentUser())
  const navigate = useNavigate()

  useEffect(() => {
    const refreshUser = () => setUser(authApi.currentUser())
    window.addEventListener('qiro-auth-change', refreshUser)
    return () => window.removeEventListener('qiro-auth-change', refreshUser)
  }, [])

  function logout() {
    authApi.logout()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="site-header">
      <div className="nav-inner">
        <Brand />
        <button
          className="icon-button mobile-menu-button"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <NavLink to="/jobs" onClick={() => setMenuOpen(false)}>Find jobs</NavLink>
          <Link to="/dashboard/employer" onClick={() => setMenuOpen(false)}>For employers</Link>
          {user && <Link to={user.role === 'employer' ? '/dashboard/employer' : '/dashboard/seeker'} onClick={() => setMenuOpen(false)}>My dashboard</Link>}
          <div className="nav-actions">
            {user ? <>
              <span className="nav-login">{user.name}</span>
              <button className="nav-login" type="button" onClick={logout}>Log out</button>
            </> : <>
              <Link className="nav-login" to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
              <Link className="button button-primary nav-post" to="/register" onClick={() => setMenuOpen(false)}>
                <BriefcaseBusiness size={15} /> Post a job
              </Link>
            </>}
          </div>
        </nav>
      </div>
    </header>
  )
}
