---
name: nestjs
description: NestJS backend conventions and patterns
---

# NestJS Standards

These standards apply when the project stack is `nestjs`. All agents and implementations must follow these conventions. This is a BACKEND-ONLY stack -- no frontend conventions.

## Module Architecture

- **Modules** are the organizational unit of a NestJS application. Every feature gets its own module.
- Root `AppModule` imports all feature modules. Feature modules group related controllers, services, and providers.
- **Shared modules** encapsulate cross-cutting concerns (logging, config, database). Export providers that other modules need.
- `@Module()` decorator defines four arrays: `imports` (other modules), `controllers` (route handlers), `providers` (services/repositories), `exports` (providers available to importing modules).
- Use `forRoot()` / `forRootAsync()` for dynamic module configuration (database, config).
- Keep modules cohesive -- one domain concern per module.

```typescript
// Pattern: feature module
@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

## Controllers

- `@Controller('resource')` sets the route prefix. Use plural nouns for REST resources.
- HTTP method decorators: `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()`.
- Parameter decorators: `@Body()`, `@Param()`, `@Query()`, `@Headers()`, `@Req()`.
- Return **DTOs**, not entities. Controllers transform service output into API-safe responses.
- Controllers are thin -- they accept a request, delegate to a service, and return a response.
- Use `@HttpCode()` to set non-default status codes (e.g., `@HttpCode(204)` for delete).

```typescript
// Pattern: thin controller delegating to service
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
    return this.ordersService.findOne(id);
  }
}
```

## Services

- `@Injectable()` marks classes for dependency injection. All business logic lives in services.
- **Constructor injection** for dependencies. Declare dependencies as `private readonly`.
- One service per domain concern (`OrdersService`, `PaymentsService`, `NotificationsService`).
- Services should be framework-independent -- testable without bootstrapping NestJS.
- Services throw domain exceptions (`NotFoundException`, `BadRequestException`) for error flows.
- Keep services focused: if a service grows beyond 300 lines, split by sub-concern.

```typescript
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly paymentsService: PaymentsService,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
    const order = this.orderRepo.create(dto);
    const saved = await this.orderRepo.save(order);
    return OrderResponseDto.fromEntity(saved);
  }
}
```

## Validation

- **class-validator** + **class-transformer** for DTO validation. Install both as dependencies.
- Apply `ValidationPipe` globally in `main.ts` with `whitelist: true` and `transform: true`.
- DTOs use decorator constraints: `@IsString()`, `@IsEmail()`, `@IsOptional()`, `@MinLength()`, `@IsEnum()`, `@IsUUID()`.
- Nested DTOs use `@ValidateNested()` with `@Type(() => NestedDto)` for proper transformation.
- Separate DTOs for create, update, and response. Update DTOs extend create with `PartialType()`.

```typescript
// Pattern: DTO with validation decorators
export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  customerName: string;

  @IsEmail()
  customerEmail: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus = OrderStatus.PENDING;

  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
```

## Guards and Interceptors

- **Guards** handle authentication and authorization. Apply with `@UseGuards()`.
- `canActivate()` returns a boolean or throws an `UnauthorizedException` / `ForbiddenException`.
- Implement `AuthGuard` for JWT/session validation, `RolesGuard` for role-based access.
- **Interceptors** handle cross-cutting concerns: response transformation, logging, caching, timing.
- Interceptors use the `tap()` or `map()` RxJS operators to transform the response stream.
- **Exception filters** catch and format errors. Use `@Catch()` to handle specific exception types.
- Apply guards/interceptors globally, at controller level, or at route level as appropriate.

```typescript
// Pattern: role-based guard
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) return true;
    const request = context.switchToHttp().getRequest();
    return roles.includes(request.user?.role);
  }
}
```

## Database Integration

### TypeORM

- Entities use `@Entity()`, `@Column()`, `@PrimaryGeneratedColumn()` decorators.
- Use `TypeOrmModule.forFeature([Entity])` in feature modules to register repositories.
- Inject repositories with `@InjectRepository(Entity)`.
- Relations: `@OneToMany()`, `@ManyToOne()`, `@ManyToMany()`, `@JoinColumn()`.
- Migrations via TypeORM CLI: `typeorm migration:generate`, `typeorm migration:run`.

```typescript
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerName: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Prisma

- Define schema in `schema.prisma`. Generate client with `npx prisma generate`.
- Create `PrismaService` as an `@Injectable()` that extends `PrismaClient` and implements `OnModuleInit`.
- Register `PrismaService` in a shared `PrismaModule` and export it.
- Use typed queries: `prisma.order.findMany()`, `prisma.order.create()`.
- Migrations via Prisma CLI: `npx prisma migrate dev`, `npx prisma migrate deploy`.

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

## Testing

