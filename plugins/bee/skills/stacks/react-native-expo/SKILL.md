---
name: react-native-expo
description: React Native + Expo managed workflow conventions and patterns
---

# React Native + Expo Standards

These standards apply when the project stack is `react-native-expo`. All agents and implementations must follow these conventions. This is a MOBILE-FIRST stack.

## Expo Configuration

- Use **Expo managed workflow** as the default. Eject to bare workflow only when a native module is unavailable.
- `app.json` or `app.config.js` for static/dynamic configuration (app name, slug, version, splash, icons).
- Use `app.config.js` when configuration needs environment variables or dynamic values.
- **EAS Build** for production builds: `eas build --platform ios` / `eas build --platform android`.
- **EAS Submit** for app store distribution: `eas submit --platform ios` / `eas submit --platform android`.
- **Prebuild** (`npx expo prebuild`) for custom native code that Expo Go cannot support.
- **Expo Go** for development: fast iteration without native rebuilds. Use `npx expo start`.
- Keep `expo` SDK version consistent across all `expo-*` packages. Upgrade together.

```json
{
  "expo": {
    "name": "MyApp",
    "slug": "my-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "sdkVersion": "52.0.0",
    "plugins": ["expo-camera", "expo-location"]
  }
}
```

## Component Patterns

- Use **React Native core components**, not HTML elements. There is no DOM.
- `View` replaces `div`. `Text` replaces `span`, `p`, `h1`, etc. `Image` replaces `img`.
- `ScrollView` for short scrollable content. `FlatList` for long lists (virtualized, performant).
- `Pressable` for all touchable elements. `TouchableOpacity` is deprecated -- do not use it.
- **All text must be inside `<Text>` components.** Raw strings outside `<Text>` cause crashes.
- `SectionList` for grouped data. `FlatList` for flat data. Never use `ScrollView` + `.map()` for lists.
- `KeyboardAvoidingView` to handle keyboard overlap on forms.

```tsx
// Pattern: list with FlatList, not ScrollView + map
const OrderList = ({ orders }: { orders: Order[] }) => (
  <FlatList
    data={orders}
    keyExtractor={(item) => item.id}
    renderItem={({ item }) => (
      <Pressable onPress={() => handlePress(item.id)}>
        <View style={styles.row}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.status}</Text>
        </View>
      </Pressable>
    )}
    ListEmptyComponent={<Text>No orders found</Text>}
  />
);
```

## Navigation

- **Expo Router** for file-based routing. Routes live in the `app/` directory.
- File names map to routes: `app/index.tsx` is `/`, `app/orders/[id].tsx` is `/orders/:id`.
- `_layout.tsx` files define navigation structure (Stack, Tabs, Drawer).
- **Stack navigator** for hierarchical navigation (push/pop screens).
- **Tab navigator** for top-level sections (`app/(tabs)/` with `_layout.tsx` defining tabs).
- **Deep linking** is automatic with Expo Router -- file paths become link paths.
- Use `<Link href="/orders">` for declarative navigation, `router.push('/orders')` for programmatic.
- **Protected routes** with `redirect` in `_layout.tsx` -- check auth state and redirect to login.

