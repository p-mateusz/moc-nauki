## Problem

The dashboard (`/dashboard`, every tab) can be scrolled past the top and bottom edges of the screen. The landing page does not have this issue.

## Root cause

`.moc-dashboard` is sized at `height: 100dvh` and is supposed to fill exactly the viewport. But it sits inside the global layout from `src/index.css`:

- `body` has `padding-top: max(12px, env(safe-area-inset-top))` and `padding-bottom: max(12px, env(safe-area-inset-bottom))` plus `overflow-y: auto`.
- `#root` has `min-height: 100vh`.

So the total page height becomes `100dvh + body top padding + body bottom padding`, which is larger than the viewport — body itself scrolls, letting the user drag the whole dashboard up and down past the edges. On the landing page this is invisible because content is taller than the viewport anyway and the layout doesn't try to be exactly one screen tall.

Additionally `.moc-dashboard` re-applies `padding-top/bottom: env(safe-area-inset-*)`, so safe-area insets are effectively doubled.

## Fix (CSS-only, scoped to the dashboard route)

In `src/pages/MocDashboard.css`:

1. When `.moc-dashboard` is mounted, neutralize the outer scroll/padding so the dashboard owns the full viewport:
   ```css
   html:has(.moc-dashboard),
   body:has(.moc-dashboard) {
     height: 100dvh;
     overflow: hidden;
     padding: 0;
   }
   body:has(.moc-dashboard) #root {
     min-height: 0;
     height: 100dvh;
   }
   ```
2. Keep safe-area insets only on `.moc-dashboard` itself (already there via `padding-top/bottom: env(safe-area-inset-*)` + `box-sizing: border-box`) so notch/home-indicator areas are still respected — but they are no longer added on top of body padding.
3. Leave `.md-content` / inner scroll containers untouched — internal scrolling of the calendar, notes list, etc. continues to work.

## Why this is safe

- The rule is scoped with `:has(.moc-dashboard)`, so the landing page, auth pages, and other routes keep their current body scroll behavior.
- All current `min-h-screen` / inner `overflow-y: auto` regions inside the dashboard already handle their own scroll, so locking the outer body scroll only removes the unwanted "drag the whole UI off-screen" behavior.

## Files touched

- `src/pages/MocDashboard.css` — add the scoped reset block near the top, next to the existing `.moc-dashboard` rule.

No JS, no component, no business-logic changes.
