---
name: nextjs
description: Next.js 15 App Router conventions and patterns
---

# Next.js Standards

These standards apply when the project stack is `nextjs`. All agents and implementations must follow these conventions.

## App Router Structure

- File-based routing in the `app/` directory. Each folder is a route segment.
- **`page.tsx`** -- The UI for a route. Required to make a route publicly accessible.
- **`layout.tsx`** -- Shared UI that wraps child routes. Persists across navigation (no re-render).
- **`loading.tsx`** -- Instant loading UI shown while route content streams in.
- **`error.tsx`** -- Error boundary for a route segment. Must be a Client Component.
- **`not-found.tsx`** -- UI for 404 within the route segment.
- **Route groups** with `(name)` for organizing without affecting URL: `app/(marketing)/about/page.tsx`.
- **Dynamic segments** with `[param]`: `app/orders/[id]/page.tsx`. Access via `params.id`.
- **Catch-all segments** with `[...param]`: `app/docs/[...slug]/page.tsx`.
- **Route handlers** in `route.ts` for API endpoints: `app/api/users/route.ts`.

```
app/
├── layout.tsx              # Root layout (required)
├── page.tsx                # Home page (/)
├── (marketing)/
│   ├── about/page.tsx      # /about
│   └── blog/page.tsx       # /blog
├── dashboard/
│   ├── layout.tsx          # Dashboard layout
│   ├── page.tsx            # /dashboard
│   └── orders/
│       ├── page.tsx        # /dashboard/orders
│       └── [id]/page.tsx   # /dashboard/orders/:id
└── api/
    └── users/route.ts      # API: /api/users
```

## Server vs Client Components

- **Default is Server Component.** Every component in `app/` is a Server Component unless explicitly marked otherwise.
- Add `'use client'` **only** when the component needs: event handlers, hooks (useState, useEffect), browser APIs (window, document), or third-party client libraries.
- Keep Client Components **small and at the leaves.** Push `'use client'` as far down the component tree as possible.
- Pass server data **down as props** to Client Components. Server Components fetch data; Client Components render interactively.
- Do NOT mark layouts as Client Components unless absolutely necessary -- layouts should remain Server Components.

```tsx
// Server Component (default) -- fetches data directly
export default async function OrdersPage() {
    const orders = await db.orders.findMany();
    return (
        <div>
            <h1>Orders</h1>
            <OrderFilters />  {/* Client Component for interactivity */}
            {orders.map((order) => <OrderCard key={order.id} order={order} />)}
        </div>
    );
}

// Client Component -- handles user interaction
'use client';
export function OrderFilters() {
    const [search, setSearch] = useState('');
    return <input value={search} onChange={(e) => setSearch(e.target.value)} />;
}
```

## Data Fetching

### Server Actions

- Use Server Actions for **mutations** (form submissions, data updates, deletions).
- Define with `'use server'` directive at the top of the function or file.
- Call from Client Components via form `action` prop or directly.
- Server Actions run on the server -- safe for database access, secrets, and external APIs.

```tsx
// Pattern: Server Action for form mutation
'use server';

export async function createOrder(formData: FormData) {
    const name = formData.get('name') as string;
    await db.orders.create({ data: { name } });
    revalidatePath('/orders');
    redirect('/orders');
}
```

### Route Handlers

- Use Route Handlers for API endpoints consumed by **external clients** (mobile apps, webhooks, third-party integrations).
- Define in `route.ts` files: export `GET`, `POST`, `PUT`, `DELETE` functions.
- For internal data needs, prefer Server Components with direct data access over Route Handlers.
- Route Handlers receive a `Request` object and return a `Response` or `NextResponse`.

```tsx
// Pattern: Route Handler for external API
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const orders = await db.orders.findMany({ where: { status } });
    return NextResponse.json(orders);
}

export async function POST(request: Request) {
    const body = await request.json();
    const order = await db.orders.create({ data: body });
    return NextResponse.json(order, { status: 201 });
}
```

### Server Component Data Fetching

