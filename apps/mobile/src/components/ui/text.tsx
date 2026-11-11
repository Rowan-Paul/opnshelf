import { Text as RNText, type TextProps } from "react-native";
import { cn } from "@/lib/cn";

const WEIGHT_FAMILY: Record<string, string> = {
	"font-medium": "font-sans-medium",
	"font-semibold": "font-sans-semibold",
	"font-bold": "font-sans-bold",
};

const WEIGHT_CLASS = /(^|\s)(font-(?:medium|semibold|bold))(?=\s|$)/g;

/**
 * React Native cannot pick a weight inside a registered custom font, and
 * Android fakes bold by thickening Regular. Swap weight utilities for the
 * matching weighted family registered in src/app/_layout.tsx instead.
 */
function resolveFontClasses(className?: string) {
	let family = "font-sans";
	const rest = className?.replace(WEIGHT_CLASS, (_, space, weight) => {
		family = WEIGHT_FAMILY[weight];
		return space;
	});
	return cn(family, rest);
}

/**
 * Themed text primitive. Defaults to the Timeless Sans body font + foreground
 * color; pass `className` to override. Uniwind resolves the font-family tokens
 * (`--font-sans*` / `--font-display*`) from global.css.
 */
export function Text({
	className,
	...props
}: TextProps & { className?: string }) {
	return (
		<RNText
			className={cn("text-base text-foreground", resolveFontClasses(className))}
			{...props}
		/>
	);
}
