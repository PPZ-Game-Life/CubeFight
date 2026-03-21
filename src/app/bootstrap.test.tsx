import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlayableDemoConfigError } from '../game/config/playableDemoValidation'
import { BootstrapRoot } from './bootstrap'

function ThrowingApp(): never {
  throw new PlayableDemoConfigError(['Broken config'])
}

describe('BootstrapRoot', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rethrows typed config failures in development', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => {
      render(
        <BootstrapRoot isDevelopment>
          <ThrowingApp />
        </BootstrapRoot>
      )
    }).toThrow(PlayableDemoConfigError)
  })

  it('renders a blocking config error screen in production', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <BootstrapRoot isDevelopment={false}>
        <ThrowingApp />
      </BootstrapRoot>
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to start CubeFight')
    expect(screen.getByText('Broken config')).toBeInTheDocument()
  })
})
