export function getApiErrorMessage(error, fallback = 'The request could not be completed.') {
  const detail = error.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join('; ') || fallback
  }
  if (typeof detail === 'string') return detail
  if (error.response?.status === 401) return 'Please log in to continue.'
  if (error.response?.status === 403) return 'Your account does not have permission to do that.'
  if (error.response?.status === 404) return 'This item is no longer available.'
  if (error.response?.status === 409) return 'This action conflicts with existing data.'
  if (error.response?.status) return `The API request failed (${error.response.status}).`
  return 'Could not reach the API. Check that the backend is running and try again.'
}
