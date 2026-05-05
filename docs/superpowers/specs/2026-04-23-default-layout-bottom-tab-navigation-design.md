# Default Layout Bottom Tab Navigation — Design

**Date:** 2026-04-23  
**Scope:** `app.uiVariant === "default"` only  
**Non-goal:** no navigation model changes for `workspace` layout

## Goal

Fix the confusing mixed-navigation menu in the default layout by separating primary navigation from secondary tools.

Today, the default layout shows a single popover/list where some items switch the sidebar/main context (`Shortcuts`, `Knowledge`) while others open tools or settings (`Roles & Skills`, `Settings`). The user cannot predict the result before clicking.

The new model makes the default layout behave like a lightweight app shell:

- bottom tabs for primary destinations
- a `More` popover for secondary destinations and tools
- no mixed list where visually identical rows trigger different interaction types

## Layout Model

### Default Layout

Replace the current mixed-entry menu with a bottom tab bar containing four items:

- `Session`
- `Knowledge`
- `Shortcuts`
- `More`

`More` opens a popover panel containing:

- `Workspace`
- `Automation`
- `Roles & Skills`
- `Settings`

### Workspace Layout

No changes. The existing workspace-oriented sidebar/navigation model remains intact.

## Interaction Rules

### Bottom Tabs

Bottom tabs are the only primary navigation mechanism in the default layout.

- Clicking `Session`, `Knowledge`, or `Shortcuts` switches the active primary view immediately.
- The selected tab uses a persistent active state.
- These tabs should never open popovers, sheets, or modal-style tools directly.

### More

`More` is a disclosure control, not a first-class destination.

- Clicking `More` opens a popover anchored to the tab bar.
- `More` does not get a persistent selected state after the popover closes.
- `More` may show a temporary pressed/open state only while the popover is visible.

### More Popover Items

All items inside `More` are secondary destinations or tools.

- Clicking a `More` item closes the popover first, then opens the target destination/tool.
- `More` items do not imply a bottom-tab selection change unless the destination is explicitly mapped to one of the three primary tabs.
- `Settings` and `Roles & Skills` must behave as tools/panels, not as primary tabs.

## Information Architecture

### Primary Destinations

These are high-frequency surfaces that deserve persistent bottom-level presence in the default layout:

- `Session`
- `Knowledge`
- `Shortcuts`

### Secondary Destinations / Tools

These stay in `More` because they are lower-frequency, setup-oriented, or utility-oriented:

- `Workspace`
- `Automation`
- `Roles & Skills`
- `Settings`

This rule is intentional: in the default layout, an item should not appear in the same visual class as primary tabs unless it is a high-frequency core workflow.

## Naming Constraint

`Workspace` must refer to one concrete target only. Before implementation, its target must be defined explicitly as one of:

- workspace switcher
- workspace home/details
- workspace settings

The implementation should not proceed with an ambiguous `Workspace` label that maps to different concepts in different places.

## Visual Behavior

### Bottom Tab Bar

- Persistent, always visible in default layout
- Clear active state for the selected primary tab
- `More` uses the same base affordance as the other tabs, but only shows active styling while open

### More Popover

- Compact action list / menu panel
- Each row is visually framed as a secondary action, not a peer primary navigation item
- No row inside `More` should look identical to a selected bottom tab

## Migration From Current UI

For `default` layout only:

- remove the current mixed menu/list that contains `Shortcuts`, `Automation`, `Roles & Skills`, `Knowledge`, and `Settings` together
- promote `Shortcuts` and `Knowledge` into primary navigation
- keep `Automation`, `Roles & Skills`, `Workspace`, and `Settings` in `More`

For `workspace` layout:

- keep the current navigation structure unchanged

## Success Criteria

The redesign is successful if:

- in default layout, users can infer which controls are primary destinations before clicking
- no two visually identical controls in the same menu trigger different navigation categories
- `More` is understood as a container for secondary actions rather than an unstable mixed menu
- workspace layout behavior is unchanged

## Out of Scope

- redesigning workspace layout navigation
- changing the internal behavior of `Automation`, `Roles & Skills`, or `Settings`
- introducing runtime adaptation between default/workspace layouts
- changing feature availability by build config beyond the existing `uiVariant` split
