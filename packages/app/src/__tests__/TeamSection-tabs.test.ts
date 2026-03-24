import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import * as React from 'react'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === 'string') return fallback
      if (typeof fallback === 'object' && fallback && 'defaultValue' in fallback) return (fallback as { defaultValue: string }).defaultValue
      return key
    },
  }),
}))

const mockInvoke = vi.fn(async (cmd: string) => {
  if (cmd === 'p2p_sync_status') return null
  if (cmd === 'webdav_get_status') return null
  if (cmd === 'get_device_info') return { nodeId: 'test-node', platform: 'macos', arch: 'aarch64', hostname: 'test-mac' }
  if (cmd === 'get_p2p_config') return null
  if (cmd === 'p2p_reconnect') return null
  if (cmd === 'unified_team_get_members') return []
  if (cmd === 'unified_team_get_my_role') return null
  return null
})

// Mock Tauri invoke to prevent real API calls
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

// Mock Tauri event API to prevent transformCallback errors
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}))

// Mock plugin-fs to prevent import errors
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(async () => ''),
  exists: vi.fn(async () => false),
}))

// Mock window.__TAURI__ to simulate desktop environment
beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as { __TAURI__: unknown }).__TAURI__ = {}
  ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
    transformCallback: vi.fn((_callback: unknown) => {
      const id = Math.random()
      return id
    }),
  }
})

describe('TeamSection (no tab switcher)', () => {
  it('renders without any tabs (tab switcher was removed)', async () => {
    const { TeamSection } = await import('../components/settings/TeamSection')

    await act(async () => {
      render(React.createElement(TeamSection))
    })

    // The tab switcher no longer exists — no tab roles should be present
    const tabs = screen.queryAllByRole('tab')
    expect(tabs.length).toBe(0)
  })

  it('renders a heading for the Team section', async () => {
    const { TeamSection } = await import('../components/settings/TeamSection')

    await act(async () => {
      render(React.createElement(TeamSection))
    })

    // SectionHeader renders an h3 with the team title
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(0)
  })

  it('renders P2P config content directly without tab navigation', async () => {
    const { TeamSection } = await import('../components/settings/TeamSection')

    await act(async () => {
      render(React.createElement(TeamSection))
    })

    // P2P content is always visible — no S3 or WebDAV tabs exist
    const tabs = screen.queryAllByRole('tab')
    expect(tabs.every(t => !t.textContent?.includes('S3'))).toBe(true)
    expect(tabs.every(t => !t.textContent?.includes('WebDAV'))).toBe(true)
  })
})
