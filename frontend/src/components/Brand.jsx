import { Link } from 'react-router-dom'

export default function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Qiro home">
      <span className="brand-mark">q</span>
      <span>qiro<span className="brand-period">.</span></span>
    </Link>
  )
}
