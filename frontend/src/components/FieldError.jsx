export default function FieldError({ children }) {
  return children ? <span className="field-error" role="alert">{children}</span> : null
}
