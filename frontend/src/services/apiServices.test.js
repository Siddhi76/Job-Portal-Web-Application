import { afterEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { resolveApiBaseUrl } from './apiConfig.js'
import { authApi } from './authApi.js'
import { applicationApi } from './applicationApi.js'
import { jobApi } from './jobApi.js'

function mockAdapter(handler) {
  const originalAdapter = api.defaults.adapter
  api.defaults.adapter = async (config) => ({
    data: handler(config),
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  return () => {
    api.defaults.adapter = originalAdapter
  }
}

afterEach(() => {
  authApi.logout()
  vi.restoreAllMocks()
})

describe('API service request contracts', () => {
  it('uses configured base URL and defaults to the local FastAPI /api prefix', () => {
    expect(api.defaults.baseURL).toBe(resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL))
    expect(resolveApiBaseUrl(undefined)).toBe('http://127.0.0.1:8000/api')
  })

  it('builds the exact production jobs URL from the configured API base URL', async () => {
    const originalBaseUrl = api.defaults.baseURL
    const configuredBaseUrl = 'https://job-portal-web-application-4xeb.onrender.com/api'
    api.defaults.baseURL = resolveApiBaseUrl(configuredBaseUrl)
    let requestUrl
    const restore = mockAdapter((config) => {
      requestUrl = api.getUri(config)
      return {}
    })

    try {
      await jobApi.list({ pageSize: 100 })
      expect(requestUrl).toBe(
        'https://job-portal-web-application-4xeb.onrender.com/api/jobs?pageSize=100',
      )
    } finally {
      restore()
      api.defaults.baseURL = originalBaseUrl
    }
  })

  it('rejects a copied Vercel UI label appended to the API base URL', () => {
    expect(() => resolveApiBaseUrl(
      'https://job-portal-web-application-4xeb.onrender.com/api  Copy variable and value',
    )).toThrow(/must not contain whitespace/)
  })

  it('sends auth payload, consumes token response, authenticates /me, and clears token on logout', async () => {
    const requests = []
    const restore = mockAdapter((config) => {
      requests.push(config)
      if (config.url === '/auth/me') return { id: 'user-1' }
      return {
        accessToken: 'test-token',
        tokenType: 'bearer',
        user: { id: 'user-1', role: 'job_seeker' },
      }
    })
    try {
      const result = await authApi.register({
        name: 'Taylor',
        email: 'taylor@example.com',
        password: 'password-value',
        role: 'job-seeker',
      })
      expect(result.user.role).toBe('job_seeker')
      expect(requests[0].url).toBe('/auth/register')
      expect(requests[0].data).toBe(JSON.stringify({
        name: 'Taylor',
        email: 'taylor@example.com',
        password: 'password-value',
        role: 'job_seeker',
      }))

      await authApi.me()
      expect(requests[1].url).toBe('/auth/me')
      expect(requests[1].headers.Authorization).toBe('Bearer test-token')

      authApi.logout()
      await authApi.me()
      expect(requests[2].headers.Authorization).toBeUndefined()
    } finally {
      restore()
    }
  })

  it('updates the current profile through the authenticated API', async () => {
    const requests = []
    const restore = mockAdapter((config) => {
      requests.push(config)
      if (config.url === '/auth/login') {
        return {
          accessToken: 'test-token',
          user: { id: 'user-1', name: 'Reader', role: 'job_seeker' },
        }
      }
      return { id: 'user-1', name: 'Updated Name', email: 'updated@example.com', role: 'job_seeker' }
    })
    try {
      await authApi.login({ email: 'reader@example.com', password: 'password-value' })
      const updated = await authApi.updateProfile({ name: 'Updated Name', email: 'updated@example.com' })
      expect(updated.name).toBe('Updated Name')
      expect(requests.at(-1).method).toBe('patch')
      expect(requests.at(-1).url).toBe('/auth/me')
      expect(requests.at(-1).data).toBe(JSON.stringify({ name: 'Updated Name', email: 'updated@example.com' }))
      expect(requests.at(-1).headers.get('Authorization')).toBeTruthy()
    } finally {
      restore()
    }
  })

  it('clears an expired session when current-user validation returns 401', async () => {
    const restore = mockAdapter(() => ({
      accessToken: 'test-token',
      user: { id: 'user-1', role: 'job_seeker' },
    }))
    try {
      await authApi.login({ email: 'reader@example.com', password: 'password-value' })
      const getSpy = vi.spyOn(api, 'get').mockRejectedValue({ response: { status: 401 } })
      await expect(authApi.me()).rejects.toMatchObject({ response: { status: 401 } })
      expect(authApi.currentUser()).toBeNull()
      expect(sessionStorage.getItem('qiro.accessToken')).toBeNull()
      expect(sessionStorage.getItem('qiro.user')).toBeNull()
      expect(getSpy).toHaveBeenCalledWith('/auth/me')
    } finally {
      restore()
    }
  })

  it('uses existing login, job, and application paths and verbs', async () => {
    const requests = []
    const restore = mockAdapter((config) => {
      requests.push(config)
      return {}
    })
    try {
      await authApi.login({ email: 'taylor@example.com', password: 'password-value' })
      await jobApi.list({ q: 'designer', location: 'Remote', pageSize: 2 })
      await jobApi.get('job/with space')
      await jobApi.create({ title: 'Engineer' })
      await jobApi.update('job-1', { title: 'Updated' })
      await jobApi.remove('job-1')
      await jobApi.applicants('job-1')
      await applicationApi.apply('job-1')
      await applicationApi.mine()
      await applicationApi.forJob('job-1')
      await applicationApi.updateStatus('application-1', 'Shortlisted')

      expect(requests.map(({ method, url }) => [method, url])).toEqual([
        ['post', '/auth/login'],
        ['get', '/jobs'],
        ['get', '/jobs/job%2Fwith%20space'],
        ['post', '/jobs'],
        ['put', '/jobs/job-1'],
        ['delete', '/jobs/job-1'],
        ['get', '/jobs/job-1/applications'],
        ['post', '/jobs/job-1/apply'],
        ['get', '/applications/my'],
        ['get', '/jobs/job-1/applications'],
        ['patch', '/applications/application-1/status'],
      ])
      expect(requests[1].params).toEqual({ q: 'designer', location: 'Remote', pageSize: 2 })
      expect(requests[10].data).toBe(JSON.stringify({ status: 'Shortlisted' }))
    } finally {
      restore()
    }
  })

  it('propagates API failures instead of returning fabricated mutation success', async () => {
    const failure = Object.assign(new Error('API unavailable'), { code: 'ERR_NETWORK' })
    const getSpy = vi.spyOn(api, 'get').mockRejectedValue(failure)
    const postSpy = vi.spyOn(api, 'post').mockRejectedValue(failure)
    const patchSpy = vi.spyOn(api, 'patch').mockRejectedValue(failure)

    await expect(jobApi.list()).rejects.toBe(failure)
    await expect(jobApi.create({ title: 'Engineer' })).rejects.toBe(failure)
    await expect(applicationApi.apply('job-1')).rejects.toBe(failure)
    await expect(applicationApi.updateStatus('application-1', 'Accepted')).rejects.toBe(failure)

    expect(getSpy).toHaveBeenCalled()
    expect(postSpy).toHaveBeenCalled()
    expect(patchSpy).toHaveBeenCalled()
  })
})
