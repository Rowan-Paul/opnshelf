import Svg, { Path } from "react-native-svg";

/**
 * Google's "G" mark.
 *
 * Google's branding guidelines require the official multi-colour logo on a
 * sign-in button and forbid recolouring it, so this carries its own palette in
 * both light and dark mode rather than taking currentColor. Same paths as the
 * Web App's `GoogleMark`, so the two stay identical.
 *
 * https://developers.google.com/identity/branding-guidelines
 */
export function GoogleMark({ size = 18 }: { size?: number }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 48 48">
			<Path
				fill="#EA4335"
				d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.8 2.6 13.5l7.8 6c1.9-5.6 7.2-10 13.6-10z"
			/>
			<Path
				fill="#4285F4"
				d="M46.6 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.7c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.5-4.2 6.9-10.3 6.9-17.5z"
			/>
			<Path
				fill="#FBBC05"
				d="M10.4 28.5A14.6 14.6 0 0 1 9.6 24c0-1.6.3-3.1.8-4.5l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.5l7.8-6z"
			/>
			<Path
				fill="#34A853"
				d="M24 47.5c6.5 0 11.9-2.1 15.7-5.8l-7.6-5.9c-2 1.4-4.8 2.4-8.1 2.4-6.4 0-11.7-4.4-13.6-10l-7.8 6C6.5 42.2 14.6 47.5 24 47.5z"
			/>
		</Svg>
	);
}
