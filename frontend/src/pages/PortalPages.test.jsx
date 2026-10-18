import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalProvider } from '../context/PortalProvider.jsx'
import { applicationApi } from '../services/applicationApi.js'
import { authApi } from '../services/authApi.js'
import { jobApi } from '../services/jobApi.js'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import EmployerDashboard from './EmployerDashboard.jsx'
import JobDetails from './JobDetails.jsx'
import JobListings from './JobListings.jsx'
import NotFound from './NotFound.jsx'
import SeekerDashboard from './SeekerDashboard.jsx'

vi.mock('../services/jobApi.js', () => ({ jobApi: {
  list: vi.fn(),
  get: vi.fn(),
  mine: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  applicants: vi.fn(),
} }))

vi.mock('../services/applicationApi.js', () => ({ applicationApi: {
  apply: vi.fn(),
  mine: vi.fn(),
  forJob: vi.fn(),
  updateStatus: vi.fn(),
} }))

vi.mock('../services/authApi.js', () => ({ authApi: {
  me: vi.fn(),
  currentUser: vi.fn(),
  updateProfile: vi.fn(),
} }))

const jobs = [
  { id: 'job-1', title: 'Frontend Engineer', company: 'Morrow', location: 'Remote', category: 'Engineering', employmentType: 'Full-time', salary: '$130k-$170k', description: 'Build accessible product interfaces for our team.', skills: ['React', 'TypeScript'], status: 'open', posted: 'Oct 1, 2026', logo: 'M', color: 'mint', applicants: 0 },
  { id: 'job-2', title: 'Product Designer', company: 'Northstar', location: 'New York, NY', category: 'Design', employmentType: 'Contract', salary: '$90-$120/hour', description: 'Design thoughtful product experiences for customers.', skills: ['Figma', 'Research'], status: 'open', posted: 'Oct 2, 2026', logo: 'N', color: 'lavender', applicants: 1 },
]

const user = { id: 'seeker-1', name: 'Jamie Taylor', email: 'jamie@example.com', role: 'job_seeker' }
const applicant = {
  id: 'application-1',
  jobId: 'job-2',
  applicantId: user.id,
  applicantName: user.name,
  jobTitle: 'Product Designer',
  status: 'Pending',
  appliedAt: '2026-10-10T00:00:00.000Z',
  resumeUrl: 'https://example.com/resume.pdf',
  coverLetter: 'I would love to contribute.',
}

function page(items, page = 1, pageSize = 6) {
  return { data: { items, total: items.length, page, pageSize, pages: Math.max(1, Math.ceil(items.length / pageSize)) } }
}

function renderPortal(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PortalProvider>
        <Routes>
          <Route path="/jobs" element={<JobListings />} />
          <Route path="/jobs/:jobId" element={<JobDetails />} />
          <Route path="/dashboard/seeker" element={<SeekerDashboard />} />
          <Route path="/dashboard/employer" element={<EmployerDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PortalProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = vi.fn(() => true)
  jobApi.list.mockResolvedValue(page(jobs))
  jobApi.get.mockImplementation(async (id) => ({ data: jobs.find((job) => job.id === id) }))
  jobApi.mine.mockResolvedValue({ data: [jobs[1]] })
  jobApi.create.mockResolvedValue({ data: { ...jobs[0], id: 'job-created' } })
  jobApi.update.mockResolvedValue({ data: jobs[1] })
  jobApi.remove.mockResolvedValue({ status: 204 })
  applicationApi.mine.mockResolvedValue({ data: [] })
  applicationApi.forJob.mockResolvedValue({ data: [applicant] })
  applicationApi.apply.mockResolvedValue({ data: applicant })
  applicationApi.updateStatus.mockResolvedValue({ data: { ...applicant, status: 'Shortlisted' } })
  authApi.me.mockResolvedValue(user)
  authApi.currentUser.mockReturnValue(user)
  authApi.updateProfile.mockImplementation(async (profile) => ({ ...user, ...profile }))
})