```tsx
// Pattern: tab layout with protected route
export default function TabLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

## Platform-Specific Code

- `Platform.OS` returns `'ios'` | `'android'` | `'web'` for runtime checks.
- `Platform.select({ ios: value, android: value, default: value })` for inline value selection.
- **File extensions** for platform-specific files: `Component.ios.tsx`, `Component.android.tsx`. The bundler resolves the correct file automatically.
- Use platform checks sparingly -- prefer cross-platform components. Platform-specific code should be an exception.
- Common platform differences: status bar styling, shadow vs elevation, haptics, date pickers.

```tsx
// Pattern: platform-specific styling
const styles = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
      android: { elevation: 4 },
    }),
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
});
```

## Styling

- **`StyleSheet.create()`** for ALL styles. Never pass inline style objects -- they cause unnecessary re-renders.
- Flexbox is the layout model. Default `flexDirection` is `column` (not `row` like web CSS).
- Use `useWindowDimensions()` or `Dimensions.get('window')` for responsive sizing.
- **SafeAreaView** and `useSafeAreaInsets()` from `react-native-safe-area-context` for notch/home indicator handling.
- Units are density-independent pixels (dp). No `px`, `em`, `rem`, `%` (except in flex ratios).
- No CSS classes, no Tailwind (unless using NativeWind). All styling is via style objects.
- `gap` property works in React Native for spacing between flex children.

```tsx
// Pattern: responsive layout with safe area
const { width } = useWindowDimensions();
const insets = useSafeAreaInsets();

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
  },
  card: {
    width: width > 600 ? (width - 48 - 12) / 2 : width - 32,
  },
});
```

## Native Modules

- Use **Expo SDK modules** for device capabilities. Install via `npx expo install`.
- Common modules: `expo-camera`, `expo-location`, `expo-notifications`, `expo-image-picker`, `expo-file-system`, `expo-secure-store`, `expo-haptics`, `expo-av`.
- **Always request permissions before use.** Use `requestPermissionsAsync()` from each module.
- Handle **permission denied** gracefully -- show a message explaining why the permission is needed with a link to settings.
- For modules not in Expo SDK, use `npx expo install` and add to `app.json` plugins if native config is needed.
- Some modules require **prebuild** (custom dev client) -- Expo Go has limited native module support.

```tsx
// Pattern: camera with permission handling
const [permission, requestPermission] = useCameraPermissions();

if (!permission?.granted) {
  return (
    <View style={styles.container}>
      <Text>Camera access is required to scan barcodes</Text>
      <Pressable onPress={requestPermission}>
        <Text>Grant Permission</Text>
      </Pressable>
    </View>
  );
}

return <CameraView style={styles.camera} facing="back" />;
```

## State Management

- **React hooks** work identically: `useState`, `useReducer`, `useContext`, `useEffect`, `useMemo`, `useCallback`.
- External state libraries (Zustand, Jotai, Redux Toolkit) work without modification.
- **AsyncStorage** for persistent local data (replaces `localStorage`). Install via `@react-native-async-storage/async-storage`.
- **SecureStore** (`expo-secure-store`) for sensitive data: auth tokens, API keys, credentials.
- Never store sensitive data in AsyncStorage -- it is not encrypted.
- For server state, use **TanStack Query** (React Query) -- same API as web React.

```tsx
// Pattern: secure token storage
import * as SecureStore from 'expo-secure-store';

async function saveToken(token: string) {
  await SecureStore.setItemAsync('auth_token', token);
}

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}
```

## Testing

- **React Native Testing Library** (`@testing-library/react-native`) for component tests.
- `render`, `screen`, `fireEvent` are the primary utilities. Use `fireEvent`, NOT `userEvent` (RNTL uses `fireEvent`).
- Mock native modules in `jest.setup.js` -- modules like `expo-camera`, `expo-location` are not available in Jest.
- Test behavior: what renders, what happens on press, what text appears. Not implementation details.
- Use `waitFor()` for async state updates. Use `act()` when triggering state changes outside events.
- Mock navigation with `jest.mock('expo-router')` for testing navigation calls.

```tsx
// Pattern: component test with RNTL
import { render, screen, fireEvent } from '@testing-library/react-native';

