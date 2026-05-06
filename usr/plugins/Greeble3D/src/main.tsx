import React from 'react'
import ReactDOM from 'react-dom/client'
import { Greeble3DApp } from './app/Greeble3DApp'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Greeble3DApp />
  </React.StrictMode>,
)
