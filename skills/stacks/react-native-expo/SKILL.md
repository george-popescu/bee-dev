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

## Context7 Instructions

When looking up framework documentation, use these Context7 library identifiers:

- **React Native:** `facebook/react-native` -- core components, APIs, styling, platform modules
- **Expo:** `expo/expo` -- SDK modules, configuration, EAS Build, Expo Router
- **Expo Router:** `expo/router` -- file-based routing, layouts, navigation, deep linking
- **React Native Testing Library:** `callstack/react-native-testing-library` -- render, screen, fireEvent, queries

Always check Context7 for the latest API when working with Expo SDK version-specific features. Training data may be outdated for recent Expo SDK releases.