describe('OrderCard', () => {
  it('displays order name and status', () => {
    render(<OrderCard name="Order #1" status="pending" />);
    expect(screen.getByText('Order #1')).toBeTruthy();
    expect(screen.getByText('pending')).toBeTruthy();
  });

  it('calls onPress with order id when pressed', () => {
    const onPress = jest.fn();
    render(<OrderCard id="123" name="Order #1" status="pending" onPress={onPress} />);
    fireEvent.press(screen.getByText('Order #1'));
    expect(onPress).toHaveBeenCalledWith('123');
  });
});
```

## Common Pitfalls -- NEVER Rules

- **NEVER** use HTML elements (`div`, `span`, `p`, `h1`, `button`) -- use `View`, `Text`, `Pressable`, etc.
- **NEVER** put raw text outside `<Text>` components -- this causes a runtime crash.
- **NEVER** use `TouchableOpacity` -- it is deprecated. Use `Pressable` instead.
- **NEVER** use `ScrollView` with `.map()` for long lists -- use `FlatList` for virtualized rendering.
- **NEVER** use inline style objects (`style={{ padding: 10 }}`) -- use `StyleSheet.create()` to avoid re-renders.
- **NEVER** assume `flexDirection` is `row` -- React Native defaults to `column` (opposite of web CSS).
- **NEVER** skip permission requests for camera, location, notifications, etc. -- the app will crash or silently fail.
- **NEVER** use `localStorage` -- it does not exist in React Native. Use `AsyncStorage` or `SecureStore`.
- **NEVER** ignore Safe Area insets -- content will be hidden behind the notch, dynamic island, or home indicator.
- **NEVER** forget to handle both iOS and Android in platform-specific code -- test and verify on both platforms.
- **NEVER** use `userEvent` from RNTL -- React Native Testing Library uses `fireEvent`, not `userEvent`.

## Must-Haves

- **TypeScript everywhere.** All files use `.ts` / `.tsx` extensions. Define typed props interfaces for every component. No untyped code.
- **Function components only.** All React components are plain functions with typed props. Class components are forbidden.
- **TDD with Jest and Expo.** Write tests before implementation using Jest with `jest-expo` preset and React Native Testing Library. Follow Red-Green-Refactor.
- **`Platform.select` for platform-specific values.** Use `Platform.select({ ios: value, android: value, default: value })` instead of ternary expressions with `Platform.OS`.
- **Typed navigation with Expo Router.** Define navigation parameter types for all routes. Use `useLocalSearchParams<{ id: string }>()` and typed `router.push()` calls for type-safe navigation.
- **Strict null checks.** Enable `strict` mode in `tsconfig.json`. Handle nullable values explicitly -- no implicit `undefined` access.
- **Permission handling before native API access.** Always call `requestPermissionsAsync()` and handle the denied case before accessing camera, location, notifications, or media library.

## Good Practices

- **`StyleSheet.create()` for all styles.** Define styles outside the component body. This avoids creating new style objects on every render and enables style validation.
- **`FlatList` for all list rendering.** Use `FlatList` with `keyExtractor` and `renderItem` for virtualized, performant scrolling. Reserve `ScrollView` for non-list scrollable content.
- **`useMemo` for expensive computations.** Memoize filtered lists, sorted data, and complex derived values to avoid recalculating on every render.
- **Error boundaries for graceful crash recovery.** Wrap screen-level components in error boundaries to catch rendering errors and show a fallback UI instead of a white screen crash.
- **Expo SDK APIs over third-party alternatives.** Prefer `expo-camera`, `expo-location`, `expo-image-picker`, `expo-file-system`, `expo-haptics`, `expo-notifications` and other Expo SDK modules. They are tested against the managed workflow and upgrade cleanly with the SDK.
- **`useCallback` for stable callback references.** Wrap event handlers passed to child components or `FlatList` `renderItem` with `useCallback` to prevent unnecessary re-renders.
- **Skeleton screens over spinners.** Show content-shaped placeholders while data loads to reduce perceived loading time and avoid layout shifts.

## Common Bugs

- **Missing `KeyboardAvoidingView` on form screens.** The keyboard covers input fields on iOS. Wrap form screens in `KeyboardAvoidingView` with `behavior="padding"` on iOS and `behavior="height"` on Android.
- **AsyncStorage operations not awaited.** `AsyncStorage.getItem()` and `setItem()` return promises. Forgetting to `await` these calls leads to reading `undefined` instead of stored values and silently dropping writes.
- **Android hardware back button not handled.** Android users expect the back button to navigate or close modals. Use `BackHandler.addEventListener('hardwareBackPress', handler)` in `useEffect` with cleanup, or handle via Expo Router's back behavior.
- **Missing `GestureHandlerRootView` at app root.** Gesture-based components (swipeable rows, bottom sheets, drawer navigation) silently fail without `GestureHandlerRootView` wrapping the app root. Add it in the root `_layout.tsx`.
- **Shadow props not working cross-platform.** iOS uses `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`. Android ignores these and uses `elevation` instead. Always provide both via `Platform.select` or the shadow styles will be invisible on one platform.
- **Stale closures in `useEffect` and event handlers.** Referencing state variables inside callbacks without listing them in the dependency array causes handlers to capture outdated values. Always include dependencies or use `useRef` for mutable values.
- **Images not loading on Android with HTTP URLs.** Android blocks cleartext HTTP by default. Use HTTPS URLs or configure `android:usesCleartextTraffic` in `app.json` network security config.

## Anti-Patterns

- **Class components.** Never use `class extends React.Component`. All components must be function components with hooks. Class components are incompatible with modern React patterns and Expo conventions.
- **Using `any` type.** Never use `any` as a type annotation. Define explicit interfaces, union types, or generics. `any` disables TypeScript checking and hides bugs at compile time.
- **Storing sensitive data in AsyncStorage unencrypted.** AsyncStorage is plaintext storage. Never store auth tokens, API keys, passwords, or secrets in AsyncStorage. Use `expo-secure-store` for all sensitive data.
- **Blocking the JS thread with synchronous operations.** Never run heavy computation, large JSON parsing, or synchronous file I/O on the main JavaScript thread. Use `InteractionManager.runAfterInteractions()`, web workers, or move work to native modules.
- **Ignoring platform differences in UI and behavior.** Never assume iOS and Android behave identically. Test on both platforms. Handle differences in status bar, navigation gestures, keyboard behavior, permissions flow, and date/time pickers.
- **Inline style objects in JSX.** Never write `style={{ marginTop: 10 }}` in JSX. Inline objects are re-created on every render, causing unnecessary re-renders of child components. Use `StyleSheet.create()`.
- **Using `index` as `key` in dynamic lists.** Never use array index as the `key` prop for lists where items can be reordered, inserted, or deleted. Use a stable unique identifier from the data.

## Standards

- **PascalCase for components and screens.** Component files and directories use PascalCase: `OrderCard.tsx`, `ProfileScreen.tsx`. Hooks use camelCase with `use` prefix: `useAuth.ts`.
- **`app/` directory for Expo Router file-based routing.** All screens and layouts live in the `app/` directory. File names map directly to URL paths. Use `_layout.tsx` for navigation structure.
- **`components/` directory for shared UI components.** Reusable components live in a top-level `components/` directory (or `src/components/`), organized by feature or domain.
- **`snake_case` API responses mapped to `camelCase` in the app.** Backend APIs typically return `snake_case` keys. Transform them to `camelCase` at the API boundary (in the fetch/axios layer) so all app code uses consistent camelCase naming.
- **`hooks/` directory for custom hooks.** Extract reusable logic into custom hooks stored in `hooks/` (or `src/hooks/`). Each hook file exports a single `use*` function.
- **`constants/` directory for app-wide constants.** Colors, spacing values, API endpoints, and configuration constants live in a `constants/` directory, not scattered across components.
- **One component per file.** Each component gets its own file. Co-locate the component's styles at the bottom of the same file using `StyleSheet.create()`.

## Context7 Instructions

When looking up framework documentation, use these Context7 library identifiers:

- **React Native:** `facebook/react-native` -- core components, APIs, styling, platform modules
- **Expo:** `expo/expo` -- SDK modules, configuration, EAS Build, Expo Router
- **Expo Router:** `expo/router` -- file-based routing, layouts, navigation, deep linking
- **React Native Testing Library:** `callstack/react-native-testing-library` -- render, screen, fireEvent, queries

Always check Context7 for the latest API when working with Expo SDK version-specific features. Training data may be outdated for recent Expo SDK releases.