- **Jest** with `@nestjs/testing` for all tests.
- `Test.createTestingModule()` bootstraps a testing module with controlled providers.
- **Unit tests:** Provide mock services via `{ provide: Service, useValue: mockService }`.
- **Integration tests:** Use `supertest` with `app.getHttpServer()` for HTTP-level testing.
- Test services independently from controllers. Test controllers independently from services.
- Mock external dependencies (database, third-party APIs) in unit tests.
- Use real database in integration tests with test containers or in-memory DB.

```typescript
// Pattern: unit test with mocked dependency
describe('OrdersService', () => {
  let service: OrdersService;
  let repo: jest.Mocked<Repository<Order>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: { create: jest.fn(), save: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersService);
    repo = module.get(getRepositoryToken(Order));
  });

  it('creates an order and returns a response DTO', async () => {
    const dto = { customerName: 'Jane', customerEmail: 'jane@example.com', items: [] };
    repo.create.mockReturnValue(dto as any);
    repo.save.mockResolvedValue({ id: 'uuid-1', ...dto } as any);

    const result = await service.create(dto as CreateOrderDto);
    expect(result).toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });
});
```

## Common Pitfalls -- NEVER Rules

- **NEVER** put business logic in controllers -- controllers delegate to services.
- **NEVER** import entities directly in controllers -- access data through services.
- **NEVER** skip validation pipes on POST/PUT/PATCH endpoints -- always validate input DTOs.
- **NEVER** use raw SQL queries -- use TypeORM repositories or Prisma client.
- **NEVER** forget to export providers from shared modules -- importing modules cannot access unexported providers.
- **NEVER** inject request-scoped providers into singleton services without understanding scope -- causes runtime errors.
- **NEVER** use synchronous file I/O in controllers or services -- use `fs/promises` for async operations.
- **NEVER** skip error handling -- use exception filters to catch and format errors consistently.
- **NEVER** expose entity/ORM objects in API responses -- always map to response DTOs.
- **NEVER** forget to register modules in `AppModule` imports -- unregistered modules are invisible to the app.

## Must-Haves

- **`@Injectable()` on every service and provider.** All classes participating in dependency injection must be decorated with `@Injectable()`. Missing it causes a runtime DI error that is not caught at compile time.
- **`ValidationPipe` applied globally.** Register `ValidationPipe` with `whitelist: true` and `transform: true` in `main.ts` via `app.useGlobalPipes()`. Every POST/PUT/PATCH endpoint relies on this for input sanitization.
- **Response DTOs for all API responses.** Never return raw entities from controllers. Map entity data into dedicated response DTO classes to control the API surface and avoid leaking database internals.
- **Feature modules for every domain.** Each domain concern (users, orders, payments) gets its own module. The module groups its controller, service, and providers. Register all feature modules in `AppModule.imports`.
- **Constructor injection for all dependencies.** Declare dependencies as `private readonly` constructor parameters. Never use `ModuleRef.get()` or service locator patterns for standard dependencies.
- **`@Module()` exports array for shared providers.** If a module's service is consumed by other modules, it must appear in the `exports` array. Importing a module without the provider exported results in a silent injection failure.
- **TypeORM entity registration per feature module.** Use `TypeOrmModule.forFeature([Entity])` in each feature module that needs repository access. Forgetting this causes "No repository was found" errors.

## Good Practices

- **Separate DTOs for create, update, and response.** `CreateOrderDto`, `UpdateOrderDto` (via `PartialType(CreateOrderDto)`), and `OrderResponseDto` keep validation and serialization concerns isolated.
- **Use `PartialType()` and `PickType()` for update DTOs.** Inherit from the create DTO with `PartialType()` to make all fields optional. Use `PickType()` when only specific fields should be updatable.
- **Apply guards at the controller level.** Use `@UseGuards(AuthGuard)` on the controller class rather than individual routes when all routes require authentication. Route-level guards for fine-grained access (e.g., `@Roles('admin')`).
- **Register exception filters globally or per controller.** Use `@Catch()` exception filters to standardize error responses. A global `AllExceptionsFilter` catches unhandled errors and formats them consistently.
- **Repository pattern for data access.** Abstract database operations behind repository classes or TypeORM's `Repository<Entity>`. Services call repository methods, not raw query builders or entity managers directly.
- **Custom pipes for parameter transformation.** Use `ParseUUIDPipe`, `ParseIntPipe`, or custom pipes for route parameters. This validates and transforms params before they reach the handler.
- **Health check endpoint.** Register `@nestjs/terminus` with a health controller at `/health` for container orchestration and monitoring readiness probes.

## Common Bugs

