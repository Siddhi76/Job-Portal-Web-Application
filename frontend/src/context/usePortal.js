import { useContext } from 'react'
import PortalContext from './portalContext.js'

export function usePortal() {
  const context = useContext(PortalContext)
  if (!context) {
    throw new Error('usePortal must be used inside PortalProvider')
  }
  return context
}
