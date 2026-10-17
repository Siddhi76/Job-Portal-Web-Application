import api from './api.js'

export const applicationApi = {
  apply: (jobId, application = {}) =>
    api.post(`/jobs/${encodeURIComponent(jobId)}/apply`, application),
  mine: () => api.get('/applications/my'),
  forJob: (jobId) =>
    api.get(`/jobs/${encodeURIComponent(jobId)}/applications`),
  updateStatus: (applicationId, status) =>
    api.patch(`/applications/${encodeURIComponent(applicationId)}/status`, { status }),
}
