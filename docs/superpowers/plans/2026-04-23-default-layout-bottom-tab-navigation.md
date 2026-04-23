# Default Layout Bottom Tab Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the confusing mixed navigation menu in the `default` UI variant with a bottom-tab primary navigation (`Session`, `Knowledge`, `Shortcuts`, `More`) plus a `More` popover for `Workspace`, `Automation`, `Roles & Skills`, and `Settings`, while leaving the `workspace` UI variant unchanged.

**Architecture:** Keep the existing `uiVariant` split as the top-level gate. Add a default-only navigation model that composes existing store actions (`currentView`, `openSettings`, `openPanel`, session/workspace actions) instead of introducing a separate router. Render a dedicated bottom tab component for `default`, hide the old mixed-entry menu in that variant, and cover the new semantics with component/store tests.

**Tech Stack:** React, Zustand, Vite, Vitest, Testing Library, existing shadcn/ui `popover` primitives.

---

### Task 1: Add a Default-Layout Navigation Model

**Files:**
- Modify: `packages/app/src/stores/ui.ts`
- Modify: `packages/app/src/stores/workspace.ts`
- Test: `packages/app/src/stores/__tests__/ui-default-navigation.test.ts`

- [ ] **Step 1: Write the failing store tests**

Create `packages/app/src/stores/__tests__/ui-default-navigation.test.ts` covering the new default-layout navigation semantics:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '../ui'
import { useWorkspaceStore } from '../workspace'