- **Forgetting to add providers to `exports` in shared modules.** A service registered in Module A but not exported cannot be injected in Module B, even if Module B imports Module A. The error message mentions the missing provider but does not point to the missing export.
- **Injecting a request-scoped provider into a singleton service.** Singleton services are instantiated once; request-scoped providers are created per request. Injecting a request-scoped provider into a singleton silently uses a stale instance or throws at runtime. Use `@Inject(INQUIRER)` or scope the consumer to `Scope.REQUEST` as well.
- **Async operations in interceptors without proper RxJS handling.** Interceptors must return an `Observable`. When performing async work (e.g., logging, caching), use `switchMap()`, `tap()`, or `from()` to wrap promises. Forgetting this causes the interceptor to swallow the response.
- **Missing `TypeOrmModule.forFeature()` import in feature modules.** Without registering the entity in the feature module, `@InjectRepository(Entity)` throws "Nest could not find Repository<Entity>". The fix is adding `TypeOrmModule.forFeature([Entity])` to the module's `imports`.
- **Unhandled promises in lifecycle hooks and event handlers.** `onModuleInit()`, `onApplicationBootstrap()`, and event listener methods that perform async work must be awaited or return the promise. Unhandled rejections crash the process silently in production.
- **Circular dependency between modules.** Two modules importing each other causes a runtime error. Resolve with `forwardRef(() => OtherModule)` in the `imports` array and `@Inject(forwardRef(() => OtherService))` for the provider.
- **Applying `@Body()` without a DTO class.** Using `@Body() body: any` bypasses the `ValidationPipe` entirely. Always type the body parameter with a DTO class decorated with class-validator decorators.

## Anti-Patterns

- **Business logic in controllers.** Controllers should only parse the request, call a service method, and return the response. Conditional logic, database queries, and data transformations belong in services. Violating this makes controllers untestable and couples HTTP concerns with domain logic.
- **Raw SQL queries instead of repository methods.** Using `query()` or `createQueryRunner().query()` with hand-written SQL bypasses TypeORM's type safety, migration tracking, and relation handling. Use repository methods, query builder, or Prisma client instead.
- **Exposing ORM entities directly in API responses.** Returning TypeORM entities or Prisma models from controllers leaks database columns, relations, and internal fields (passwords, soft-delete flags). Always map to response DTOs.
- **Synchronous file I/O in request handlers.** Using `fs.readFileSync()`, `fs.writeFileSync()`, or other sync I/O in controllers or services blocks the event loop and degrades throughput. Use `fs/promises` or streaming APIs.
- **Skipping validation on mutation endpoints.** POST, PUT, and PATCH handlers without `ValidationPipe` and DTO classes accept arbitrary payloads. This leads to data corruption and injection vulnerabilities.
- **God modules that import everything.** A single module importing all providers and controllers defeats the purpose of modular architecture. Split into focused feature modules with clear boundaries.
- **Hardcoding configuration values.** Database URLs, API keys, and feature flags embedded in code prevent environment-specific deployments. Use `@nestjs/config` with `.env` files and `ConfigService`.

## Standards

- **Plural route prefixes.** Controllers use plural nouns: `@Controller('orders')`, `@Controller('users')`, `@Controller('payments')`. Singular prefixes are inconsistent with REST conventions.
- **File naming: `*.module.ts`, `*.controller.ts`, `*.service.ts`.** Every NestJS building block follows the pattern `{feature}.{type}.ts`: `orders.module.ts`, `orders.controller.ts`, `orders.service.ts`, `orders.entity.ts`.
- **DTO directory per feature module.** DTOs live in a `dto/` subdirectory within the feature folder: `src/orders/dto/create-order.dto.ts`, `src/orders/dto/order-response.dto.ts`. DTO files follow `{action}-{entity}.dto.ts` naming.
- **E2E tests in the `test/` directory.** End-to-end tests using `supertest` live in the project root `test/` folder with `.e2e-spec.ts` suffix: `test/orders.e2e-spec.ts`. E2E tests bootstrap the full app module.
- **Unit tests colocated with source files.** Unit test files live next to the source file they test with `.spec.ts` suffix: `orders.service.spec.ts` sits alongside `orders.service.ts`.
- **Feature folder structure.** Each feature module is a directory: `src/orders/`, `src/users/`, `src/payments/`. The directory contains the module, controller, service, entity, DTOs, and guards specific to that feature.
- **Consistent naming for guards, pipes, interceptors, and filters.** Follow `{name}.guard.ts`, `{name}.pipe.ts`, `{name}.interceptor.ts`, `{name}.filter.ts` conventions. Class names use PascalCase: `RolesGuard`, `LoggingInterceptor`, `HttpExceptionFilter`.

## Context7 Instructions

When looking up framework documentation, use these Context7 library identifiers:

- **NestJS:** `nestjs/nest` -- modules, controllers, services, guards, interceptors, pipes, middleware
- **TypeORM:** `typeorm/typeorm` -- entities, repositories, migrations, relations, query builder
- **Prisma:** `prisma/prisma` -- schema, client, migrations, typed queries
- **class-validator:** `typestack/class-validator` -- validation decorators, custom validators

Always check Context7 for the latest API when working with NestJS version-specific features. Training data may be outdated for recent NestJS releases.
