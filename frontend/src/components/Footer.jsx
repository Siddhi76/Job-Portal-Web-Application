import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from './Brand.jsx'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Brand />
            <p>Good work, with good people.<br />Find your next chapter.</p>
          </div>
          <div className="footer-links">
            <div><span className="footer-label">Explore</span><Link to="/jobs">Find a job</Link><Link to="/dashboard/employer">For employers</Link></div>
            <div><span className="footer-label">Your account</span><Link to="/register">Create an account</Link><Link to="/login">Log in</Link></div>
            <div><span className="footer-label">Dashboards</span><Link to="/dashboard/seeker">Job seeker</Link><Link to="/dashboard/employer">Employer</Link></div>
          </div>
          <Link className="footer-note" to="/jobs">A better kind of job search <ArrowUpRight size={16} /></Link>
        </div>
        <div className="footer-bottom"><span>© 2026 Qiro. Made for what’s next.</span><span>API-backed auth · Mock jobs and dashboards</span></div>
      </div>
    </footer>
  )
}
