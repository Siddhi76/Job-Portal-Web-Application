import { MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SearchBar({ initialQuery = '', onSearch, compact = false }) {
  const [query, setQuery] = useState(initialQuery)
  const [location, setLocation] = useState('')
  const navigate = useNavigate()

  function submit(event) {
    event.preventDefault()
    if (onSearch) {
      onSearch(query)
      return
    }
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (location.trim()) params.set('location', location.trim())
    const searchParams = params.toString()
    navigate(`/jobs${searchParams ? `?${searchParams}` : ''}`)
  }

  return (
    <form className={`search-bar${compact ? ' search-bar-compact' : ''}`} onSubmit={submit}>
      <label className="search-input">
        <Search size={19} />
        <span className="sr-only">Job title or keyword</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job title or keyword" />
      </label>
      {!compact && <span className="search-divider" />}
      {!compact && <label className="search-input location-input">
        <MapPin size={19} />
        <span className="sr-only">Location</span>
        <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, state, or remote" />
      </label>}
      <button className="button button-dark search-submit" type="submit">Search jobs <Search size={16} /></button>
    </form>
  )
}
