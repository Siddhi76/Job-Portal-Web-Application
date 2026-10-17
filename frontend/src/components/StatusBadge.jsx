export default function StatusBadge({ status }) {
  const normalizedStatus = status.toLowerCase()
  const tone = normalizedStatus === 'accepted'
    ? 'status-green'
    : normalizedStatus === 'shortlisted'
      ? 'status-blue'
      : normalizedStatus === 'rejected'
        ? 'status-muted'
        : 'status-amber'

  return <span className={`status-badge ${tone}`}>{status}</span>
}
