import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, Check, Pencil, Plus, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge.jsx'
import { getApiErrorMessage } from '../services/apiErrors.js'
import { applicationApi } from '../services/applicationApi.js'
import { jobApi } from '../services/jobApi.js'
import { usePortal } from '../context/usePortal.js'

const emptyJob = { title: '', company: '', location: '', category: 'Engineering', employmentType: 'Full-time', salary: '', description: '', skills: '', status: 'open' }
const applicationStatuses = ['Pending', 'Shortlisted', 'Rejected', 'Accepted']

export default function EmployerDashboard() {
  const { reloadJobs } = usePortal()
  const [jobs, setJobs] = useState([])
  const [applicantsByJob, setApplicantsByJob] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingJobId, setEditingJobId] = useState(null)
  const [form, setForm] = useState(emptyJob)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyApplicantId, setBusyApplicantId] = useState(null)

  const fetchDashboardData = useCallback(async () => {
    const { data: ownedJobs } = await jobApi.mine()
    const applicantEntries = await Promise.all(
      ownedJobs.map(async (job) => {
        const { data } = await applicationApi.forJob(job.id)
        return [job.id, data]
      }),
    )
    return { ownedJobs, applicantsByJob: Object.fromEntries(applicantEntries) }
  }, [])

  const loadDashboard = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const { ownedJobs, applicantsByJob: nextApplicantsByJob } = await fetchDashboardData()
      setJobs(ownedJobs)
      setApplicantsByJob(nextApplicantsByJob)
      return true
    } catch (requestError) {
      setJobs([])
      setApplicantsByJob({})
      setError(getApiErrorMessage(requestError, 'Could not load employer data.'))
      return false
    } finally {
      setLoading(false)
    }
  }, [fetchDashboardData])

  useEffect(() => {
    let active = true
    fetchDashboardData()
      .then(({ ownedJobs, applicantsByJob: nextApplicantsByJob }) => {
        if (!active) return
        setJobs(ownedJobs)
        setApplicantsByJob(nextApplicantsByJob)
        setError('')
      })
      .catch((requestError) => {
        if (!active) return
        setJobs([])
        setApplicantsByJob({})
        setError(getApiErrorMessage(requestError, 'Could not load employer data.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchDashboardData, retry])

  const allApplicants = useMemo(
    () => Object.values(applicantsByJob).flat(),
    [applicantsByJob],
  )
  const openJobs = jobs.filter((job) => job.status === 'open').length
  const shortlistedCount = allApplicants.filter((application) => application.status === 'Shortlisted').length

  function startEdit(job) {
    setForm({
      title: job.title,
      company: job.company,
      location: job.location,
      category: job.category,
      employmentType: job.employmentType,
      salary: job.salary,
      description: job.description,
      skills: job.skills.join(', '),
      status: job.status,
    })
    setEditingJobId(job.id)
    setShowForm(true)
    setFormError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitJob(event) {
    event.preventDefault()
    setFormError('')
    setNotice('')
    const requiredFields = [form.title, form.company, form.location, form.salary, form.description]
    if (requiredFields.some((field) => !String(field).trim())) {
      setFormError('Please complete every field')
      return
    }
    const payload = {
      ...form,
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
    }
    setSaving(true)
    try {
      if (editingJobId) await jobApi.update(editingJobId, payload)
      else await jobApi.create(payload)
      const refreshed = await loadDashboard()
      await reloadJobs()
      if (refreshed) {
        setForm(emptyJob)
        setEditingJobId(null)
        setShowForm(false)
        setNotice(editingJobId ? 'Job changes saved.' : 'Job created and published to your listings.')
      } else {
        setFormError('The change was submitted, but the dashboard could not refresh. Please reload to verify it.')
      }
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError, 'Could not save this job.'))
    } finally {
      setSaving(false)
    }
  }

  async function removeJob(jobId) {
    if (!window.confirm('Delete this job listing? This action cannot be undone.')) return
    setNotice('')
    setError('')
    try {
      await jobApi.remove(jobId)
      if (await loadDashboard()) setNotice('Job deleted.')
      else setError('The job was deleted, but the dashboard could not refresh. Please reload to verify it.')
      await reloadJobs()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not delete this job.'))
    }
  }

  async function changeStatus(applicationId, status) {
    setBusyApplicantId(applicationId)
    setError('')
    setNotice('')
    try {
      await applicationApi.updateStatus(applicationId, status)
      if (await loadDashboard()) setNotice('Application status updated.')
      else setError('The status was updated, but the dashboard could not refresh. Please reload to verify it.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not update this application.'))
    } finally {
      setBusyApplicantId(null)
    }
  }

  return (
    <div className="dashboard-page employer-dashboard">
      <div className="dashboard-greeting"><div><p className="eyebrow">Good work starts with good people</p><h1>Your team, <span>your next.</span></h1><p>A little clarity for the hiring work ahead.</p></div><button className="button button-primary" type="button" onClick={() => { setShowForm((visible) => !visible); setEditingJobId(null); setForm(emptyJob); setFormError(''); setNotice('') }}><Plus size={17} /> {showForm ? 'Close form' : 'Post a role'}</button></div>
      {error && <div className="empty-panel" role="alert"><p>{error}</p>{error.includes('log in') && <Link className="button button-primary" to="/login">Log in</Link>}<button className="button button-outline" type="button" onClick={() => { setError(''); setLoading(true); setRetry((current) => current + 1) }}>Try again</button></div>}
      {notice && <p className="inline-notice" role="status">{notice}</p>}
      {loading && !showForm && !jobs.length && <p role="status">Loading your jobs and applicants…</p>}
      {!error && <>
        <div className="stats-grid"><div className="stat-card"><span className="stat-icon stat-lavender"><BriefcaseBusiness size={18} /></span><div><span>Published jobs</span><strong>{openJobs}</strong></div><small>{jobs.length} total jobs</small></div><div className="stat-card"><span className="stat-icon stat-mint"><Users size={18} /></span><div><span>Applications</span><strong>{allApplicants.length}</strong></div><small>For your jobs</small></div><div className="stat-card"><span className="stat-icon stat-peach"><Check size={18} /></span><div><span>Shortlisted</span><strong>{shortlistedCount}</strong></div><small>Current application statuses</small></div></div>
        {showForm && <section className="dashboard-card job-form-card"><div className="dashboard-card-heading"><div><p className="eyebrow">Your next great teammate</p><h2>{editingJobId ? 'Edit job' : 'Create a job'}</h2></div><button className="icon-button" onClick={() => { setShowForm(false); setFormError(''); setEditingJobId(null); setForm(emptyJob) }} aria-label="Close job form" type="button"><X size={18} /></button></div><p className="dashboard-demo-note">Jobs are saved to your account.</p>        <form className="job-form" onSubmit={submitJob} noValidate><label className="form-field"><span>Job title</span><input required minLength={2} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Product Designer" /></label><label className="form-field"><span>Company</span><input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Your company" /></label><label className="form-field"><span>Location</span><input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Remote or city, state" /></label><label className="form-field"><span>Salary</span><input required value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} placeholder="$100k – $130k" /></label><label className="form-field"><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{['Engineering', 'Design', 'Marketing', 'Data', 'People', 'Finance'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>Employment type</span><select value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })}>{['Full-time', 'Part-time', 'Contract'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>Listing status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="open">Open</option><option value="closed">Closed</option><option value="draft">Draft</option></select></label><label className="form-field form-wide"><span>Skills <small>(comma-separated)</small></span><input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} placeholder="React, communication, ..." /></label><label className="form-field form-wide"><span>Role description</span><textarea required minLength={10} maxLength={12000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="4" placeholder="What makes this role meaningful?" /></label><div className="form-wide">{formError && <p className="field-error" role="alert">{formError}</p>}<button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingJobId ? 'Save changes' : 'Create job'} <ArrowRight size={15} /></button></div></form></section>}        <div className="employer-content-grid">
          <section className="dashboard-card employer-jobs-card"><div className="dashboard-card-heading"><div><p className="eyebrow">Your opportunities</p><h2>Your jobs</h2></div><span className="count-pill">{jobs.length}</span></div>{jobs.length ? <div className="employer-job-list">{jobs.map((job) => <div className="employer-job-row" key={job.id}><div className={`company-logo mini-logo logo-${job.color || 'mint'}`}>{job.logo || job.company.slice(0, 1)}</div><div className="employer-job-info"><strong>{job.title}</strong><span>{job.company} · {job.location} · {job.status}</span></div><span className="applicant-count">{(applicantsByJob[job.id] || []).length} applicants</span>{job.status === 'open' && <Link className="job-row-link" to={`/jobs/${job.id}`} aria-label={`View ${job.title}`}><ArrowRight size={16} /></Link>}<button className="job-row-link" type="button" onClick={() => startEdit(job)} aria-label={`Edit ${job.title}`}><Pencil size={14} /></button><button className="job-row-delete" type="button" onClick={() => void removeJob(job.id)} aria-label={`Delete ${job.title}`}><X size={15} /></button></div>)}</div> : <div className="empty-state compact-empty"><p>You haven’t created any jobs yet.</p><button className="button button-outline" type="button" onClick={() => setShowForm(true)}>Create your first job</button></div>}</section>
          <section className="dashboard-card applicants-card"><div className="dashboard-card-heading"><div><p className="eyebrow">The people behind the profiles</p><h2>Applicants</h2></div><span className="count-pill">{allApplicants.length}</span></div>{allApplicants.length ? <div className="applicant-list">{jobs.flatMap((job) => (applicantsByJob[job.id] || []).map((applicant) => <div className="applicant-row" key={applicant.id}><div className="applicant-avatar">{applicant.applicantName.split(' ').map((part) => part[0]).join('')}</div><div className="applicant-info"><strong>{applicant.applicantName}</strong><span>Applied {applicant.appliedAt ? new Date(applicant.appliedAt).toLocaleDateString() : 'recently'}</span><small>{job.title}</small>{applicant.resumeUrl && <a href={applicant.resumeUrl} target="_blank" rel="noreferrer">Resume</a>}{applicant.coverLetter && <p>{applicant.coverLetter}</p>}</div><label className="applicant-status"><span className="sr-only">Update {applicant.applicantName} status for {job.title}</span><select aria-label={`Update ${applicant.applicantName} status`} value={applicant.status} disabled={busyApplicantId === applicant.id} onChange={(event) => void changeStatus(applicant.id, event.target.value)}>{applicationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><StatusBadge status={applicant.status} /></div>))}</div> : <div className="empty-state compact-empty"><p>No applications have been received for your jobs.</p></div>}</section>
        </div>
        <div className="dashboard-tip"><span><Users size={18} /></span><p><strong>Great teams are built one conversation at a time.</strong> Candidate status changes are saved immediately.</p><Link to="/jobs">Browse open roles <ArrowRight size={15} /></Link></div>
      </>}
    </div>
  )
}
