import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="not-found"><span>404 · Not here</span><h1>Looks like a little detour.</h1><p>That page may have moved, or the job may no longer be in this demo.</p><Link className="button button-primary" to="/"><ArrowLeft size={16} /> Back to Qiro</Link></div>
  )
}
