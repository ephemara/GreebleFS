import React from 'react'
import ReactDOM from 'react-dom/client'
import { Greeble3DApp, type Greeble3DAppProps } from './app/Greeble3DApp'
import { greeble3dRuntimeConfig } from './config/greeble3dRuntime'
import './styles/globals.css'

export { Greeble3DApp, greeble3dRuntimeConfig }
export type { Greeble3DAppProps }

export function mountGreeble3D(container: Element, props?: Greeble3DAppProps) {
  const root = ReactDOM.createRoot(container)
  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(Greeble3DApp, props ?? {}),
    ),
  )
  return root
}
