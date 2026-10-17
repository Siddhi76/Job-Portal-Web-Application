import { useEffect, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import JobCard from '../components/JobCard.jsx'
import { getApiErrorMessage } from '../services/apiErrors.js'
import { jobApi } from '../services/jobApi.js'

const PAGE_SIZE = 6

export default function JobListings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [employmentType, setEmploymentType] = useState('')
  const [page, setPage] = useState(1)
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    const params = { page, pageSize: PAGE_SIZE }
    if (query.trim()) params.q = query.trim()
    if (location.trim()) params.location = location.trim()
    if (category) params.category = category
    if (employmentType) params.employmentType = employmentType

    jobApi.list(params)
      .then(({ data }) => {
        if (!active) return
        setJobs(data.items)
        setTotal(data.total)
        setPageCount(data.pages)
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, 'Could not load job listings.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [query, location, category, employmentType, page, retry])

  function updateQuery(value) {
    setQuery(value)
    setPage(1)
    setLoading(true)
    setError('')
    const next = new URLSearchParams(searchParams)
    if (value.trim()) next.set('q', value.trim())
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  function updateFilter(setter) {
    return (event) => {
      setter(event.target.value)
      setPage(1)
      setLoading(true)
      setError('')
    }
  }

  function clearFilters() {
    setQuery('')
    setLocation('')
    setCategory('')
    setEmploymentType('')
    setPage(1)
    setLoading(true)
    setError('')
    setSearchParams({}, { replace: true })
  }

  return (
    <div className="listings-page">
      <div className="listings-intro"><p className="eyebrow">The good stuff is out there</p><h1>Find your next thing.</h1><p>Open roles from people who care about the work, and the people doing it.</p></div>
      <div className="listings-toolbar">
        <label className="listing-search"><Search size={18} /><span className="sr-only">Search roles</span><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Title, company, or skill" /></label>
        <label className="filter-select"><span className="sr-only">Filter by location</span><input value={location} onChange={updateFilter(setLocation)} placeholder="Location" /></label>
        <label className="filter-select"><span className="sr-only">Filter by category</span><select value={category} onChange={updateFilter(setCategory)}><option value="">All categories</option>{['Design', 'Engineering', 'Marketing', 'Data', 'People', 'Finance'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-select"><span className="sr-only">Filter by employment type</span><select value={employmentType} onChange={updateFilter(setEmploymentType)}><option value="">Any schedule</option>{['Full-time', 'Part-time', 'Contract'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <span className="filter-icon"><SlidersHorizontal size={18} /></span>
      </div>
      <div className="results-heading"><p><strong>{total}</strong> {total === 1 ? 'role' : 'roles'} to explore</p><span>Sorted by relevance</span></div>
      {loading ? <p role="status">Loading job listings…</p> : error ? <div className="empty-panel" role="alert"><h2>Couldn’t load jobs</h2><p>{error}</p><button className="button button-outline" type="button" onClick={() => { setError(''); setLoading(true); setRetry((current) => current + 1) }}>Try again</button></div> : jobs.length ? <div className="job-grid listings-grid">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div> : <div className="empty-panel"><span>✳</span><h2>No roles found this time</h2><p>Try another keyword or clear a filter to see more opportunities.</p><button className="button button-outline" onClick={clearFilters} type="button">Clear all filters</button></div>}
      {pageCount > 1 && <nav className="pagination" aria-label="Job results pages"><button className="button button-outline" type="button" disabled={page === 1 || loading} onClick={() => { setLoading(true); setError(''); setPage((current) => current - 1) }}>Previous</button><span>Page {page} of {pageCount}</span><button className="button button-outline" type="button" disabled={page === pageCount || loading} onClick={() => { setLoading(true); setError(''); setPage((current) => current + 1) }}>Next</button></nav>}
    </div>
  )
}
