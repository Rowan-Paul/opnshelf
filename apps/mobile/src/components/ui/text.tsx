import { Text as RNText, type TextProps } from "react-native";
import { cn } from "@/lib/cn";

/**
 * Themed text primitive. Defaults to the Inter body font + foreground color;
 * pass `className` to override. Uniwind resolves the font-family token via the
 * `--font-sans` / `--font-display` theme variables in global.css.
 */
export function Text({
	className,
	...props
}: TextProps & { className?: string }) {
	return (
		<RNText
			className={cn("font-sans text-base text-foreground", className)}
			{...props}
		/>
	);
}
