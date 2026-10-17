export const REGISTER_PATH = '/auth/register'
export const LOGIN_PATH = '/auth/login'

export function buildRegistrationPayload({ name, email, password, role }) {
  return {
    name: name.trim(),
    email: email.trim(),
    password,
    role: role === 'job-seeker' ? 'job_seeker' : role,
  }
}

export function getAuthErrorMessage(error) {
  const status = error.response?.status
  const detail = error.response?.data?.detail

  if (status === 409) {
    return typeof detail === 'string'
      ? detail
      : 'An account with this email already exists. Try logging in instead.'
  }
  if (status === 422) {
    if (Array.isArray(detail)) {
      return detail.map((issue) => issue.msg).join('; ')
    }
    return typeof detail === 'string' ? detail : 'Please check the registration details and try again.'
  }
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((issue) => issue.msg).join('; ')
  if (status === 404) {
    return 'Registration endpoint not found. Confirm VITE_API_BASE_URL points to FastAPI and ends in /api.'
  }
  if (status) return `The API request failed (${status}).`
  return 'Could not reach the API. Check that the backend is running and VITE_API_BASE_URL is configured.'
}