- Async Server Components can `await` data directly -- no useEffect, no loading states in component code.
- Use `fetch()` with caching options or direct database access (Prisma, Drizzle, raw SQL).
- Co-locate data fetching with the component that uses it.
- Use `Suspense` boundaries to stream content progressively -- wrap slow data fetches in Suspense with a fallback.

## Caching and Revalidation

- `fetch()` cache behavior: `force-cache` (default, static), `no-store` (always fresh).
- **`revalidatePath(path)`** for on-demand revalidation of a specific route.
- **`revalidateTag(tag)`** for on-demand revalidation of tagged fetches.
- **`unstable_cache`** for caching database queries and other non-fetch data sources.
- Static rendering (default) for pages that do not depend on request-time data. Dynamic rendering when using cookies, headers, or searchParams.

```tsx
// Pattern: fetch with revalidation
const orders = await fetch('https://api.example.com/orders', {
    next: { revalidate: 60, tags: ['orders'] },
});

// Pattern: on-demand revalidation in Server Action
'use server';
export async function updateOrder(id: string, data: OrderData) {
    await db.orders.update({ where: { id }, data });
    revalidateTag('orders');
}
```

## Images and Metadata

- Use `next/image` for all images. Provides automatic optimization, lazy loading, and responsive sizing.
- Define page metadata with the `metadata` export or `generateMetadata` for dynamic values.
- Use `next/font` for font optimization. Fonts are self-hosted automatically.

```tsx
// Pattern: metadata export for SEO
export const metadata = {
    title: 'Orders | Dashboard',
    description: 'View and manage your orders',
};

// Pattern: dynamic metadata
export async function generateMetadata({ params }: { params: { id: string } }) {
    const order = await db.orders.findUnique({ where: { id: params.id } });
    return { title: `Order #${order?.number}` };
}
```

## Middleware

- **`middleware.ts`** at the project root (not inside `app/`).
- Use for: auth redirects, locale detection, header manipulation, A/B testing.
- **Matcher config** to target specific routes: `export const config = { matcher: ['/dashboard/:path*'] }`.
- Middleware runs on the **Edge Runtime** -- keep it lightweight.
- Do NOT use middleware for database calls, heavy computation, or session management that requires Node APIs.

```tsx
// Pattern: auth middleware
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('session');
    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/api/protected/:path*'],
};
```

## Testing

- **React Testing Library** + **Jest** or **Vitest** for component and integration tests.
- Test Server Components by rendering their output (they return JSX, testable like any component).
- Test Client Components with user interactions via `userEvent`.
- Test Server Actions as standalone async functions -- call directly, assert database state.
- Mock `next/navigation` (`useRouter`, `usePathname`, `redirect`), `next/headers` (`cookies`, `headers`).

```tsx
import { render, screen } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
    usePathname: () => '/dashboard',
}));

