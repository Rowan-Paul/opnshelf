import { useResolveClassNames } from "uniwind";

/**
 * Resolve a Tailwind/Uniwind className string into a React Native `style`
 * object.
 *
 * Uniwind's Metro resolver only rewrites imports from `react-native`, so its
 * `className` prop only works on RN-core components. Third-party components
 * (expo-image, @shopify/flash-list, expo-linear-gradient, …) ignore
 * `className` at runtime. For those, resolve the classes here and pass the
 * result through their `style` / `contentContainerStyle` props instead.
 */
export function useTwStyle(className: string) {
	return useResolveClassNames(className);
}
