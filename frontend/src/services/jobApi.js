import api from './api.js'

export const jobApi = {
  list: (params = {}) => {
    const {
      employmentType,
      employment_type,
      pageSize,
      page_size,
      ...filters
    } = params

    return api.get('/jobs', {
      params: {
        ...filters,
        employmentType: employmentType || employment_type,
        pageSize: pageSize || page_size,
      },
    })
  },
  get: (jobId) => api.get(`/jobs/${encodeURIComponent(jobId)}`),
  mine: () => api.get('/jobs/mine'),
  create: (job) => api.post('/jobs', job),
  update: (jobId, job) => api.put(`/jobs/${encodeURIComponent(jobId)}`, job),
  remove: (jobId) => api.delete(`/jobs/${encodeURIComponent(jobId)}`),
  applicants: (jobId) => api.get(`/jobs/${encodeURIComponent(jobId)}/applications`),
}
