import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './style.css'

const container = document.getElementById('app')

if (!container) {
  throw new Error('找不到 #app 容器')
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
