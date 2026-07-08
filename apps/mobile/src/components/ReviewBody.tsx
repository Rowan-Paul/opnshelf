import { useState } from "react";
import { type GestureResponderEvent, Pressable, View } from "react-native";
import { Markdown } from "@/components/ui/Markdown";
import { Text } from "@/components/ui/text";
import { reviewExcerpt } from "@/lib/review-excerpt";

/**
 * A review body in a list. Short reviews render in full (formatted). Long ones
 * show a plain-text excerpt with a "Read more" that expands the full formatted
 * review inline — no gradient fade clipping mid-element. Used on both the media
 * detail cards and the profile reviews tab.
 */
export function ReviewBody({ markdown }: { markdown: string }) {
	const [expanded, setExpanded] = useState(false);
	const { text, truncated } = reviewExcerpt(markdown);

	if (!truncated) {
		return <Markdown value={markdown} />;
	}

	const toggle = (e: GestureResponderEvent) => {
		// Don't let a wrapping card link (e.g. the profile card) navigate.
		e.stopPropagation();
		setExpanded((v) => !v);
	};

	return (
		<View>
			{expanded ? (
				<Markdown value={markdown} />
			) : (
				<Text className="text-foreground text-sm leading-relaxed">{text}</Text>
			)}
			<Pressable hitSlop={6} onPress={toggle}>
				<Text className="mt-1 font-medium text-primary text-sm">
					{expanded ? "Show less" : "Read more"}
				</Text>
			</Pressable>
		</View>
	);
}
