---
name: laravel-inertia-react
description: Laravel 12 + Inertia 2 + React 19 + TailwindCSS conventions and patterns
---

# Laravel + Inertia + React Standards

These standards apply when the project stack is `laravel-inertia-react`. All agents and implementations must follow these conventions.

## Laravel 12 Conventions

### Controllers

- **Single responsibility:** Each controller handles one resource or one logical concern.
- **Resource controllers** for CRUD operations: `index`, `create`, `store`, `show`, `edit`, `update`, `destroy`.
- **Form requests** for ALL validation. Never validate inline in controllers.
- Controllers are thin -- they accept a request, delegate to a service, and return a response.
- Return Inertia responses via `Inertia::render('Page/Name', $props)`.

```php
// Pattern: thin controller delegating to service
public function store(StoreOrderRequest $request, OrderService $service): RedirectResponse
{
    $order = $service->create($request->validated());
    return redirect()->route('orders.show', $order);
}
```

### Models

- Define **relationships** explicitly: `hasMany`, `belongsTo`, `belongsToMany`, `morphMany`, etc.
- Use **scopes** for reusable query constraints: `scopeActive`, `scopeByUser`.
- Use **accessors and mutators** via Attribute class for computed or transformed fields.
- Use `$casts` for type casting (dates, enums, JSON, booleans).
- Keep models lean -- no business logic. Models define data shape and relationships.
- Always define `$fillable` or `$guarded` for mass assignment protection.

```php
// Pattern: model with scope, cast, and accessor
protected $casts = [
    'status' => OrderStatus::class,
    'metadata' => 'array',
    'shipped_at' => 'datetime',
];

public function scopeActive(Builder $query): Builder
{
    return $query->where('status', OrderStatus::Active);
}
```

### Routes

- **RESTful naming:** Use resource routes (`Route::resource`) when possible.
- **Route model binding:** Type-hint models in controller methods for automatic resolution.
- **Middleware groups:** Apply auth, verified, and role-based middleware at the route group level.
- **Route naming:** All routes must have names (`->name('orders.index')`).
- Group related routes with prefixes and middleware.
- API routes go in `routes/api.php`; web routes in `routes/web.php`.

### Services

- Extract **business logic** into dedicated service classes (e.g., `OrderService`, `PaymentService`).
- Services are injected into controllers via **dependency injection** (constructor or method injection).
- Services handle orchestration: validation logic, database operations, event dispatching, external API calls.
- Keep services focused -- one service per domain concern.
- Services should be testable in isolation (no HTTP dependencies).

### Events and Listeners

- Use **events** for side effects that should not block the main flow (emails, notifications, audit trails).
- Events are dispatched from services, not controllers. Name as past-tense: `OrderCreated`, `PaymentProcessed`.
- Listeners handle the side effect and can be queued for async processing.

### Migrations

- Migrations are **immutable** once deployed -- never edit a deployed migration.
- Always include `down()` method. Define foreign key constraints with `constrained()`.
- Add indexes for columns used in WHERE clauses, JOINs, and ORDER BY.

### Enums

- Use **PHP 8.1+ backed enums** for fixed sets of values (statuses, types, roles).
- Enums are string-backed for readability. Define in `app/Enums/` directory.

## Inertia 2 Patterns

### Pages

- Inertia pages are **React components** that receive props from Laravel controllers.
- Controllers render pages via `Inertia::render('Orders/Index', ['orders' => $orders])`.
- Page components live in `resources/js/Pages/` with PascalCase directory structure matching the render path.
- Props are typed via function component parameters with TypeScript interfaces.

```tsx
// Pattern: Inertia page component with typed props
interface Props {
    orders: Order[];
    filters: { search: string; status: string };
}

export default function Index({ orders, filters }: Props) {
    return (
        <div>
            <h1>Orders</h1>
            {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
            ))}
        </div>
    );
}
```

### Shared Data

- Use `HandleInertiaRequests` middleware for data shared across all pages.
- Shared data includes: authenticated user, flash messages, app name, permissions.
- Access shared data via `usePage().props`.
- Keep shared data minimal -- only what most pages need.

### Forms

- Use `useForm()` from `@inertiajs/react` for all form submissions.
- `useForm()` provides: reactive data binding, processing state, error handling, dirty tracking.
- Server-side validation errors automatically populate `form.errors`.
- Use `form.post()`, `form.put()`, `form.delete()` for submissions.
- Display validation errors next to form fields.

