import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { BootstrapRoot } from './app/bootstrap'
import './style.css'

const isDevelopment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ?? false

const container = document.getElementById('app')

if (!container) {
  throw new Error('找不到 #app 容器')
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <BootstrapRoot isDevelopment={isDevelopment}>
      <App />
    </BootstrapRoot>
  </React.StrictMode>
)
