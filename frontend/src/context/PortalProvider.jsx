import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../services/apiErrors.js'
import { jobApi } from '../services/jobApi.js'
import PortalContext from './portalContext.js'

export function PortalProvider({ children }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchJobs = useCallback(
    () => jobApi.list({ pageSize: 100 }).then((response) => response?.data?.items || response?.data || []),
    [],
  )

  useEffect(() => {
    let active = true
    fetchJobs()
      .then((items) => {
        if (!active) return
        setJobs(items)
        setError('')
      })
      .catch((requestError) => {
        if (!active) return
        setJobs([])
        setError(getApiErrorMessage(requestError, 'Could not load current job listings.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchJobs])

  const reloadJobs = useCallback(() => {
    setError('')
    setLoading(true)
    return fetchJobs()
      .then((items) => {
        setJobs(items)
        return items
      })
      .catch((requestError) => {
        setJobs([])
        setError(getApiErrorMessage(requestError, 'Could not load current job listings.'))
        return null
      })
      .finally(() => setLoading(false))
  }, [fetchJobs])

  const value = useMemo(
    () => ({ jobs, loading, error, reloadJobs }),
    [jobs, loading, error, reloadJobs],
  )

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}
