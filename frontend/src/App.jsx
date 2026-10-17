import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PortalProvider } from './context/PortalProvider.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import EmployerDashboard from './pages/EmployerDashboard.jsx'
import Home from './pages/Home.jsx'
import JobDetails from './pages/JobDetails.jsx'
import JobListings from './pages/JobListings.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import Register from './pages/Register.jsx'
import SeekerDashboard from './pages/SeekerDashboard.jsx'

function App() {
  return (
    <BrowserRouter>
      <PortalProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="jobs" element={<JobListings />} />
            <Route path="jobs/:jobId" element={<JobDetails />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="dashboard/seeker" element={<ProtectedRoute role="job_seeker"><SeekerDashboard /></ProtectedRoute>} />
            <Route path="dashboard/employer" element={<ProtectedRoute role="employer"><EmployerDashboard /></ProtectedRoute>} />
            <Route path="dashboard" element={<Navigate to="/dashboard/seeker" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </PortalProvider>
    </BrowserRouter>
  )
}

export default App
