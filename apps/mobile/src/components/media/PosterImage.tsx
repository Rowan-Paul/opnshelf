import { Image } from "expo-image";
import { ImageOff } from "lucide-react-native";
import { View } from "react-native";
import { cn } from "@/lib/cn";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Poster/still image with a graceful placeholder when no URL is available.
 * `expo-image` handles caching + fade-in. The aspect ratio is controlled by
 * the caller via `className` (e.g. `aspect-2/3 w-full`).
 *
 * `expo-image` is not a react-native-core component, so Uniwind's `className`
 * prop is a no-op at runtime — we resolve the classes to a `style` object
 * (see `useTwStyle`) and pass that instead.
 */
export function PosterImage({
	url,
	className = "",
	contentFit = "cover",
}: {
	url: string | undefined;
	className?: string;
	contentFit?: "cover" | "contain";
}) {
	const style = useTwStyle(className);

	if (!url) {
		return (
			<View
				className={cn(
					"items-center justify-center bg-background-subtle",
					className,
				)}
			>
				<ImageOff color="#94a3b8" size={28} />
			</View>
		);
	}

	return (
		<Image
			source={{ uri: url }}
			style={style}
			contentFit={contentFit}
			transition={200}
		/>
	);
}
