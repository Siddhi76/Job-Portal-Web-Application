import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import FieldError from '../components/FieldError.jsx'
import { authApi } from '../services/authApi.js'
import { getAuthErrorMessage } from '../services/authRequests.js'

const initialValues = { name: '', email: '', password: '', role: 'job-seeker' }

export default function AuthForm({ mode }) {
  const isRegister = mode === 'register'
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setErrors((current) => ({ ...current, [event.target.name]: '' }))
    setNotice('')
    setNoticeIsError(false)
  }

  async function submit(event) {
    event.preventDefault()
    setNotice('')
    setNoticeIsError(false)
    const nextErrors = {}
    if (isRegister && !values.name.trim()) nextErrors.name = 'Please enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) nextErrors.email = 'Enter a valid email address.'
    if (values.password.length < 8) nextErrors.password = 'Use at least 8 characters.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const response = isRegister
        ? await authApi.register(values)
        : await authApi.login({ email: values.email, password: values.password })
      setNotice(isRegister ? 'Your account is ready.' : 'You are signed in.')
      navigate(response.user.role === 'employer' ? '/dashboard/employer' : '/dashboard/seeker')
    } catch (error) {
      setNotice(getAuthErrorMessage(error))
      setNoticeIsError(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-aside"><Link className="back-link auth-back" to="/"><ArrowLeft size={16} /> Back home</Link><div className="auth-aside-content"><span className="auth-spark"><Sparkles size={20} /></span><p className="eyebrow">Your next starts here</p><h2>Good work is<br />closer than you think.</h2><p>Find the team where your ideas can grow and your work can make a difference.</p><div className="auth-quote">“The best career move I’ve made was finding a place that felt like me.”<span>— A Qiro community member</span></div></div><span className="auth-aside-bottom">Thoughtful work. Good people.</span></div>
      <div className="auth-main"><div className="auth-form-wrap"><Link className="auth-brand" to="/">qiro<span>.</span></Link><p className="eyebrow">{isRegister ? 'Make room for what’s next' : 'Good to see you again'}</p><h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1><p className="auth-subtitle">{isRegister ? 'Join a community that cares about the work.' : 'Pick up where your next chapter begins.'}</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          {isRegister && <label className="form-field"><span>Your name</span><input name="name" autoComplete="name" value={values.name} onChange={change} placeholder="Jamie Taylor" aria-invalid={Boolean(errors.name)} /> <FieldError>{errors.name}</FieldError></label>}
          <label className="form-field"><span>Email address</span><input name="email" type="email" autoComplete="email" value={values.email} onChange={change} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} /><FieldError>{errors.email}</FieldError></label>
          <label className="form-field"><span>Password</span><span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={values.password} onChange={change} placeholder="At least 8 characters" aria-invalid={Boolean(errors.password)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><FieldError>{errors.password}</FieldError></label>
          {isRegister && <fieldset className="role-field"><legend>I’m here as a</legend><label className={`role-choice${values.role === 'job-seeker' ? ' selected' : ''}`}><input type="radio" name="role" value="job-seeker" checked={values.role === 'job-seeker'} onChange={change} /><span className="role-check"><Check size={13} /></span><span><strong>Job seeker</strong><small>Find work that feels right</small></span></label><label className={`role-choice${values.role === 'employer' ? ' selected' : ''}`}><input type="radio" name="role" value="employer" checked={values.role === 'employer'} onChange={change} /><span className="role-check"><Check size={13} /></span><span><strong>Employer</strong><small>Meet your next great hire</small></span></label></fieldset>}
          <button className="button button-primary button-full auth-submit" type="submit" disabled={submitting}>{submitting ? 'Connecting…' : isRegister ? 'Create account' : 'Log in'} <ArrowRight size={16} /></button>
          {notice && <p className={`auth-notice${noticeIsError ? ' auth-error' : ''}`} role="status">{notice}</p>}
        </form>
        <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New around here?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link></p><p className="auth-demo-note">Your account is verified by the API. Your sign-in remains active for this tab session.</p>
      </div></div>
    </div>
  )
}
