import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { resolveApiBaseUrl } from './apiConfig.js'
import {
  buildRegistrationPayload,
  getAuthErrorMessage,
  LOGIN_PATH,
  REGISTER_PATH,
} from './authRequests.js'

test('uses the local FastAPI API prefix when no Vite API URL is configured', () => {
  assert.equal(resolveApiBaseUrl(undefined), 'http://127.0.0.1:8000/api')
  assert.equal(resolveApiBaseUrl('  '), 'http://127.0.0.1:8000/api')
})

test('preserves configured API base URL and removes trailing slashes', () => {
  assert.equal(
    resolveApiBaseUrl('http://localhost:8000/api/'),
    'http://localhost:8000/api',
  )
})

test('targets the FastAPI auth route and maps the job seeker role', () => {
  assert.equal(REGISTER_PATH, '/auth/register')
  assert.equal(LOGIN_PATH, '/auth/login')
  assert.equal(
    axios.getUri({
      baseURL: resolveApiBaseUrl(undefined),
      url: REGISTER_PATH,
    }),
    'http://127.0.0.1:8000/api/auth/register',
  )
  assert.deepEqual(
    buildRegistrationPayload({
      name: ' Jamie Taylor ',
      email: ' jamie@example.com ',
      password: 'correct-horse-battery',
      role: 'job-seeker',
    }),
    {
      name: 'Jamie Taylor',
      email: 'jamie@example.com',
      password: 'correct-horse-battery',
      role: 'job_seeker',
    },
  )
})

test('preserves employer role and shows useful conflict and validation errors', () => {
  assert.equal(
    buildRegistrationPayload({
      name: 'Jamie',
      email: 'jamie@example.com',
      password: 'correct-horse-battery',
      role: 'employer',
    }).role,
    'employer',
  )
  assert.equal(
    getAuthErrorMessage({
      response: { status: 409, data: { detail: 'Email is already registered' } },
    }),
    'Email is already registered',
  )
  assert.equal(
    getAuthErrorMessage({
      response: {
        status: 422,
        data: { detail: [{ msg: 'Invalid email address' }, { msg: 'Name is required' }] },
      },
    }),
    'Invalid email address; Name is required',
  )
})

test('explains route errors and distinguishes network failures', () => {
  assert.match(
    getAuthErrorMessage({ response: { status: 404, data: {} } }),
    /ends in \/api/,
  )
  assert.match(
    getAuthErrorMessage({ code: 'ERR_NETWORK' }),
    /Could not reach the API/,
  )
})