```tsx
import { useForm } from '@inertiajs/react';

export default function CreateUser() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(route('users.store'));
    }

    return (
        <form onSubmit={submit}>
            <input value={data.name} onChange={(e) => setData('name', e.target.value)} />
            {errors.name && <span>{errors.name}</span>}
            <button type="submit" disabled={processing}>Save</button>
        </form>
    );
}
```

### Navigation

- Use `<Link>` component from `@inertiajs/react` for SPA-style navigation (no full page reload).
- Use `router.visit()` for programmatic navigation.
- Use `router.reload()` for refreshing current page data.
- Preserve scroll position with `preserveScroll` prop on Link.

```tsx
import { Link } from '@inertiajs/react';

<Link href={route('orders.show', order.id)} preserveScroll>
    View Order
</Link>
```

### Partial Reloads

- Use `only` option to reload specific props without full page data refresh.
- Use `except` option to exclude heavy props on subsequent visits.
- Partial reloads reduce bandwidth and improve perceived performance.
- Especially useful for paginated data, search results, and filtered lists.

```ts
import { router } from '@inertiajs/react';

router.reload({ only: ['orders'] });
```

## React 19 Patterns

### Hooks and Components

- **Function components only.** All components are plain functions with TypeScript interfaces for props.

- `useState` for local reactive state. Always use the setter function, never mutate directly.
- `useEffect` for side effects (subscriptions, timers, DOM manipulation). Always return a cleanup function when needed.
- `useMemo` for expensive derived values. Use instead of storing derived state in useState.
- `useCallback` for stable function references passed to child components.
- `useRef` for mutable values that do not trigger re-renders (DOM refs, timers, previous values).
- `use()` hook (React 19) for reading promises and context directly in render.

```tsx
// Pattern: hooks usage in a component
const [search, setSearch] = useState('');
const filteredOrders = useMemo(
    () => orders.filter((o) => o.name.includes(search)),
    [orders, search]
);

useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
}, []);
```

### Props and Custom Hooks

- Destructure props in the function signature. Use `children` for composition. Callback props for child-to-parent communication.
- Extract reusable logic into custom hooks (`useFilters()`, `useDebounce()`). Hooks follow `use*` naming and live in `resources/js/Hooks/`.

### Component Organization

- Components in `resources/js/Components/`, Layouts in `resources/js/Layouts/`, Pages in `resources/js/Pages/`.
- Keep components focused: one concern per component. Extract repeated UI into shared components.

## TailwindCSS Conventions

- Use Tailwind utility classes directly in JSX. This is the primary styling approach.
- Avoid `@apply` in most cases -- extract to React components instead when utility strings repeat.
- Define project design tokens in `tailwind.config.js` under `theme.extend` with semantic naming.
- Mobile-first approach: base styles for mobile, breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) for larger screens.

## Testing Patterns

### PHP Testing (Pest)

- **Feature tests** for HTTP layer: controller actions, middleware, redirects, Inertia responses.
- **Unit tests** for business logic: services, value objects, model scopes.
- Use `assertInertia()` for testing Inertia page responses, props, and component rendering.
- Use model factories for test data setup.
- Database transactions for test isolation (`RefreshDatabase` trait).

```php
it('displays the orders list', function () {
    $orders = Order::factory()->count(3)->create();

    $this->actingAs(User::factory()->create())
        ->get(route('orders.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Orders/Index')
            ->has('orders', 3)
        );
});
```

### React Testing (React Testing Library)