describe('public job pages', () => {
  it('requests real listings and filters/searches through API parameters', async () => {
    const userEventInstance = userEvent.setup()
    jobApi.list.mockImplementation(async (params) => {
      const matching = jobs.filter((job) =>
        (!params.q || `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase().includes(params.q.toLowerCase()))
        && (!params.location || job.location.toLowerCase().includes(params.location.toLowerCase()))
        && (!params.category || job.category === params.category)
        && (!params.employmentType || job.employmentType === params.employmentType))
      return page(matching, 1, params.pageSize)
    })
    renderPortal('/jobs')

    expect(await screen.findByRole('link', { name: 'Frontend Engineer' })).toBeInTheDocument()
    await userEventInstance.selectOptions(screen.getByLabelText('Filter by category'), 'Design')
    await waitFor(() => expect(jobApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'Design' })))
    expect(await screen.findByRole('link', { name: 'Product Designer' })).toBeInTheDocument()
    await userEventInstance.type(screen.getByPlaceholderText('Title, company, or skill'), 'Figma')
    await waitFor(() => expect(jobApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Figma', category: 'Design' })))
  })

  it('shows a truthful listing failure and allows retry', async () => {
    const userEventInstance = userEvent.setup()
    let requests = 0
    jobApi.list.mockImplementation(async ({ pageSize }) => {
      if (pageSize === 100) return page(jobs, 1, 100)
      requests += 1
      if (requests === 1) throw Object.assign(new Error('API unavailable'), { code: 'ERR_NETWORK' })
      return page([])
    })
    renderPortal('/jobs')
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the API')
    await userEventInstance.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'No roles found this time' })).toBeInTheDocument()
  })

  it('loads job details from the API and submits resume URL and cover letter', async () => {
    const userEventInstance = userEvent.setup()
    applicationApi.mine
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [applicant] })
    renderPortal('/jobs/job-2')
    expect(await screen.findAllByRole('heading', { name: 'Product Designer' })).toHaveLength(2)
    expect(screen.getByText('$90-$120/hour')).toBeInTheDocument()
    await userEventInstance.type(screen.getByLabelText(/Resume URL/), 'https://example.com/new-resume.pdf')
    await userEventInstance.type(screen.getByLabelText(/Cover letter/), 'Please consider my application.')
    await userEventInstance.click(screen.getByRole('button', { name: /apply for this role/i }))
    await waitFor(() => expect(applicationApi.apply).toHaveBeenCalledWith('job-2', {
      resumeUrl: 'https://example.com/new-resume.pdf',
      coverLetter: 'Please consider my application.',
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('submitted successfully')
    expect(screen.getByRole('button', { name: 'Already applied' })).toBeDisabled()
  })

  it('shows duplicate application conflicts without claiming success', async () => {
    const userEventInstance = userEvent.setup()
    applicationApi.apply.mockRejectedValue({ response: { status: 409, data: { detail: 'You have already applied for this job' } } })
    renderPortal('/jobs/job-2')
    await userEventInstance.click(await screen.findByRole('button', { name: /apply for this role/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You have already applied for this job')
    expect(screen.getByRole('button', { name: 'Already applied' })).toBeDisabled()
  })

  it('renders a not-found state for a missing backend job', async () => {
    jobApi.get.mockRejectedValue({ response: { status: 404 } })
    renderPortal('/jobs/missing')
    expect(await screen.findByRole('heading', { name: 'Looks like a little detour.' })).toBeInTheDocument()
  })
})

describe('job seeker dashboard', () => {
  it('shows API profile/application status and persists profile edits through the API', async () => {
    const userEventInstance = userEvent.setup()
    applicationApi.mine.mockResolvedValue({ data: [applicant] })
    renderPortal('/dashboard/seeker')
    expect(await screen.findByRole('heading', { name: 'Jamie Taylor' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    await userEventInstance.click(screen.getByRole('button', { name: 'Edit' }))
    await userEventInstance.clear(screen.getByLabelText('Name'))
    await userEventInstance.type(screen.getByLabelText('Name'), 'Jamie T.')
    await userEventInstance.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(authApi.updateProfile).toHaveBeenCalledWith({ name: 'Jamie T.', email: user.email }))
    expect(await screen.findByRole('heading', { name: 'Jamie T.' })).toBeInTheDocument()
  })

  it('shows an empty application state when the API returns no applications', async () => {
    applicationApi.mine.mockResolvedValue({ data: [] })
    renderPortal('/dashboard/seeker')
    expect(await screen.findByText('You haven’t applied to any roles yet.')).toBeInTheDocument()
  })
})

describe('employer dashboard', () => {
  it('loads owned jobs and applicants, creates and edits jobs through API, and confirms deletion', async () => {
    const userEventInstance = userEvent.setup()
    let persistedJobs = [{ ...jobs[1] }]
    jobApi.mine.mockImplementation(async () => ({ data: persistedJobs }))
    applicationApi.forJob.mockImplementation(async (jobId) => ({
      data: [{ ...applicant, id: `application-${jobId}`, jobId }],
    }))
    jobApi.create.mockImplementation(async (payload) => {
      const created = { ...jobs[0], ...payload, id: 'job-created' }
      persistedJobs = [created, ...persistedJobs]
      return { data: created }
    })

    jobApi.update.mockImplementation(async (id, payload) => {
      persistedJobs = persistedJobs.map((job) => job.id === id ? { ...job, ...payload } : job)
      return { data: persistedJobs.find((job) => job.id === id) }
    })
    jobApi.remove.mockImplementation(async (id) => {
      persistedJobs = persistedJobs.filter((job) => job.id !== id)
      return { status: 204 }
    })
    renderPortal('/dashboard/employer')
    expect(await screen.findByRole('button', { name: 'Edit Product Designer' })).toBeInTheDocument()
    expect(await screen.findByText(user.name)).toBeInTheDocument()

    await userEventInstance.click(screen.getByRole('button', { name: 'Post a role' }))
    await userEventInstance.type(screen.getByLabelText('Job title'), 'QA Engineer')
    await userEventInstance.type(screen.getByLabelText('Company'), 'Test Company')
    await userEventInstance.type(screen.getByLabelText('Location'), 'Remote')
    await userEventInstance.type(screen.getByLabelText('Salary'), '$90k-$110k')
    await userEventInstance.type(screen.getByLabelText('Role description'), 'Test the product with a curious team.')
    await userEventInstance.click(screen.getByRole('button', { name: 'Create job' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Job created and published')
    expect(jobApi.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'QA Engineer',
      skills: [],
      employmentType: 'Full-time',
    }))
    expect(await screen.findByRole('button', { name: 'Edit QA Engineer' })).toBeInTheDocument()

    await userEventInstance.click(screen.getByRole('button', { name: 'Edit QA Engineer' }))
    await userEventInstance.clear(screen.getByLabelText('Job title'))
    await userEventInstance.type(screen.getByLabelText('Job title'), 'Senior QA Engineer')
    await userEventInstance.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(jobApi.update).toHaveBeenCalledWith('job-created', expect.objectContaining({ title: 'Senior QA Engineer' })))

    await userEventInstance.click(screen.getByRole('button', { name: 'Delete Senior QA Engineer' }))
    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(jobApi.remove).toHaveBeenCalledWith('job-created'))
  })

  it('renders applications from multiple jobs with unique application keys', async () => {
    jobApi.mine.mockResolvedValue({ data: jobs })
    applicationApi.forJob.mockImplementation(async (jobId) => ({
      data: [{ ...applicant, id: `application-${jobId}`, jobId }],
    }))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      renderPortal('/dashboard/employer')
      expect(await screen.findAllByText(user.name)).toHaveLength(2)
      expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('updates application status via the API and reports the saved state', async () => {
    const userEventInstance = userEvent.setup()
    renderPortal('/dashboard/employer')
    const select = await screen.findByLabelText('Update Jamie Taylor status')
    await userEventInstance.selectOptions(select, 'Shortlisted')
    await waitFor(() => expect(applicationApi.updateStatus).toHaveBeenCalledWith('application-1', 'Shortlisted'))
    expect(await screen.findByRole('status')).toHaveTextContent('Application status updated')
  })

  it('validates required job fields locally before making an API request', async () => {
    const userEventInstance = userEvent.setup()
    renderPortal('/dashboard/employer')
    await userEventInstance.click(await screen.findByRole('button', { name: 'Post a role' }))
    await userEventInstance.click(screen.getByRole('button', { name: 'Create job' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please complete every field')
    expect(jobApi.create).not.toHaveBeenCalled()
  })

  it('reports API failures without adding a fabricated job', async () => {
    const userEventInstance = userEvent.setup()
    jobApi.create.mockRejectedValue({ code: 'ERR_NETWORK' })
    renderPortal('/dashboard/employer')
    await userEventInstance.click(await screen.findByRole('button', { name: 'Post a role' }))
    await userEventInstance.type(screen.getByLabelText('Job title'), 'QA Engineer')
    await userEventInstance.type(screen.getByLabelText('Company'), 'Test Company')
    await userEventInstance.type(screen.getByLabelText('Location'), 'Remote')
    await userEventInstance.type(screen.getByLabelText('Salary'), '$90k-$110k')
    await userEventInstance.type(screen.getByLabelText('Role description'), 'Test the product with a curious team.')
    await userEventInstance.click(screen.getByRole('button', { name: 'Create job' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the API')
    expect(screen.queryByRole('button', { name: 'Edit QA Engineer' })).not.toBeInTheDocument()
  })
})

describe('protected dashboard routes', () => {
  it('redirects unauthenticated users to login', async () => {
    authApi.me.mockRejectedValueOnce({ response: { status: 401 } })
    render(
      <MemoryRouter initialEntries={['/dashboard/employer']}>
        <Routes>
          <Route path="/dashboard/employer" element={<ProtectedRoute role="employer"><h1>Employer dashboard</h1></ProtectedRoute>} />
          <Route path="/login" element={<h1>Log in</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('redirects an authenticated user to their matching dashboard role', async () => {
    authApi.me.mockResolvedValueOnce(user)
    render(
      <MemoryRouter initialEntries={['/dashboard/employer']}>
        <Routes>
          <Route path="/dashboard/employer" element={<ProtectedRoute role="employer"><h1>Employer dashboard</h1></ProtectedRoute>} />
          <Route path="/dashboard/seeker" element={<h1>Seeker dashboard</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Seeker dashboard' })).toBeInTheDocument()
  })
})
