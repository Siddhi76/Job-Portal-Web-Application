import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check, Clock3, MapPin, Share2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../services/apiErrors.js'
import { applicationApi } from '../services/applicationApi.js'
import { authApi } from '../services/authApi.js'
import { jobApi } from '../services/jobApi.js'
import NotFound from './NotFound.jsx'

export default function JobDetails() {
  const { jobId } = useParams()
  const [jobResult, setJobResult] = useState({ key: null, job: null, error: null })
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [resumeUrl, setResumeUrl] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [retry, setRetry] = useState(0)
  const requestKey = `${jobId}:${retry}`

  useEffect(() => {
    let active = true
    jobApi.get(jobId)
      .then(({ data }) => {
        if (active) setJobResult({ key: requestKey, job: data, error: null })
      })
      .catch((requestError) => {
        if (active) setJobResult({ key: requestKey, job: null, error: requestError })
      })
    return () => {
      active = false
    }
  }, [jobId, requestKey])

  useEffect(() => {
    let active = true
    if (authApi.currentUser()?.role === 'job_seeker') {
      applicationApi.mine()
        .then(({ data }) => {
          if (active) setAlreadyApplied(data.some((application) => application.jobId === jobId))
        })
        .catch((requestError) => {
          if (active) {
            setNotice(getApiErrorMessage(requestError, 'Could not check your application history.'))
            setNoticeIsError(true)
          }
        })
    }
    return () => {
      active = false
    }
  }, [jobId])

  async function apply(event) {
    event.preventDefault()
    setSubmitting(true)
    setNotice('')
    setNoticeIsError(false)
    try {
      const payload = {}
      if (resumeUrl.trim()) payload.resumeUrl = resumeUrl.trim()
      if (coverLetter.trim()) payload.coverLetter = coverLetter.trim()
      await applicationApi.apply(jobId, payload)
      setAlreadyApplied(true)
      setNotice('Your application was submitted successfully.')
      try {
        const { data } = await applicationApi.mine()
        setAlreadyApplied(data.some((application) => application.jobId === jobId))
      } catch (refreshError) {
        setNotice(`Your application was submitted, but your history could not refresh: ${getApiErrorMessage(refreshError)}`)
      }
    } catch (requestError) {
      if (requestError.response?.status === 409) setAlreadyApplied(true)
      setNotice(getApiErrorMessage(requestError, 'Could not submit your application.'))
      setNoticeIsError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const loading = jobResult.key !== requestKey
  const job = loading ? null : jobResult.job
  const loadError = loading ? null : jobResult.error

  if (loading) return <div className="detail-page"><p role="status">Loading job details…</p></div>
  if (loadError?.response?.status === 404) return <NotFound />
  if (loadError) {
    return <div className="detail-page"><div className="empty-panel" role="alert"><h1>Couldn’t load this job</h1><p>{getApiErrorMessage(loadError)}</p><button className="button button-outline" type="button" onClick={() => setRetry((current) => current + 1)}>Try again</button></div></div>
  }
  if (!job) return <NotFound />

  return (
    <div className="detail-page">
      <Link className="back-link" to="/jobs"><ArrowLeft size={16} /> Back to jobs</Link>
      <div className="detail-layout">
        <article className="detail-main">
          <div className="detail-company"><div className={`company-logo logo-${job.color || 'mint'}`}>{job.logo || job.company.slice(0, 1)}</div><div><p className="company-name">{job.company}</p><span>Thoughtful team · Open listing</span></div><button className="icon-button share-button" aria-label="Share this job" type="button" onClick={() => { void navigator.clipboard?.writeText(window.location.href); setNotice('Job link copied if clipboard access is available.') }}><Share2 size={18} /></button></div>
          <h1>{job.title}</h1>
          <div className="detail-meta"><span><MapPin size={16} />{job.location}</span><span><Clock3 size={16} />{job.employmentType}</span><span>Posted {job.posted}</span></div>
          <div className="detail-tags">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
          <section className="detail-section"><h2>About the role</h2><p>{job.description}</p></section>
          <section className="detail-section"><h2>What you’ll bring</h2><ul className="check-list">{job.skills.map((skill) => <li key={skill}><Check size={16} />Experience with {skill.toLowerCase()}</li>)}<li><Check size={16} />A thoughtful, collaborative approach to your work</li></ul></section>
          <section className="detail-section"><h2>About {job.company}</h2><p>{job.company} is a team of people who care about making useful things and doing right by the people who use them.</p><Link className="inline-link" to="/jobs">Explore more roles <ArrowUpRight size={15} /></Link></section>
        </article>
        <aside className="apply-card"><p className="eyebrow">Your next chapter?</p><h2>{job.title}</h2><p className="apply-company">{job.company} · {job.location}</p><div className="salary-block"><span>Compensation</span><strong>{job.salary}</strong></div>
          <form className="application-form" onSubmit={apply}>
            <label className="form-field"><span>Resume URL <small>(optional)</small></span><input type="url" value={resumeUrl} onChange={(event) => setResumeUrl(event.target.value)} placeholder="https://example.com/resume.pdf" /></label>
            <label className="form-field"><span>Cover letter <small>(optional)</small></span><textarea value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} rows="4" maxLength={12000} /></label>
            <button className="button button-primary button-full" type="submit" disabled={submitting || alreadyApplied}>{submitting ? 'Submitting…' : alreadyApplied ? 'Already applied' : 'Apply for this role'} <ArrowUpRight size={16} /></button>
          </form>
          {notice && <p className={`inline-notice${noticeIsError ? ' field-error' : ''}`} role={noticeIsError ? 'alert' : 'status'}>{notice}{noticeIsError && notice.includes('log in') && <> <Link to="/login">Log in</Link></>}</p>}
          {noticeIsError && notice.includes('log in') && <Link to="/login">Log in to apply</Link>}
          <p className="apply-footnote">Your application is sent to the employer and saved to your account.</p><div className="apply-divider" /><p className="apply-privacy">Your application details are visible to this job’s employer.</p>
        </aside>
      </div>
    </div>
  )
}
