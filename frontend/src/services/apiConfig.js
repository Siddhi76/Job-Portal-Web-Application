export function resolveApiBaseUrl(configuredBaseUrl) {
  const baseUrl = (configuredBaseUrl?.trim() || 'http://127.0.0.1:8000/api').replace(/\/+$/, '')
  if (/\s/.test(baseUrl)) {
    throw new Error('VITE_API_BASE_URL must not contain whitespace. Check the Vercel environment value and redeploy.')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(baseUrl)
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute HTTP(S) URL.')
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use HTTP or HTTPS.')
  }

  return baseUrl
}