- Test component rendering, user interactions, and callback invocations.
- Use `render()`, `screen`, and `userEvent` from `@testing-library/react`.
- Mock Inertia's `usePage()` and `useForm()` in tests.
- Test custom hooks independently using `renderHook()`.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('submits the form with user data', async () => {
    const user = userEvent.setup();
    render(<CreateUser />);

    await user.type(screen.getByLabelText('Name'), 'Alice');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('users'));
});
```

## Common Pitfalls -- NEVER Rules

- **NEVER** put business logic in controllers -- use service classes.
- **NEVER** use class components -- always use function components.
- **NEVER** mutate state directly -- always use the setter function from useState.
- **NEVER** use useEffect for derived state -- use useMemo instead.
- **NEVER** forget cleanup in useEffect -- return a cleanup function for subscriptions, timers, and abort controllers.
- **NEVER** use index as key in lists that reorder -- use a stable unique identifier.
- **NEVER** skip form request validation in controllers -- every store/update needs a FormRequest.
- **NEVER** use raw SQL without parameterized queries -- use Eloquent or the query builder.
- **NEVER** skip eager loading -- use `with()` to prevent N+1 query problems.
- **NEVER** hardcode configuration values -- use `.env` and `config()`.
- **NEVER** return sensitive data in Inertia props -- filter props to only what the page needs.
- **NEVER** use `any` type in TypeScript -- define proper interfaces and types.

## Must-Haves

These are non-negotiable requirements for every feature implementation.

- **FormRequest for all validation.** Every `store()` and `update()` controller method must use a dedicated FormRequest class. Never validate inline in controllers.
- **Gate::authorize for authorization.** Always use `Gate::authorize()` for permission checks. Never use `$request->user()->can()` + `abort(403)` or `auth()->user()->can()`.
- **TypeScript interfaces for all props.** Every Inertia page component must define a TypeScript interface for its props. No untyped prop objects.
- **useForm() for all form submissions.** Use `useForm()` from `@inertiajs/react` for every form. It provides processing state, error handling, dirty tracking, and reactive data binding out of the box.
- **TDD for all features.** Write failing tests before implementation code. Follow Red-Green-Refactor. Feature tests for HTTP layer (Pest), component tests for UI (React Testing Library).
- **Eager loading for all relationship access.** Use `with()` to prevent N+1 query problems. Never access relationships in loops without eager loading.
- **$fillable or $guarded on every model.** Mass assignment protection is mandatory. Define explicitly which fields are fillable.
- **Route names on every route.** All routes must have explicit names via `->name()` or resource route conventions. No unnamed routes.

## Good Practices

Recommended patterns that improve code quality and maintainability.

- **Thin controllers, fat services.** Controllers accept requests, delegate to service classes, and return responses. Business logic, orchestration, and database operations belong in services.
- **Dependency injection rules for controllers.** If a service is used in 2+ methods, inject via constructor. If used in only 1 method, inject as a method parameter. Services and listeners always use constructor injection.
- **Partial reloads for performance.** Use `router.reload({ only: ['orders'] })` to refresh specific props without full page data reload. Reduces bandwidth and improves perceived performance for paginated data and filtered lists.
- **Custom hooks for reusable logic.** Extract shared component logic into custom hooks (e.g., `useFilters()`, `useDebounce()`, `usePagination()`). Hooks live in `resources/js/Hooks/` and follow `use*` naming.
- **React.memo for expensive child components.** Wrap child components that receive stable props but re-render due to parent updates with `React.memo()` to skip unnecessary re-renders.
- **useMemo for derived state.** Compute filtered/sorted/aggregated data with `useMemo` instead of storing derived values in `useState`. Eliminates stale derived state bugs.
- **Model scopes for reusable queries.** Define query scopes (`scopeActive`, `scopeByUser`, `scopeWithSearch`) on models for reusable, composable query constraints.
- **Events for side effects.** Dispatch events from services for non-blocking side effects (emails, notifications, audit logs). Name events as past-tense (`OrderCreated`, `PaymentProcessed`).
- **Preserve scroll on navigation.** Use `preserveScroll` prop on Inertia `<Link>` components and `router.visit()` calls to maintain scroll position during SPA navigation.

## Common Bugs

Frequent issues encountered in Laravel + Inertia + React projects.

- **N+1 queries.** Accessing relationships in Blade/Inertia props without eager loading. Always use `with()` on queries that pass relationship data to the frontend. Use Laravel Debugbar or `DB::enableQueryLog()` to detect.
- **Direct prop mutation.** Modifying Inertia page props directly instead of copying to local state. Props are read-only snapshots from the server -- always copy to `useState` before mutating.
- **Missing null checks on optional relationships.** Accessing `$model->relationship->field` without checking if the relationship is loaded or exists. Use optional chaining (`?->`) in PHP and (`?.`) in TypeScript.
- **Stale closures in useEffect and useCallback.** Referencing state variables inside closures without including them in the dependency array. Leads to callbacks operating on outdated values. Always list all referenced state in dependency arrays.
- **CSRF token missing on non-Inertia requests.** Inertia handles CSRF automatically, but raw `axios` or `fetch` calls must include the CSRF token via `X-XSRF-TOKEN` header or `csrf_token()`. Results in 419 status code.
- **useEffect for derived state.** Using `useEffect` + `setState` to compute values from props or other state. Use `useMemo` instead -- it is synchronous and avoids the extra render cycle.
- **Missing cleanup in useEffect.** Forgetting to return a cleanup function for subscriptions, timers, and abort controllers. Causes memory leaks and stale updates on unmounted components.
- **Index as key in dynamic lists.** Using array index as the `key` prop in lists that reorder, filter, or insert items. Causes incorrect component reuse and state bugs. Use a stable unique identifier.

## Anti-Patterns

Patterns that must be avoided in all circumstances.

- **Business logic in controllers.** Controllers must not contain domain logic, database queries, or orchestration. Extract to service classes that can be tested in isolation without HTTP.
- **Class components.** Never use React class components. All components must be function components with hooks. Class components are legacy and incompatible with modern React patterns.
- **Inline styles in JSX.** Never use `style={{}}` objects in JSX. Use Tailwind utility classes for all styling. Extract repeated class combinations into React components, not `@apply` directives.
- **Synchronous long-running operations in request cycle.** Never perform email sending, PDF generation, external API calls, or heavy computation synchronously in controllers. Dispatch to queued jobs or listeners.
- **Using `any` type in TypeScript.** Never use `any` as a type annotation. Define proper interfaces and types for all data structures. Use `unknown` with type narrowing when the type is genuinely uncertain.
- **Raw SQL without parameterized queries.** Never concatenate user input into SQL strings. Use Eloquent ORM or the query builder with parameter binding for all database operations.
- **Hardcoded configuration values.** Never hardcode URLs, API keys, feature flags, or environment-specific values. Use `.env` variables accessed via `config()` helper.
- **Returning sensitive data in Inertia props.** Never pass passwords, tokens, internal IDs, or full user records to the frontend. Filter props to only what the page component needs.

## Standards

Naming, structure, and convention standards for consistency across the codebase.

- **PascalCase for React components.** Component files and function names use PascalCase (`OrderCard.tsx`, `UserProfile.tsx`). Pages follow directory structure matching Inertia render paths (`Pages/Orders/Index.tsx`).
- **snake_case for database columns.** All migration column names use snake_case (`created_at`, `user_id`, `invoice_number`). Laravel casts and accessors bridge to frontend conventions.
- **`use` prefix for all custom hooks.** Custom hooks must start with `use` (`useFilters`, `useDebounce`, `usePagination`). This is enforced by React's rules of hooks linter and signals hook behavior to developers.
- **Resource routes for CRUD.** Use `Route::resource()` for standard CRUD operations. Only override with explicit routes when non-standard behavior is needed. Resource routes enforce RESTful naming and provide consistent route names.
- **camelCase for TypeScript variables and functions.** All variables, function names, and object keys in TypeScript/React code use camelCase. Interface names use PascalCase.
- **PascalCase for PHP classes, camelCase for methods.** PHP classes (`OrderService`, `StoreOrderRequest`) use PascalCase. Methods (`getActiveOrders`, `calculateTotal`) use camelCase. Follow PSR-12.
- **Kebab-case for route URIs.** Multi-word route URIs use kebab-case (`/storage-units`, `/payment-links`). Route names use dot notation (`storage-units.index`).
- **Feature tests in `tests/Feature/`, unit tests in `tests/Unit/`.** Feature tests cover HTTP request/response cycles. Unit tests cover isolated business logic in services and value objects.

## Context7 Instructions

When looking up framework documentation, use these Context7 library identifiers:

- **Laravel:** `laravel/framework` -- controllers, routing, Eloquent, validation, events, middleware
- **Inertia:** `inertiajs/inertia` -- pages, forms, shared data, navigation, partial reloads
- **React:** `facebook/react` -- hooks, components, lifecycle, state management
- **Pest:** `pestphp/pest` -- test syntax, assertions, datasets, hooks
- **TailwindCSS:** `tailwindlabs/tailwindcss` -- utility classes, configuration, responsive design

Always check Context7 for the latest API when working with version-specific features. Training data may be outdated for Laravel 12, Inertia 2, and React 19 specifics.
