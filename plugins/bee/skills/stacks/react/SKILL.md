---
name: react
description: React 19 standalone conventions and patterns
---

# React Standards

These standards apply when the project stack is `react`. All agents and implementations must follow these conventions.

## Component Architecture

- **Function components only.** All components are plain functions with TypeScript interfaces for props.
- **Single responsibility:** Each component does one thing. If a component handles form state AND layout AND API calls, split it.
- **Composition over inheritance:** Use children, render props, and compound components -- never extend component classes.
- **Props design:** Destructure in the function signature. Provide defaults via destructuring. Keep prop interfaces narrow.
- **Children pattern:** Use `children` prop for wrapper components (layouts, providers, modals).
- **Compound components:** Group related components under a namespace (`Tabs`, `Tabs.List`, `Tabs.Panel`).

```tsx
// Pattern: component with typed props and composition
interface CardProps {
    title: string;
    variant?: 'default' | 'outlined';
    children: React.ReactNode;
}

export function Card({ title, variant = 'default', children }: CardProps) {
    return (
        <div className={`card card--${variant}`}>
            <h2>{title}</h2>
            {children}
        </div>
    );
}
```

## Hooks

### Core Hooks

- `useState` for local reactive state. Always use the setter function, never mutate directly.
- `useEffect` for side effects (subscriptions, timers, DOM manipulation). Always return a cleanup function when needed.
- `useContext` for consuming context values. Pair with a custom hook: `useAuth()` wraps `useContext(AuthContext)`.
- `useReducer` for complex state with multiple sub-values or when next state depends on previous.
- `useMemo` for expensive derived values. Use instead of storing derived state in useState.
- `useCallback` for stable function references passed to child components.
- `useRef` for mutable values that do not trigger re-renders (DOM refs, timers, previous values).
- `use()` hook (React 19) for reading promises and context directly in render.

### Rules of Hooks

- Call hooks at the **top level** only -- never inside conditions, loops, or nested functions.
- Call hooks only from **React function components** or **custom hooks**.

### Custom Hooks

- Extract reusable logic into custom hooks: `useFilters()`, `useDebounce()`, `usePagination()`, `useLocalStorage()`.
- Custom hooks follow `use*` naming convention and live in `src/hooks/` directory.
- A custom hook returns state and functions -- it is a self-contained unit of logic.

```tsx
// Pattern: custom hook with cleanup
function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}
```

## State Management

### Local State

- `useState` for component-level state. Keep state as close to where it is used as possible.
- Lift state up only when two siblings need the same data. Avoid premature lifting.

### Complex State

- `useReducer` when state has multiple sub-values or transitions follow a defined pattern.
- Define typed actions: `type Action = { type: 'add'; item: Item } | { type: 'remove'; id: string }`.

### Shared State

- **Context API** for app-wide values: theme, auth, locale. Create a provider and a custom hook.
- Avoid prop drilling by colocating state or using context. Composition (passing components as props) also solves drilling.

### External Stores

- **Zustand** for lightweight global state with minimal boilerplate.
- **Jotai** for atomic state when fine-grained reactivity is needed.
- Choose based on project needs -- neither is prescribed. Both integrate with React DevTools.

```tsx
// Pattern: context with custom hook
const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
```

## Routing

- **React Router v7** with `createBrowserRouter` and `RouterProvider`.
- Use `loader` functions for data fetching before route renders.
- Use `action` functions for form submissions and mutations.
- Nested routes with `<Outlet />` for shared layouts.
- Protected routes: check auth in loader, redirect if unauthorized.

```tsx
// Pattern: router with loader and protected route
const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            { index: true, element: <Home />, loader: homeLoader },
            { path: 'orders', element: <Orders />, loader: ordersLoader },
            { path: 'orders/:id', element: <OrderDetail />, loader: orderLoader },
        ],
    },
]);
```

## Build and Tooling

- **Vite** as the build tool and dev server.
- Environment variables use `VITE_` prefix: `import.meta.env.VITE_API_URL`.
- Path aliases configured in `vite.config.ts` under `resolve.alias` (e.g., `@/` maps to `src/`).
- Dev server proxy for API calls: configure `server.proxy` in Vite config to avoid CORS in development.

## Testing

- **React Testing Library** + **Vitest** for all component and hook tests.
- Use `render()`, `screen`, and `userEvent` from `@testing-library/react`.
- **Test user behavior, not implementation details.** Query by role, label, text -- not by class name or test ID.
- Mock API calls with **MSW** (Mock Service Worker) or `vi.mock()`.
- Test custom hooks with `renderHook()` from `@testing-library/react`.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('filters orders by search term', async () => {
    const user = userEvent.setup();
    render(<OrderList orders={mockOrders} />);

    await user.type(screen.getByRole('searchbox'), 'shipped');

    expect(screen.getByText('Order #123 - Shipped')).toBeInTheDocument();
    expect(screen.queryByText('Order #456 - Pending')).not.toBeInTheDocument();
});
```

## Common Pitfalls -- NEVER Rules

- **NEVER** use class components -- always use function components with hooks.
- **NEVER** mutate state directly -- always use the setter function from useState or dispatch from useReducer.
- **NEVER** use useEffect for derived state -- use useMemo instead.
- **NEVER** forget cleanup in useEffect -- return a cleanup function for subscriptions, timers, and abort controllers.
- **NEVER** use index as key in lists that reorder -- use a stable unique identifier.
- **NEVER** call hooks conditionally or inside loops -- hooks must be at the top level of the component.
- **NEVER** store derived state in useState -- compute it with useMemo from the source state.
- **NEVER** use `any` type in TypeScript -- define proper interfaces and types.
- **NEVER** fetch data in useEffect without an abort controller -- always handle cleanup to prevent state updates on unmounted components.
- **NEVER** create inline objects or arrays in JSX props -- they create new references on every render, causing unnecessary child re-renders.

## Context7 Instructions

When looking up framework documentation, use these Context7 library identifiers:

- **React:** `facebook/react` -- hooks, components, lifecycle, state management, concurrent features
- **React Router:** `remix-run/react-router` -- routing, loaders, actions, navigation
- **Vitest:** `vitest-dev/vitest` -- test runner, assertions, mocking, configuration
- **Testing Library:** `testing-library/react-testing-library` -- render, screen, queries, user events

Always check Context7 for the latest API when working with version-specific features. Training data may be outdated for React 19 specifics.
