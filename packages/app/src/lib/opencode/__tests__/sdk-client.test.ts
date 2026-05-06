import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createOpencodeClient: vi.fn(),
  sessionList: vi.fn(),
  experimentalSessionList: vi.fn(),
  requestInterceptorUse: vi.fn(),
}))

vi.mock('@opencode-ai/sdk/v2/client', () => ({
  createOpencodeClient: mocks.createOpencodeClient,
}))

import { initOpenCodeClient, listSessions } from '@/lib/opencode/sdk-client'

describe('sdk-client session wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createOpencodeClient.mockReturnValue({
      client: {
        interceptors: {
          request: {
            use: mocks.requestInterceptorUse,
          },
        },
      },
      session: {
        list: mocks.sessionList,
      },
      experimental: {
        session: {
          list: mocks.experimentalSessionList,
        },
      },
    })
    mocks.sessionList.mockResolvedValue({ data: [], error: undefined })
    mocks.experimentalSessionList.mockResolvedValue({ data: [], error: undefined })
    initOpenCodeClient({ baseUrl: 'http://localhost:4096', workspacePath: '/workspace' })
  })

  it('uses the normal session list endpoint when no archived filter is requested', async () => {
    await listSessions({ roots: true })

    expect(mocks.sessionList).toHaveBeenCalledWith({
      directory: '/workspace',
      roots: true,
    })
    expect(mocks.experimentalSessionList).not.toHaveBeenCalled()
  })

  it('uses the experimental session list endpoint when archived sessions are requested', async () => {
    await listSessions({ directory: '/workspace-a', roots: true, archived: true })

    expect(mocks.experimentalSessionList).toHaveBeenCalledWith({
      directory: '/workspace-a',
      roots: true,
      archived: true,
    })
    expect(mocks.sessionList).not.toHaveBeenCalled()
  })
})
