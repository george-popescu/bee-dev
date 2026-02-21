---
name: laravel-inertia-vue
description: Laravel 12 + Inertia 2 + Vue 3.5 + TailwindCSS conventions and patterns
---

# Laravel + Inertia + Vue Standards

These standards apply when the project stack is `laravel-inertia-vue`. All agents and implementations must follow these conventions.

## Laravel 12 Conventions

### Controllers

- **Single responsibility:** Each controller handles one resource or one logical concern.
- **Resource controllers** for CRUD operations: `index`, `create`, `store`, `show`, `edit`, `update`, `destroy`.
- **Form requests** for ALL validation. Never validate inline in controllers.
- Controllers are thin -- they accept a request, delegate to a service, and return a response.
- NEVER put business logic in controllers. Controllers orchestrate; services implement.
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

- Use **events** for side effects that should not block the main flow.
- Examples: sending emails, dispatching notifications, logging audit trails, syncing external services.
- Events are dispatched from services, not controllers.
- Listeners handle the side effect and can be queued for async processing.
- Name events as past-tense actions: `OrderCreated`, `UserRegistered`, `PaymentProcessed`.

### Migrations

- Migrations are **immutable** once deployed -- never edit a deployed migration.
- Use descriptive migration names: `create_orders_table`, `add_status_to_orders_table`.
- Always include `down()` method for rollback support.
- Define foreign key constraints explicitly with `constrained()`.
- Add indexes for columns used in WHERE clauses, JOINs, and ORDER BY.

### Enums

- Use **PHP 8.1+ backed enums** for fixed sets of values (statuses, types, roles).
- Enums are backed by strings for readability in the database.
- Define enums in `app/Enums/` directory.

## Inertia 2 Patterns

### Pages

- Inertia pages are **Vue components** that receive props from Laravel controllers.
- Controllers render pages via `Inertia::render('Orders/Index', ['orders' => $orders])`.
- Page components live in `resources/js/Pages/` with PascalCase directory structure matching the render path.
- Props are typed using `defineProps<{ orders: Order[] }>()`.

### Shared Data

- Use `HandleInertiaRequests` middleware for data shared across all pages.
- Shared data includes: authenticated user, flash messages, app name, permissions.
- Access shared data via `usePage().props`.
- Keep shared data minimal -- only what most pages need.

### Forms

- Use `useForm()` helper for all form submissions.
- `useForm()` provides: reactive data binding, processing state, error handling, dirty tracking.
- Server-side validation errors automatically populate `form.errors`.
- Use `form.post()`, `form.put()`, `form.delete()` for submissions.
- Display validation errors next to form fields.

```vue
<script setup>
const form = useForm({
    name: '',
    email: '',
});

function submit() {
    form.post(route('users.store'));
}
</script>
```

### Navigation

- Use `<Link>` component for SPA-style navigation (no full page reload).
- Use `router.visit()` for programmatic navigation.
- Use `router.reload()` for refreshing current page data.
- Preserve scroll position with `preserve-scroll` prop on Link.

### Partial Reloads

- Use `only` option to reload specific props without full page data refresh.
- Use `except` option to exclude heavy props on subsequent visits.
- Partial reloads reduce bandwidth and improve perceived performance.
- Especially useful for paginated data, search results, and filtered lists.

```js
router.reload({ only: ['orders'] });
```

## Vue 3.5 Composition API

### Script Setup

- `<script setup>` is the ONLY accepted syntax. NEVER use Options API.
- All components use `<script setup lang="ts">` with TypeScript.
- Imports, props, emits, and reactive state are declared at the top level.

### Reactive State

- `ref()` for primitive reactive values.
- `reactive()` for objects (use sparingly -- prefer `ref()` for clarity).
- `computed()` for derived values that depend on reactive state.
- `watch()` and `watchEffect()` for side effects on state changes.

### Props and Emits

- `defineProps<{ title: string; items: Item[] }>()` with TypeScript interface.
- `defineEmits<{ (e: 'update', id: number): void }>()` with typed events.
- `defineModel()` for two-way binding (v-model support).
- NEVER mutate props directly -- emit events to parent instead.

### Composables

- Extract reusable logic into composables: `useFilters()`, `useDebounce()`, `usePagination()`.
- Composables follow `use*` naming convention.
- Composables live in `resources/js/Composables/` directory.
- A composable returns reactive state and functions -- it is a self-contained unit of logic.

### Component Organization

- Components live in `resources/js/Components/` with PascalCase naming.
- Layouts live in `resources/js/Layouts/`.
- Pages live in `resources/js/Pages/` mirroring route structure.
- Keep components focused: one concern per component.
- Extract repeated UI patterns into shared components.

## TailwindCSS Conventions

### Utility-First

- Use Tailwind utility classes directly in templates. This is the primary styling approach.
- Avoid `@apply` in most cases -- it defeats the purpose of utility-first CSS.
- `@apply` is acceptable ONLY in base styles for elements that cannot have classes (e.g., prose content).

### Design Tokens

- Define project design tokens in `tailwind.config.js` under `theme.extend`.
- Use semantic naming for colors: `primary`, `secondary`, `success`, `danger`, `warning`.
- Define spacing, font sizes, and breakpoints consistent with the design system.

### Component Extraction

- When a utility string exceeds ~5 classes and repeats across components, extract to a Vue component (not a CSS class).
- Prefer component extraction over CSS extraction -- keeps styles colocated with behavior.

### Responsive Design

- Mobile-first approach: base styles apply to mobile, use breakpoints for larger screens.
- Breakpoint order: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px), `2xl:` (1536px).
- Test all pages at each breakpoint.

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

### Vue Testing (Vitest)

- Test component rendering, user interactions, and emitted events.
- Use `@vue/test-utils` with `mount()` or `shallowMount()`.
- Mock Inertia's `usePage()` and `useForm()` in tests.
- Test composables independently by calling them in a test setup.

## Common Pitfalls -- NEVER Rules

- **NEVER** put business logic in controllers -- use service classes.
- **NEVER** use Options API -- always Composition API with `<script setup>`.
- **NEVER** mutate props directly in Vue components -- emit events instead.
- **NEVER** skip form request validation in controllers -- every store/update needs a FormRequest.
- **NEVER** use raw SQL without parameterized queries -- use Eloquent or the query builder.
- **NEVER** skip eager loading -- use `with()` to prevent N+1 query problems.
- **NEVER** use `@apply` for component styling -- extract to Vue components instead.
- **NEVER** hardcode configuration values -- use `.env` and `config()`.
- **NEVER** return sensitive data in Inertia props -- filter props to only what the page needs.
- **NEVER** use `any` type in TypeScript -- define proper interfaces and types.

## Context7 Instructions

When looking up framework documentation, use these Context7 library identifiers:

- **Laravel:** `laravel/framework` -- controllers, routing, Eloquent, validation, events, middleware
- **Inertia:** `inertiajs/inertia` -- pages, forms, shared data, navigation, partial reloads
- **Vue:** `vuejs/core` -- Composition API, reactivity, components, lifecycle hooks
- **Pest:** `pestphp/pest` -- test syntax, assertions, datasets, hooks
- **TailwindCSS:** `tailwindlabs/tailwindcss` -- utility classes, configuration, responsive design

Always check Context7 for the latest API when working with version-specific features. Training data may be outdated for Laravel 12, Inertia 2, and Vue 3.5 specifics.
