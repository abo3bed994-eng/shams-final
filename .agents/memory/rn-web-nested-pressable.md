---
name: RN Web nested Pressable click bubbling
description: Why an inner Pressable's tap can trigger an outer navigating Pressable on React Native Web, and how to structure overlays.
---

On React Native **Web** (Expo web, the iframe preview), `Pressable` renders to DOM
elements whose click events **bubble**. A small action button (e.g. a favorite
heart) nested INSIDE a larger navigating `Pressable` (a card whose `onPress`
navigates) will, when tapped, bubble its click up to the card and fire the card's
navigation — instead of (or in addition to) its own handler. On native this is
usually fine, so the bug only reproduces on web.

**Symptom:** the inner control "does nothing visible" — e.g. a favorite heart that
never turns red — because the tap navigates away before/instead of running the
inner handler.

**Fix / rule:** do NOT nest an interactive `Pressable` inside another `Pressable`
that has its own `onPress`. Make the common ancestor a plain non-pressable `View`,
put navigation on one child Pressable, and render the action button as a **sibling**
overlay (absolutely positioned), not a descendant. With a non-clickable common
ancestor, bubbling can't reach a navigation handler.

**Also:** bind toggle-state colors to reactive context state (e.g.
`favorites.includes(id)`), not to a ref-backed helper, so the visual updates on
re-render.
