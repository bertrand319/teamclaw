import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}))

vi.mock('@/lib/utils', () => ({
  isTauri: () => false,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      targetLine: null,
      targetHeading: null,
      workspacePath: '/workspace',
    }),
}))

vi.mock('@/stores/session', () => ({
  useSessionStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) => sel({ sessionDiff: [] }),
    { getState: () => ({ sendMessage: vi.fn() }) },
  ),
}))

vi.mock('@/stores/ui', () => ({
  useUIStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) => sel({}),
    { getState: () => ({ setFileModeRightTab: vi.fn() }) },
  ),
}))

vi.mock('@/stores/team-mode', () => ({
  useTeamModeStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ myRole: 'owner' }),
}))

vi.mock('@/lib/git/manager', () => ({
  gitManager: {
    showFile: vi.fn().mockRejectedValue(new Error('not tracked')),
    logFile: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/components/editors/useAutoSave', () => ({
  useAutoSave: () => ({
    saveStatus: 'saved',
    isSelfWrite: vi.fn().mockResolvedValue(false),
    saveNow: vi.fn(),
    cancelPendingSave: vi.fn(),
  }),
}))

vi.mock('@/components/editors/ConflictBanner', () => ({
  ConflictBanner: () => null,
}))

vi.mock('@/components/editors/TiptapMarkdownEditor', () => ({
  default: React.forwardRef(() => <div data-testid="tiptap-markdown-editor" />),
}))

vi.mock('@/components/editors/CodeEditor', () => ({
  default: () => <div data-testid="code-editor" />,
}))

vi.mock('@/components/diff/DiffRenderer', () => ({
  default: () => <div data-testid="diff-renderer" />,
}))

vi.mock('@/components/version/FileHistoryView', () => ({
  default: () => <div data-testid="file-history-view" />,
}))

import { MAX_MARKDOWN_WYSIWYG_CHARS } from '@/components/editors/utils'
import { FileEditor } from '@/components/FileEditor'

describe('FileEditor large markdown routing', () => {
  it('uses CodeMirror for large markdown documents', async () => {
    const content = '# Issue Review\n\n' + 'A'.repeat(MAX_MARKDOWN_WYSIWYG_CHARS + 1)

    render(
      <FileEditor
        content={content}
        filename="SPAYS-17321.md"
        filePath="/workspace/knowledge/SPAYS-17321.md"
        onClose={vi.fn()}
      />,
    )

    expect(await screen.findByTestId('code-editor')).toBeTruthy()
    expect(screen.queryByTestId('tiptap-markdown-editor')).toBeNull()
  })

  it('keeps small markdown documents in the Tiptap editor', async () => {
    render(
      <FileEditor
        content="# Notes\n\nSmall file"
        filename="README.md"
        filePath="/workspace/README.md"
        onClose={vi.fn()}
      />,
    )

    expect(await screen.findByTestId('tiptap-markdown-editor')).toBeTruthy()
    expect(screen.queryByTestId('code-editor')).toBeNull()
  })
})
