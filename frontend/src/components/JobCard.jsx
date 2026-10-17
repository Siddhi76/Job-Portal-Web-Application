import { ArrowUpRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function JobCard({ job, compact = false }) {
  return (
    <article className={`job-card${compact ? ' job-card-compact' : ''}`}>
      <div className="job-card-top">
        <div className={`company-logo logo-${job.color || 'mint'}`}>{job.logo || job.company.slice(0, 1)}</div>
        {job.featured && <span className="featured-label">Featured</span>}
        <Link className="job-card-arrow" to={`/jobs/${job.id}`} aria-label={`View ${job.title} at ${job.company}`}>
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="job-card-content">
        <p className="company-name">{job.company}</p>
        <h3><Link to={`/jobs/${job.id}`}>{job.title}</Link></h3>
        <div className="job-meta"><span><MapPin size={14} />{job.location}</span><span>{job.employmentType}</span></div>
        {!compact && <p className="job-summary">{job.description}</p>}
      </div>
      <div className="job-card-bottom">
        <strong>{job.salary}</strong>
        <span>{job.posted}</span>
      </div>
    </article>
  )
}
