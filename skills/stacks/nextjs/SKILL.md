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

## Context7 Instructions

When looking up framework documentation, use these Context7 library identifiers:

- **Next.js:** `vercel/next.js` -- App Router, Server Components, Server Actions, middleware, caching
- **React:** `facebook/react` -- hooks, components, state management (used within Client Components)
- **Testing Library:** `testing-library/react-testing-library` -- render, screen, queries, user events

Always check Context7 for the latest API when working with version-specific features. Training data may be outdated for Next.js 15 specifics.
