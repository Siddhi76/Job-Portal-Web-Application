export function resolveApiBaseUrl(configuredBaseUrl) {
  return (configuredBaseUrl?.trim() || 'http://127.0.0.1:8000/api').replace(/\/+$/, '')
}
