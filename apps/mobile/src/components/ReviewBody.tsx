import { type Href, Link } from "expo-router";
import { Pressable, View } from "react-native";
import { Markdown, MarkdownPreview } from "@/components/ui/Markdown";
import { Text } from "@/components/ui/text";
import { reviewExcerpt } from "@/lib/review-excerpt";

/**
 * A review body in a list. Short reviews render in full (formatted, so bold /
 * line breaks / lists read the same as in the editor). Long ones render a
 * whole-line-clamped preview with a "Read more" that opens the review's detail
 * page (`href`). Without an href, "Read more" is a plain cue.
 */
export function ReviewBody({
	markdown,
	href,
}: {
	markdown: string;
	href?: Href;
}) {
	const { truncated } = reviewExcerpt(markdown);

	if (!truncated) {
		return <Markdown value={markdown} />;
	}

	return (
		<View>
			<MarkdownPreview value={markdown} numberOfLines={5} />
			{href ? (
				<Link href={href} asChild>
					<Pressable hitSlop={6}>
						<Text className="mt-1 font-medium text-primary text-sm">
							Read more
						</Text>
					</Pressable>
				</Link>
			) : (
				<Text className="mt-1 font-medium text-primary text-sm">Read more</Text>
			)}
		</View>
	);
}
