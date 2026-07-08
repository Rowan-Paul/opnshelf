import { useState } from "react";
import { type GestureResponderEvent, Pressable, View } from "react-native";
import { Markdown, MarkdownPreview } from "@/components/ui/Markdown";
import { Text } from "@/components/ui/text";
import { reviewExcerpt } from "@/lib/review-excerpt";

/**
 * A review body in a list. Short reviews render in full (formatted, so bold /
 * line breaks / lists read the same as in the editor). Long ones render the same
 * markdown clamped to a few lines with a "Read more".
 *
 * `expandable` makes "Read more" expand the review inline (used on the media
 * detail, which has no separate review page). Otherwise "Read more" is a cue and
 * the surrounding card navigates to the review's detail. `full` forces the whole
 * review (used for the deep-linked/highlighted review on the detail screen).
 */
export function ReviewBody({
	markdown,
	full = false,
	expandable = false,
}: {
	markdown: string;
	full?: boolean;
	expandable?: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const { truncated } = reviewExcerpt(markdown);

	const stop = (e: GestureResponderEvent) => e.stopPropagation();

	if (full || expanded || !truncated) {
		return (
			<View>
				<Markdown value={markdown} />
				{expanded ? (
					<Pressable
						hitSlop={6}
						onPress={(e) => {
							stop(e);
							setExpanded(false);
						}}
					>
						<Text className="mt-1 font-medium text-primary text-sm">
							Show less
						</Text>
					</Pressable>
				) : null}
			</View>
		);
	}

	return (
		<View>
			<MarkdownPreview value={markdown} numberOfLines={5} />
			{expandable ? (
				<Pressable
					hitSlop={6}
					onPress={(e) => {
						stop(e);
						setExpanded(true);
					}}
				>
					<Text className="mt-1 font-medium text-primary text-sm">
						Read more
					</Text>
				</Pressable>
			) : (
				<Text className="mt-1 font-medium text-primary text-sm">Read more</Text>
			)}
		</View>
	);
}