test('renders dashboard page with orders', async () => {
    const page = await DashboardPage(); // Server Component returns JSX
    render(page);
    expect(screen.getByText('Orders')).toBeInTheDocument();
});
```

## Common Pitfalls -- NEVER Rules

- **NEVER** use Pages Router patterns (`getServerSideProps`, `getStaticProps`) in App Router projects.
- **NEVER** add `'use client'` to layouts or pages unless they genuinely need browser APIs or hooks.
- **NEVER** import server-only code in Client Components -- server secrets, database clients, and Node APIs must stay on the server.
- **NEVER** use `useEffect` for data fetching in Server Components -- fetch data directly with `await`.
- **NEVER** put heavy logic in middleware -- it runs on every matched request on the Edge Runtime.
- **NEVER** forget to handle loading and error states -- use `loading.tsx` and `error.tsx` files.
- **NEVER** use `router.push` for simple navigation between pages -- use the `<Link>` component.
- **NEVER** expose server secrets in Client Components -- they are bundled and sent to the browser.
- **NEVER** nest `'use client'` boundaries unnecessarily -- each boundary adds to the client bundle.
- **NEVER** use Route Handlers for data fetching that could be done directly in Server Components.

## Must-Haves

- **TypeScript everywhere.** All files use `.ts` / `.tsx` extensions. Strict mode enabled in `tsconfig.json`. No implicit `any`.
- **Server Components by default.** Every component is a Server Component unless it explicitly requires `'use client'` for hooks, event handlers, or browser APIs.
- **`loading.tsx` and `error.tsx` per route segment.** Every route segment that fetches data must have a `loading.tsx` for streaming fallback and an `error.tsx` for error boundaries. `error.tsx` must be a Client Component.
- **Environment variables via `NEXT_PUBLIC_` prefix.** Client-accessible env vars must start with `NEXT_PUBLIC_`. Server-only env vars (secrets, DB URLs) must never use this prefix. Access via `process.env`.
- **TDD for all features.** Write tests before implementation. Every page, component, Server Action, and Route Handler must have corresponding tests. Follow the Red-Green-Refactor cycle.
- **`not-found.tsx` for custom 404 pages.** Each route segment that resolves dynamic params should include a `not-found.tsx` to handle missing resources gracefully.
- **Strict `next/link` for navigation.** All internal navigation must use the `<Link>` component from `next/link`, never `router.push` for standard page transitions.
- **Zod for runtime validation.** Validate all external input (form data, API payloads, search params) with Zod schemas in Server Actions and Route Handlers.

## Good Practices

- **Data fetching in Server Components.** Fetch data directly in async Server Components using `await`. Co-locate data fetching with the component that renders it. Avoid fetching in Client Components when a Server Component can provide the data as props.
- **Route Handlers for external APIs only.** Use Route Handlers (`route.ts`) for endpoints consumed by external clients (mobile apps, webhooks). For internal data needs, use Server Components with direct database access or Server Actions for mutations.
- **`next/image` for all images.** Use the `Image` component from `next/image` for automatic optimization, lazy loading, responsive sizing, and WebP/AVIF format conversion. Never use raw `<img>` tags.
- **Dynamic imports for heavy client components.** Use `next/dynamic` with `ssr: false` for components that rely on browser APIs or are large and not needed at initial render. This reduces the initial JavaScript bundle.
- **Metadata API for SEO.** Use the `metadata` export for static metadata and `generateMetadata` for dynamic metadata per route. Include `title`, `description`, and Open Graph tags for all public-facing pages.
- **Suspense boundaries for streaming.** Wrap slow data fetches in `<Suspense>` with meaningful fallback UI to enable progressive streaming of page content.
- **Server Actions for mutations.** Use `'use server'` actions for form submissions and data mutations instead of client-side API calls. Pair with `revalidatePath` or `revalidateTag` for cache invalidation.
- **Parallel data fetching.** When a page needs multiple independent data sources, fetch them in parallel with `Promise.all` rather than sequentially to reduce waterfall latency.

## Common Bugs

- **`useState` in Server Components.** Server Components cannot use React hooks (`useState`, `useEffect`, `useReducer`, `useContext`). Using them causes a build error. Move stateful logic to a Client Component with `'use client'`.
- **Missing `'use client'` directive.** Forgetting to add `'use client'` at the top of a component that uses hooks or event handlers results in cryptic server-side errors. The directive must be the very first line of the file (before imports).
- **Cache invalidation confusion.** Forgetting to call `revalidatePath` or `revalidateTag` after mutations causes stale data to persist. Every Server Action that writes data must explicitly invalidate the relevant cache. Conversely, over-revalidating with `revalidatePath('/')` busts the entire cache unnecessarily.
- **Hydration mismatch errors.** Server-rendered HTML must match the initial client render exactly. Common causes: using `Date.now()`, `Math.random()`, or browser-only globals (`window`, `localStorage`) during initial render. Guard with `useEffect` or conditional checks.
- **Accessing `cookies()` or `headers()` outside Server Components or Server Actions.** The `cookies()` and `headers()` functions from `next/headers` only work in Server Components, Server Actions, Route Handlers, and middleware. Calling them in Client Components or shared utility modules throws a runtime error.
- **Async Server Component not awaited.** Forgetting to `await` the result of a Server Component when composing in JSX causes the Promise object to render instead of the component output.
- **Dynamic params type changes in Next.js 15.** In Next.js 15, `params` is now a Promise and must be awaited: `const { id } = await params`. Forgetting to await causes undefined values and subtle bugs.
- **Incorrect `revalidate` export type.** The `revalidate` route segment config must be a number (seconds) or `false`. Passing a string like `'60'` silently fails to enable ISR.

## Anti-Patterns

- **Fetching in Client Components when Server Components can.** Avoid `useEffect` + `fetch` patterns in Client Components for data that could be fetched in a parent Server Component and passed as props. This eliminates client-side loading states and reduces bundle size.
- **Mixing Pages Router with App Router.** Do not use `pages/` directory alongside `app/` directory for the same routes. Choose App Router for all new development. Having both creates confusing routing conflicts and duplicated middleware behavior.
- **Using `getServerSideProps` or `getStaticProps` in App Router.** These are Pages Router APIs and do not work in the `app/` directory. Use async Server Components for data fetching and `generateStaticParams` for static path generation instead.
- **Using `any` type in TypeScript.** Never use `any` as a type annotation. Define proper interfaces, types, and Zod schemas for all data shapes. Use `unknown` with type narrowing when the type is genuinely unknown.
- **Prop drilling through layouts.** Do not pass data through multiple layout levels via props. Use React Context (in a Client Component provider), parallel data fetching in each layout, or shared data fetching utilities to avoid deep prop chains.
- **Creating API routes for internal data fetching.** Do not create Route Handlers (`/api/*`) just to fetch data for your own pages. Server Components can query the database directly -- an extra HTTP hop adds latency and complexity.
- **Giant `'use client'` boundaries.** Do not mark an entire page or large component tree as `'use client'`. Extract only the interactive parts into small Client Components and keep the parent as a Server Component.
- **Storing derived state in `useState`.** Do not duplicate server-fetched data into client state. If the data comes from the server, render it directly. Use `useState` only for genuinely client-side interactive state.

## Standards

- **Lowercase kebab-case for route directories.** All folders in `app/` use lowercase kebab-case: `app/user-settings/`, `app/order-history/`, never `app/UserSettings/` or `app/orderHistory/`.
- **PascalCase for component files.** Non-route component files use PascalCase: `OrderCard.tsx`, `DashboardSidebar.tsx`, `UserAvatar.tsx`. These live in `components/` or co-located with their route.
- **Reserved file names for route segments.** Use only the Next.js convention names for route files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, `template.tsx`, `default.tsx`. Do not invent custom conventions for these roles.
- **Route groups for logical organization.** Use `(groupName)` folders to organize routes without affecting the URL structure: `app/(auth)/login/page.tsx`, `app/(dashboard)/settings/page.tsx`. Route groups keep related routes together while maintaining clean URLs.
- **Parallel routes for simultaneous rendering.** Use `@slotName` folders for parallel routes that render multiple page segments simultaneously: `app/@modal/login/page.tsx`, `app/layout.tsx` receives `modal` as a prop. Use for modals, split views, and conditional rendering of independent sections.
- **Colocation of related files.** Keep components, utilities, types, and tests close to the route that uses them. A route folder can contain non-route files (e.g., `utils.ts`, `types.ts`, `components/`) without affecting routing.
- **Server-only and client-only boundaries.** Use the `server-only` and `client-only` packages to enforce import boundaries. Mark modules that must never cross the server/client boundary to get build-time errors instead of runtime failures.
- **Consistent import aliases.** Configure `@/` as an alias for the project root (usually `src/`) in `tsconfig.json`. All imports use the alias: `import { Button } from '@/components/ui/Button'`, never relative paths like `../../../components/ui/Button`.

## Context7 Instructions

When looking up framework documentation, use these Context7 library identifiers:

- **Next.js:** `vercel/next.js` -- App Router, Server Components, Server Actions, middleware, caching
- **React:** `facebook/react` -- hooks, components, state management (used within Client Components)
- **Testing Library:** `testing-library/react-testing-library` -- render, screen, queries, user events

Always check Context7 for the latest API when working with version-specific features. Training data may be outdated for Next.js 15 specifics.
