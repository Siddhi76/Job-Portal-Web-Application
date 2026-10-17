import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthForm from './AuthForm.jsx'
import { authApi } from '../services/authApi.js'

vi.mock('../services/authApi.js', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
  },
}))

function renderAuth(mode, route = mode === 'register' ? '/register' : '/login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/register" element={<AuthForm mode="register" />} />
        <Route path="/login" element={<AuthForm mode="login" />} />
        <Route path="/dashboard/employer" element={<h1>Employer dashboard route</h1>} />
        <Route path="/dashboard/seeker" element={<h1>Seeker dashboard route</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

const credentials = {
  accessToken: 'mock-access-token',
  user: { id: 'user-1', name: 'Jamie Taylor', role: 'job_seeker' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registration and login form', () => {
  it('renders registration fields and both role choices', () => {
    renderAuth('register')
    expect(screen.getByLabelText('Your name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /job seeker/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /employer/i })).toBeInTheDocument()
  })

  it('validates required fields before sending a request', async () => {
    const user = userEvent.setup()
    renderAuth('register')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Please enter your name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('registers an employer and navigates to the employer dashboard', async () => {
    const user = userEvent.setup()
    authApi.register.mockResolvedValue({
      ...credentials,
      user: { ...credentials.user, role: 'employer' },
    })
    renderAuth('register')
    await user.type(screen.getByLabelText('Your name'), 'Jamie Taylor')
    await user.type(screen.getByLabelText('Email address'), 'jamie@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('radio', { name: /employer/i }))
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('heading', { name: 'Employer dashboard route' })).toBeInTheDocument()
    expect(authApi.register).toHaveBeenCalledWith({
      name: 'Jamie Taylor',
      email: 'jamie@example.com',
      password: 'correct-horse-battery',
      role: 'employer',
    })
  })

  it('registers a job seeker and navigates to the seeker dashboard', async () => {
    const user = userEvent.setup()
    authApi.register.mockResolvedValue(credentials)
    renderAuth('register')
    await user.type(screen.getByLabelText('Your name'), 'Jamie Taylor')
    await user.type(screen.getByLabelText('Email address'), 'jamie@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('heading', { name: 'Seeker dashboard route' })).toBeInTheDocument()
  })

  it('shows a useful duplicate-email error without navigating', async () => {
    const user = userEvent.setup()
    authApi.register.mockRejectedValue({
      response: { status: 409, data: { detail: 'Email is already registered' } },
    })
    renderAuth('register')
    await user.type(screen.getByLabelText('Your name'), 'Jamie Taylor')
    await user.type(screen.getByLabelText('Email address'), 'used@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('Email is already registered')
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows backend validation details and network errors', async () => {
    const user = userEvent.setup()
    authApi.register.mockRejectedValueOnce({
      response: { status: 422, data: { detail: [{ msg: 'Email is invalid' }] } },
    })
    renderAuth('register')
    await user.type(screen.getByLabelText('Your name'), 'Jamie Taylor')
    await user.type(screen.getByLabelText('Email address'), 'jamie@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('Email is invalid')
    await user.clear(screen.getByLabelText('Email address'))
    await user.type(screen.getByLabelText('Email address'), 'other@example.com')
    authApi.register.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('Could not reach the API')
  })

  it('disables submit while a registration request is pending', async () => {
    const user = userEvent.setup()
    let finishRequest
    authApi.register.mockImplementation(
      () => new Promise((resolve) => { finishRequest = resolve }),
    )
    renderAuth('register')
    await user.type(screen.getByLabelText('Your name'), 'Jamie Taylor')
    await user.type(screen.getByLabelText('Email address'), 'jamie@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    const pendingButton = await screen.findByRole('button', { name: /connecting/i })
    expect(pendingButton).toBeDisabled()
    fireEvent.click(pendingButton)
    expect(authApi.register).toHaveBeenCalledTimes(1)
    finishRequest(credentials)
    await screen.findByRole('heading', { name: 'Seeker dashboard route' })
  })

  it('logs in, navigates by role, and reports invalid credentials', async () => {
    const user = userEvent.setup()
    authApi.login.mockResolvedValue({
      ...credentials,
      user: { ...credentials.user, role: 'employer' },
    })
    renderAuth('login')
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Email address'), 'employer@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('heading', { name: 'Employer dashboard route' })).toBeInTheDocument()

    authApi.login.mockRejectedValue({
      response: { status: 401, data: { detail: 'Incorrect email or password' } },
    })
    renderAuth('login')
    await user.type(screen.getByLabelText('Email address'), 'employer@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password-123')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Incorrect email or password'))
  })
})
