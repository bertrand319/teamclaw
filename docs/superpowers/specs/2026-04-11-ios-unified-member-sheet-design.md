# iOS Unified Member Sheet

## Problem

Three separate member list implementations exist across the iOS app, each with different row styles, interaction patterns, and data loading logic:

1. **MemberListView** (Session list → member panel) — full NavigationStack with search, swipe actions, detail navigation
2. **MemberPickerSheet** (Session detail → add collaborator) — simple list with checkmark, text-only rows
3. **memberPickerSection** in NewSessionSheet — inline VStack, single-select, auto-dismiss

This creates visual inconsistency, duplicated code, and maintenance burden.

## Solution

Replace all three with a single `UnifiedMemberSheet` view that supports two modes via a `MemberListMode` enum.

## Modes

```swift
enum MemberListMode {
    /// Browse mode — tap a row to navigate into MemberDetailView
    case browse
    /// Select mode — checkbox selection with confirm button
    /// preSelected: IDs already chosen (e.g. existing collaborators)
    /// onConfirm: callback with final selected ID set when user taps confirm
    case select(preSelected: Set<String>, onConfirm: (Set<String>) -> Void)
}
```

## View Structure

```
UnifiedMemberSheet (presented as .sheet in all three call sites)
├── NavigationStack
│   ├── .toolbar
│   │   ├── .principal: title (browse: "团队成员", select: "选择成员")
│   │   └── .confirmationAction: "完成" button (browse) or hidden (select — confirm is at bottom)
│   ├── .searchable (system native search bar)
│   ├── List
│   │   └── ForEach filtered members
│   │       ├── browse mode: NavigationLink → MemberDetailView
│   │       └── select mode: Button that toggles selection
│   │           ├── leading: checkmark circle (filled if selected, empty if not)
│   │           └── trailing: row content
│   └── .safeAreaInset(edge: .bottom) [select mode only]
│       └── "确定 (N)" confirm button — disabled when selection unchanged
```

## Row Design

Unified `MemberRow` used in both modes, matching the existing MemberListView style:

```
[Avatar Circle 44pt]  [Name]  [AI 搭档 / 成员 badge]
                      [Department]
```

- Avatar: AI ally = blue circle + cpu icon; human = purple circle + first character
- Badge: capsule tag, blue for AI, gray for human
- In select mode: a `checkmark.circle.fill` / `circle` icon prepended to the left of the row

## Interaction

### Browse Mode
- Tap row → push `MemberDetailView` (existing, unchanged)
- No swipe actions (removed per requirements)
- Pull to refresh → re-request members via MQTT
- "完成" toolbar button dismisses the sheet

### Select Mode
- Tap row → toggle selection (checkmark on/off)
- Pre-selected members start with checkmark, can be deselected
- Bottom confirm button shows count: "确定 (3)"
- Confirm button tap → calls `onConfirm` with final `Set<String>` of selected IDs, then dismisses
- Toolbar has "取消" button to dismiss without changes

## Call Sites

### 1. Session list → member panel (browse)

**Before:** `MemberListView(viewModel:mqttService:)`
**After:**
```swift
.sheet(isPresented: $showMemberPanel) {
    UnifiedMemberSheet(mode: .browse, mqttService: mqttService)
}
```

### 2. Session detail → add collaborator (select)

**Before:** `MemberPickerSheet(session:mqttService:)`
**After:**
```swift
.sheet(isPresented: $showEditSheet) {
    UnifiedMemberSheet(
        mode: .select(
            preSelected: Set(session.collaboratorIDs),
            onConfirm: { ids in
                session.collaboratorIDs = Array(ids)
                session.isCollaborative = !ids.isEmpty
                try? modelContext.save()
            }
        ),
        mqttService: mqttService
    )
}
```

### 3. New session → select collaborators (select)

**Before:** Inline `memberPickerSection` + `MemberPickerRow` inside NewSessionSheet
**After:**
```swift
.sheet(isPresented: $showMemberPicker) {
    UnifiedMemberSheet(
        mode: .select(
            preSelected: Set(collaborators.map(\.id)),
            onConfirm: { ids in
                // Update collaborators array from selected IDs
                let allMembers = ... // from modelContext
                collaborators = allMembers.filter { ids.contains($0.id) }
            }
        ),
        mqttService: mqttService
    )
}
```

NewSessionSheet simplifies: remove `memberPickerSection`, `MemberPickerRow`, `MemberChipAvatar`, and inline search state. The collaborator chips row stays — it shows who's already selected above the message input.

## Data Loading

`UnifiedMemberSheet` manages its own data:
- On `.onAppear`: fetch `TeamMember` from SwiftData (`FetchDescriptor` sorted by name)
- Optionally accept `MemberViewModel` for browse mode to support pull-to-refresh via MQTT
- Search filtering: `name` or `department` case-insensitive match (same as current MemberListView)

## Files Changed

### New
- `TeamClawMobile/Features/TeamMembers/UnifiedMemberSheet.swift` — the unified component + shared `MemberRow`

### Modified
- `SessionListView.swift` — replace `showMemberPanel` sheet with `UnifiedMemberSheet(mode: .browse)`, delete `MemberPickerSheet`
- `ChatDetailView.swift` — replace `showEditSheet` sheet with `UnifiedMemberSheet(mode: .select)`, delete `ChatEditSheet`
- `NewSessionSheet.swift` — replace inline picker with `UnifiedMemberSheet(mode: .select)` sheet, remove `memberPickerSection`, `MemberPickerRow`, `MemberChipAvatar`

### Deleted (code, not files)
- `MemberListView.swift` — `MemberListView` struct replaced; keep file for `MemberRow` if not moved, or delete entirely if `MemberRow` moves to UnifiedMemberSheet
- `MemberPickerSheet` in SessionListView.swift
- `ChatEditSheet` in ChatDetailView.swift

### Unchanged
- `MemberDetailView.swift` — used as-is by browse mode's NavigationLink
- `MemberViewModel.swift` — used as-is for MQTT sync
- `TeamMember.swift` model
