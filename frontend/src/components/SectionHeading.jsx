export default function SectionHeading({ eyebrow, title, children, action }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {children && <p className="section-subtitle">{children}</p>}
      </div>
      {action}
    </div>
  )
}
