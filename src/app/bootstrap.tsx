import React from 'react'

import { PlayableDemoConfigError } from '../game/config/playableDemoValidation'

type BootstrapRootProps = {
  children: React.ReactNode
  isDevelopment: boolean
}

type BootstrapRootState = {
  error: Error | null
}

const screenStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: '#0f1720',
  color: '#f7fafc',
  fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif'
}

const cardStyle: React.CSSProperties = {
  width: 'min(100%, 480px)',
  padding: 24,
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 16,
  background: 'rgba(15, 23, 32, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.28)'
}

class BootstrapErrorBoundary extends React.Component<BootstrapRootProps, BootstrapRootState> {
  state: BootstrapRootState = { error: null }

  static getDerivedStateFromError(error: Error): BootstrapRootState {
    return { error }
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    if (this.props.isDevelopment || !(this.state.error instanceof PlayableDemoConfigError)) {
      throw this.state.error
    }

    return <BlockingConfigErrorScreen error={this.state.error} />
  }
}

function BlockingConfigErrorScreen({ error }: { error: PlayableDemoConfigError }) {
  return (
    <main role="alert" style={screenStyle}>
      <section style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Unable to start CubeFight</h1>
        <p style={{ margin: '12px 0 0', lineHeight: 1.5 }}>
          The playable demo configuration is invalid for this build.
        </p>
        <p style={{ margin: '12px 0 0', lineHeight: 1.5 }}>{error.issues.join('; ')}</p>
      </section>
    </main>
  )
}

export function BootstrapRoot({ children, isDevelopment }: BootstrapRootProps) {
  return <BootstrapErrorBoundary isDevelopment={isDevelopment}>{children}</BootstrapErrorBoundary>
}
