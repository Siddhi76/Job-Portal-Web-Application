import { useEffect, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import { getApiErrorMessage } from '../services/apiErrors.js'
import { applicationApi } from '../services/applicationApi.js'
import { authApi } from '../services/authApi.js'

export default function SeekerDashboard() {
  const [user, setUser] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [statusMessage, setStatusMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([authApi.me(), applicationApi.mine()])
      .then(([currentUser, response]) => {
        if (!active) return
        setUser(currentUser)
        setProfile({ name: currentUser.name, email: currentUser.email })
        setApplications(response.data)
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, 'Could not load your dashboard.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])

  async function updateProfile() {
    const name = profile.name?.trim() ?? ''
    const email = profile.email?.trim() ?? ''
    if (!name || !email) {
      setStatusMessage('Please complete each profile field.')
      return
    }
    setSaving(true)
    setStatusMessage('')
    try {
      const updatedUser = await authApi.updateProfile({ name, email })
      setUser(updatedUser)
      setProfile({ name: updatedUser.name, email: updatedUser.email })
      setStatusMessage('Your profile has been updated.')
      setEditing(false)
    } catch (requestError) {
      setStatusMessage(getApiErrorMessage(requestError, 'Could not update your profile.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-greeting"><div><p className="eyebrow">A fresh start looks good on you</p><h1>Your job search, <span>your way.</span></h1><p>Keep an eye on your applications and make your profile feel like you.</p></div><Link className="button button-primary" to="/jobs">Explore open roles <ArrowRight size={16} /></Link></div>
      {loading ? <p role="status">Loading your dashboard…</p> : error ? <div className="empty-panel" role="alert"><h2>Couldn’t load your dashboard</h2><p>{error}</p>{error.includes('log in') && <Link className="button button-primary" to="/login">Log in</Link>}<button className="button button-outline" type="button" onClick={() => { setError(''); setLoading(true); setRetry((current) => current + 1) }}>Try again</button></div> : <>
        <div className="dashboard-grid">
          <section className="dashboard-card profile-card"><div className="dashboard-card-heading"><div><p className="eyebrow">Your account</p><h2>Account details</h2></div><button type="button" className="button button-outline" onClick={() => setEditing((current) => !current)}>{editing ? 'Cancel' : 'Edit'}</button></div>
            {editing ? (
              <div className="profile-editor">
                <label className="form-field"><span>Name</span><input aria-label="Name" value={profile.name ?? ''} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="form-field"><span>Email</span><input aria-label="Email" type="email" value={profile.email ?? ''} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} /></label>
                {statusMessage && <p role="status">{statusMessage}</p>}
                <button className="button button-primary" type="button" onClick={() => void updateProfile()} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
              </div>
            ) : (
              <>
                <div className="profile-person"><div className="profile-avatar">{user?.name?.split(' ').map((part) => part[0]).join('')}</div><div><h3>{user?.name}</h3><p>{user?.email}</p><span>Job seeker</span></div></div>
                <p className="dashboard-demo-note">Account details are loaded from your authenticated profile.</p>
                {statusMessage && <p role="status">{statusMessage}</p>}
              </>
            )}
          </section>
          <section className="dashboard-card application-card"><div className="dashboard-card-heading"><div><p className="eyebrow">Keep the momentum</p><h2>Your applications</h2></div><span className="count-pill">{applications.length}</span></div>{applications.length ? <div className="application-list">{applications.map((application) => <div key={application.id} className="application-row"><div className="company-logo mini-logo logo-mint">{application.jobTitle?.slice(0, 1) || 'Q'}</div><div className="application-info"><strong>{application.jobTitle}</strong><span>Applied {application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : 'recently'}</span></div><StatusBadge status={application.status} /></div>)}</div> : <div className="empty-state compact-empty"><BriefcaseBusiness size={22} /><p>You haven’t applied to any roles yet.</p><Link to="/jobs">Explore open roles <ArrowRight size={14} /></Link></div>}<p className="dashboard-demo-note">Application history and statuses are read from your account.</p></section>
        </div>
        <section className="dashboard-tip"><span><UserRound size={18} /></span><p><strong>Make your profile work for you.</strong> Your employer-visible information is limited to what you submit with each application.</p><Link to="/jobs">Find a role <ArrowRight size={15} /></Link></section>
      </>}
    </div>
  )
}
