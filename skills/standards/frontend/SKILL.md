---
name: frontend-standards
description: Universal frontend standards -- component architecture, accessibility, responsive design, CSS methodology
---

# Frontend Standards

These standards apply to ALL frontend code regardless of framework (Vue, React, React Native). They define stack-agnostic principles -- the "what" and "why" of frontend quality. Framework-specific "how" belongs in stack skills.

## Component Architecture

### Single Responsibility

- One component, one purpose. A component that fetches data, transforms it, and renders a complex layout is doing too much.
- If a component needs a comment to explain what it does, it should be split into smaller components.
- Aim for components that are 50-150 lines. Over 200 lines is a signal to decompose.

### Reusability

- Extract repeated UI patterns into shared components after seeing the pattern 3 times (Rule of Three).
- Shared components accept props for customization -- they are configurable, not hardcoded.
- Shared components live in a dedicated directory (e.g., `components/shared/` or `components/ui/`).

### Composition Over Inheritance

- Build complex UIs by composing smaller components, not by extending base components.
- Use slots/children for content injection -- parent controls content, child controls layout.
- Avoid deep component hierarchies. Flatten when composition achieves the same result.

### Props Design

- Minimal props: only what the component needs. Avoid passing entire objects when only one field is used.
- Well-typed: define explicit types/interfaces for all props. No `any` or untyped props.
- Sensible defaults: optional props have reasonable default values.
- Boolean props default to `false` -- presence means true (`<Modal visible>` not `<Modal visible={true}>`).

### State Colocation

- Keep state as close to where it is used as possible. Do not lift state higher than necessary.
- If only one component uses a piece of state, that state belongs in that component.
- Lift state only when siblings need to share it -- lift to the nearest common ancestor.
- Global state is for truly global concerns: authenticated user, theme, locale.

### Presentational vs Container

- **Presentational components** receive data via props, render UI, emit events. No data fetching, no side effects.
- **Container components** (or hooks/composables) handle data fetching, state management, and business logic.
- This separation makes presentational components reusable and testable without mocking data sources.

## Accessibility (a11y)

### Semantic Structure

- Use appropriate semantic elements: buttons for actions, links for navigation, headings for hierarchy.
- Heading levels must be sequential (`h1` then `h2`, never skip to `h3`). One `h1` per page/screen.
- Lists for groups of related items. Tables for tabular data. Forms with labels for inputs.

### Keyboard Navigation

- All interactive elements must be keyboard accessible: focusable, activatable with Enter/Space.
- Tab order follows visual order. Use natural DOM order, avoid manual `tabIndex` values above 0.
- Trap focus in modals and dialogs -- Tab cycles within the modal, not behind it.
- Restore focus to the triggering element when a modal closes.

### ARIA

- Prefer native semantics over ARIA. A `<button>` is better than `<div role="button">`.
- Use ARIA when native semantics are insufficient: `aria-label` for icon-only buttons, `aria-describedby` for help text, `aria-expanded` for collapsible sections.
- `aria-live="polite"` for dynamic content updates that screen readers should announce.
- Never use `aria-hidden="true"` on focusable elements.

### Color and Contrast

- **WCAG AA minimum:** 4.5:1 contrast ratio for normal text, 3:1 for large text (18px+ or 14px+ bold).
- Never convey information by color alone -- use icons, patterns, or text labels alongside color.
- Test with color blindness simulators. Red/green distinctions are invisible to ~8% of males.

### Touch Targets

- Minimum touch target size: 44x44px for mobile interfaces.
- Adequate spacing between touch targets to prevent accidental taps.
- Larger targets for primary actions (buttons, CTAs).

## Responsive Design

### Mobile-First

- Start with the mobile layout as the base. Add complexity for larger screens via breakpoints.
- Mobile-first ensures the essential experience works on the smallest screens.
- Progressive enhancement: mobile gets the core, desktop gets the enhancements.

### Breakpoint Strategy

- Use consistent, named breakpoints across the project: `sm`, `md`, `lg`, `xl`.
- Define breakpoints in a central location (design tokens, config). Do not hardcode pixel values inline.
- Design for breakpoint ranges, not exact screen sizes. Content should be fluid between breakpoints.

### Fluid Layouts

- Avoid fixed widths. Use percentages, `flex`, and `grid` for layouts that adapt to container size.
- Set `max-width` on content containers to prevent lines from becoming unreadably long on wide screens.
- Use relative units (`rem`, `em`) for spacing and typography to respect user font size preferences.

### Responsive Media

- Use `srcset` / `<picture>` for resolution-appropriate images on web.
- Lazy load images below the fold for performance.
- Responsive video and embedded content: maintain aspect ratio with aspect-ratio or padding technique.

### Content Priority

- Show essential content first on all screen sizes. Progressive disclosure for secondary content.
- Navigation should be accessible on all screen sizes -- collapse to hamburger/bottom tabs on mobile.
- Critical actions (CTA buttons) must be visible without scrolling on mobile.

## CSS Methodology

### Design Tokens

- Centralize visual design decisions as tokens: colors, spacing scale, typography scale, border radius, shadows.
- Use CSS custom properties or framework config (Tailwind `theme.extend`) for tokens.
- Semantic token names: `--color-primary`, `--spacing-md`, `--font-size-heading`. Not `--blue-500` or `--size-16`.
- All components reference tokens, never raw values. Changing a token updates the entire UI.

### Utility-First

- Prefer utility classes (Tailwind CSS) over custom CSS when the framework supports it.
- Utility-first reduces CSS file size, eliminates naming debates, and colocates styles with markup.
- For projects without utility frameworks, use a consistent methodology (BEM, CSS Modules).

### Component Extraction

- When a utility combination repeats across components, extract to a reusable component (not a CSS class).
- Component extraction > CSS extraction: styles stay colocated with behavior and markup.
- Document extracted components in a shared component library or storybook.

### Avoid

- **!important** -- signals a specificity problem. Fix the cascade instead.
- **Deep nesting** -- max 3 levels. Flat selectors are more maintainable and performant.
- **Magic numbers** -- use design tokens for spacing, sizing, and timing values.
- **Unscoped global styles** -- global styles should only set resets and base typography. Component styles must be scoped.
- **Inline style objects in render** -- creates new references on every render, causing unnecessary re-renders in virtual DOM frameworks.

## Performance

### Rendering

- Minimize re-renders. Memoize expensive computations and stable references where the framework allows.
- Virtualize long lists (100+ items). Rendering all items at once causes jank and memory pressure.
- Avoid layout thrashing: batch DOM reads before DOM writes. Do not interleave reads and writes.

### Loading

- Lazy load routes and heavy components. The initial bundle should contain only what the first screen needs.
- Optimize images: compress, use modern formats (WebP, AVIF), and size appropriately for display dimensions.
- Minimize third-party scripts. Each script adds to parse time and competes for the main thread.
- Measure performance with real devices, not just desktop dev tools. Mobile CPUs are significantly slower.