describe('default layout navigation model', () => {
  beforeEach(() => {
    useUIStore.setState({
      currentView: 'chat',
      settingsInitialSection: null,
      embeddedSettingsSection: null,
      defaultNavTab: 'session',
      defaultMoreOpen: false,
    } as Partial<ReturnType<typeof useUIStore.getState>>)

    useWorkspaceStore.setState({
      isPanelOpen: false,
      activeTab: 'shortcuts',
    })
  })

  it('switches to knowledge primary tab without opening settings', () => {
    useUIStore.getState().selectDefaultPrimaryTab('knowledge')
    expect(useUIStore.getState().defaultNavTab).toBe('knowledge')
    expect(useWorkspaceStore.getState().activeTab).toBe('knowledge')
    expect(useUIStore.getState().currentView).toBe('chat')
  })

  it('opens settings from more without changing primary tab', () => {
    useUIStore.setState({ defaultNavTab: 'shortcuts', defaultMoreOpen: true } as any)
    useUIStore.getState().openDefaultMoreDestination('settings')
    expect(useUIStore.getState().defaultNavTab).toBe('shortcuts')
    expect(useUIStore.getState().currentView).toBe('settings')
    expect(useUIStore.getState().defaultMoreOpen).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @teamclaw/app vitest run packages/app/src/stores/__tests__/ui-default-navigation.test.ts`

Expected: FAIL because `defaultNavTab`, `defaultMoreOpen`, `selectDefaultPrimaryTab`, and `openDefaultMoreDestination` do not exist yet.

- [ ] **Step 3: Add minimal store state and actions**

Extend `packages/app/src/stores/ui.ts` with a default-only navigation state:

```ts
export type DefaultPrimaryTab = 'session' | 'knowledge' | 'shortcuts'
export type DefaultMoreDestination = 'workspace' | 'automation' | 'rolesSkills' | 'settings'

interface UIState {
  // ...
  defaultNavTab: DefaultPrimaryTab
  defaultMoreOpen: boolean
  setDefaultMoreOpen: (open: boolean) => void
  selectDefaultPrimaryTab: (tab: DefaultPrimaryTab) => void
  openDefaultMoreDestination: (destination: DefaultMoreDestination) => Promise<void> | void
}
```

Implement them by reusing existing store actions instead of inventing a new routing layer:

```ts
defaultNavTab: 'session',
defaultMoreOpen: false,

setDefaultMoreOpen: (open) => set({ defaultMoreOpen: open }),

selectDefaultPrimaryTab: (tab) => {
  const ws = useWorkspaceStore.getState()
  set({
    defaultNavTab: tab,
    defaultMoreOpen: false,
    currentView: 'chat',
    settingsInitialSection: null,
    embeddedSettingsSection: null,
  })

  if (tab === 'session') {
    ws.clearSelection()
    ws.closePanel()
    return
  }

  ws.openPanel(tab)
},

openDefaultMoreDestination: async (destination) => {
  set({ defaultMoreOpen: false })

  if (destination === 'settings') {
    get().openSettings()
    return
  }

  if (destination === 'automation') {
    get().openSettings('automation')
    return
  }

  if (destination === 'rolesSkills') {
    get().openSettings('rolesSkills')
    return
  }

  if (destination === 'workspace') {
    useWorkspaceStore.getState().clearSelection()
    set({
      currentView: 'chat',
      settingsInitialSection: null,
      embeddedSettingsSection: null,
    })
  }
},
```

Add the missing right-panel tab in `packages/app/src/stores/workspace.ts` if needed so `knowledge` remains a legal panel target everywhere the store types are used:

```ts
export type RightPanelTab = 'diff' | 'files' | 'shortcuts' | 'knowledge'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @teamclaw/app vitest run packages/app/src/stores/__tests__/ui-default-navigation.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/stores/ui.ts packages/app/src/stores/workspace.ts packages/app/src/stores/__tests__/ui-default-navigation.test.ts
git commit -m "feat(nav): add default layout navigation state"
```

### Task 2: Build the Default Bottom Tab Bar and More Popover

**Files:**
- Create: `packages/app/src/components/navigation/DefaultBottomNav.tsx`
- Create: `packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx`
- Modify: `packages/app/src/components/app-sidebar.tsx`
- Modify: `packages/app/src/components/ui/popover.tsx` (only if test support/helpers are needed; otherwise leave untouched)

- [ ] **Step 1: Write the failing component test**

Create `packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DefaultBottomNav } from '../DefaultBottomNav'

const selectDefaultPrimaryTab = vi.fn()
const setDefaultMoreOpen = vi.fn()
const openDefaultMoreDestination = vi.fn()

vi.mock('@/stores/ui', () => ({
  useUIStore: (selector: any) =>
    selector({
      defaultNavTab: 'session',
      defaultMoreOpen: false,
      selectDefaultPrimaryTab,
      setDefaultMoreOpen,
      openDefaultMoreDestination,
    }),
}))

describe('DefaultBottomNav', () => {
  it('renders three primary tabs and more trigger', () => {
    render(<DefaultBottomNav />)
    expect(screen.getByRole('button', { name: /session/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /knowledge/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /shortcuts/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /more/i })).toBeTruthy()
  })

  it('routes primary tab clicks through selectDefaultPrimaryTab', () => {
    render(<DefaultBottomNav />)
    fireEvent.click(screen.getByRole('button', { name: /knowledge/i }))
    expect(selectDefaultPrimaryTab).toHaveBeenCalledWith('knowledge')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @teamclaw/app vitest run packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx`

Expected: FAIL because `DefaultBottomNav.tsx` does not exist yet.

- [ ] **Step 3: Create the bottom nav component**

Create `packages/app/src/components/navigation/DefaultBottomNav.tsx` with a compact bottom bar and popover-backed `More`:

```tsx
import { BookOpen, Bookmark, Ellipsis, MessageSquare, Settings, Clock, Shapes, FolderOpen } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/ui'
import { cn } from '@/lib/utils'

const PRIMARY_TABS = [
  { id: 'session', label: 'Session', icon: MessageSquare },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'shortcuts', label: 'Shortcuts', icon: Bookmark },
] as const

const MORE_ITEMS = [
  { id: 'workspace', label: 'Workspace', icon: FolderOpen },
  { id: 'automation', label: 'Automation', icon: Clock },
  { id: 'rolesSkills', label: 'Roles & Skills', icon: Shapes },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export function DefaultBottomNav() {
  const activeTab = useUIStore(s => s.defaultNavTab)
  const moreOpen = useUIStore(s => s.defaultMoreOpen)
  const selectDefaultPrimaryTab = useUIStore(s => s.selectDefaultPrimaryTab)
  const setDefaultMoreOpen = useUIStore(s => s.setDefaultMoreOpen)
  const openDefaultMoreDestination = useUIStore(s => s.openDefaultMoreDestination)

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="grid grid-cols-4 gap-1 px-2 py-2">
        {PRIMARY_TABS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            className={cn('flex h-14 flex-col gap-1 rounded-xl', activeTab === id && 'bg-muted text-foreground')}
            onClick={() => selectDefaultPrimaryTab(id)}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[11px]">{label}</span>
          </Button>
        ))}

        <Popover open={moreOpen} onOpenChange={setDefaultMoreOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" className={cn('flex h-14 flex-col gap-1 rounded-xl', moreOpen && 'bg-muted text-foreground')}>
              <Ellipsis className="h-4 w-4" />
              <span className="text-[11px]">More</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-56 p-2">
            <div className="space-y-1">
              {MORE_ITEMS.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={() => openDefaultMoreDestination(id)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Mount it only in the default layout shell**

In `packages/app/src/components/app-sidebar.tsx`, gate the old mixed list behind `isWorkspaceUIVariant()` and render the new bottom nav only for default:

```tsx
import { isDefaultUIVariant, isWorkspaceUIVariant } from '@/lib/ui-variant'
import { DefaultBottomNav } from '@/components/navigation/DefaultBottomNav'
```

And in the default-layout branch:

```tsx
{isDefaultUIVariant() && <DefaultBottomNav />}
```

Do not render `DefaultBottomNav` anywhere in the workspace-variant branch.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @teamclaw/app vitest run packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/components/navigation/DefaultBottomNav.tsx packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx packages/app/src/components/app-sidebar.tsx
git commit -m "feat(nav): add default layout bottom tabs"
```

### Task 3: Remove the Mixed Default-Layout Menu and Rewire Its Actions

**Files:**
- Modify: `packages/app/src/components/app-sidebar.tsx`
- Modify: `packages/app/src/components/__tests__/app-sidebar.test.tsx`
- Test: `packages/app/src/components/__tests__/app-sidebar.test.tsx`

- [ ] **Step 1: Write the failing sidebar test**

Add default-variant assertions to `packages/app/src/components/__tests__/app-sidebar.test.tsx`:

```tsx
it('does not render the old mixed entry list in default variant', () => {
  uiVariantMocks.workspaceShell = false
  render(<AppSidebar />)

  expect(screen.queryByText('Automation')).toBeNull()
  expect(screen.queryByText('Roles & Skills')).toBeNull()
  expect(screen.getByRole('button', { name: /more/i })).toBeTruthy()
})

it('preserves workspace quick sections in workspace variant', () => {
  uiVariantMocks.workspaceShell = true
  render(<AppSidebar />)

  expect(screen.getByText('Automation')).toBeTruthy()
  expect(screen.getByText('Roles & Skills')).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @teamclaw/app vitest run packages/app/src/components/__tests__/app-sidebar.test.tsx`

Expected: FAIL because the default variant still renders the mixed list.

- [ ] **Step 3: Split default vs workspace rendering cleanly**

In `packages/app/src/components/app-sidebar.tsx`, make the layout branches explicit:

```tsx
const workspaceVariant = isWorkspaceUIVariant()

if (workspaceVariant) {
  return <WorkspaceSidebarShell />
}

return <DefaultSidebarShell />
```

Within `DefaultSidebarShell`, remove the rows that mix:

- `Shortcuts`
- `Automation`
- `Roles & Skills`
- `Knowledge`
- `Settings`

and rely on the new bottom navigation instead.

Do not change the workspace-specific quick links or embedded settings strip. Keep the existing `WORKSPACE_QUICK_SECTIONS` behavior untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @teamclaw/app vitest run packages/app/src/components/__tests__/app-sidebar.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/components/app-sidebar.tsx packages/app/src/components/__tests__/app-sidebar.test.tsx
git commit -m "refactor(nav): remove mixed default layout menu"
```

### Task 4: Verify End-to-End Default Navigation Semantics

**Files:**
- Modify: `packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx`
- Modify: `packages/app/src/stores/__tests__/ui-default-navigation.test.ts`
- Test: `packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx`
- Test: `packages/app/src/stores/__tests__/ui-default-navigation.test.ts`

- [ ] **Step 1: Add coverage for More semantics**

Extend `DefaultBottomNav.test.tsx` with explicit `More` behavior:

```tsx
it('does not expose persistent active state for more after close', () => {
  const { rerender } = render(<DefaultBottomNav />)
  fireEvent.click(screen.getByRole('button', { name: /more/i }))
  expect(setDefaultMoreOpen).toHaveBeenCalledWith(true)

  // Re-render with closed state from store
  mockedUiState.defaultMoreOpen = false
  rerender(<DefaultBottomNav />)
  expect(screen.getByRole('button', { name: /more/i }).getAttribute('data-state')).not.toBe('active')
})
```

Extend `ui-default-navigation.test.ts`:

```ts
it('opens automation from more without changing the selected primary tab', () => {
  useUIStore.setState({ defaultNavTab: 'knowledge', defaultMoreOpen: true } as any)
  useUIStore.getState().openDefaultMoreDestination('automation')
  expect(useUIStore.getState().defaultNavTab).toBe('knowledge')
  expect(useUIStore.getState().currentView).toBe('settings')
  expect(useUIStore.getState().settingsInitialSection).toBe('automation')
})
```

- [ ] **Step 2: Run the focused tests**

Run:

```bash
pnpm --filter @teamclaw/app vitest run \
  packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx \
  packages/app/src/stores/__tests__/ui-default-navigation.test.ts \
  packages/app/src/components/__tests__/app-sidebar.test.tsx
```

Expected: PASS

- [ ] **Step 3: Run a final default-layout regression slice**

Run:

```bash
pnpm --filter @teamclaw/app vitest run \
  packages/app/src/components/__tests__/app-sidebar.test.tsx \
  packages/app/src/stores/__tests__/workspace-behavior.test.ts \
  packages/app/src/stores/__tests__/ui-advanced-mode.test.ts
```

Expected: PASS, confirming that workspace/sidebar behavior was not regressed by the default-only navigation changes.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/components/navigation/__tests__/DefaultBottomNav.test.tsx packages/app/src/stores/__tests__/ui-default-navigation.test.ts packages/app/src/components/__tests__/app-sidebar.test.tsx
git commit -m "test(nav): verify default layout bottom tab behavior"
```

## Spec Coverage Check

- `default`-only scope: covered by Task 2 and Task 3 via `isDefaultUIVariant()` / `isWorkspaceUIVariant()` branching.
- Bottom tabs `Session / Knowledge / Shortcuts / More`: covered by Task 1 and Task 2.
- `More` popover contents `Workspace / Automation / Roles & Skills / Settings`: covered by Task 1 and Task 2.
- No `workspace` layout changes: covered by Task 3 and Task 4 regression tests.
- `More` has no persistent selected state: covered by Task 1 and Task 4.
- `Workspace` naming remains unresolved in spec: implementation should block on product clarification before wiring its final target beyond the current neutral fallback.
