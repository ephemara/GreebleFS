import { useEffect } from 'react'
import KGreeble from '../features/greeble/KGreeble'
import { greeble3dRuntimeConfig } from '../config/greeble3dRuntime'

export interface Greeble3DAppProps {
  title?: string
  homeHref?: string | null
  showExit?: boolean
  onExit?: () => void
}

export function Greeble3DApp({
  title,
  homeHref,
  showExit,
  onExit,
}: Greeble3DAppProps) {
  const resolvedTitle = title ?? greeble3dRuntimeConfig.runtime.defaultTitle
  const resolvedHomeHref = homeHref ?? greeble3dRuntimeConfig.runtime.exitHref
  const resolvedShowExit = showExit ?? greeble3dRuntimeConfig.runtime.showExitButton

  useEffect(() => {
    document.title = resolvedTitle
  }, [resolvedTitle])

  const resolvedOnExit = onExit
    ?? (resolvedHomeHref
      ? () => {
          window.location.assign(resolvedHomeHref)
        }
      : undefined)

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#050505]">
      <KGreeble
        sharedState={null}
        onCommit={undefined}
        onExit={resolvedOnExit}
        showExit={resolvedShowExit}
        exitLabel={resolvedHomeHref ? 'Exit to Host' : 'Exit'}
        layoutAutoSaveId={greeble3dRuntimeConfig.storage.layoutAutoSaveId}
      />
    </div>
  )
}
