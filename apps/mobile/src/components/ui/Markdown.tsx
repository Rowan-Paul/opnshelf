import type { ReactNode } from "react";
import { Linking, View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Minimal markdown renderer for the review editor's live preview.
 *
 * It deliberately covers exactly the subset the toolbar can emit — headings,
 * bold, italic, inline code, fenced code, bullet/ordered lists, blockquotes and
 * links — rather than pulling in a full CommonMark engine. The mobile app has no
 * markdown dependency and adding an older RN markdown lib against React 19 / RN
 * 0.85 isn't worth it for a preview of known-shape input. If reviews ever need
 * full-fidelity rendering on a read screen, revisit with a real parser.
 */

const MONO = "Courier";

// Inline tokens, ordered so `**bold**` wins over `*italic*` at the same index.
const INLINE = new RegExp(
	[
		"\\*\\*([^*]+)\\*\\*", // bold
		"`([^`]+)`", // inline code
		"\\[([^\\]]+)\\]\\(([^)\\s]+)\\)", // [label](url)
		"\\*([^*]+)\\*", // italic (asterisk)
		"_([^_]+)_", // italic (underscore)
	].join("|"),
	"g",
);

/** Render inline markdown within a single block of text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	INLINE.lastIndex = 0;

	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
	while ((match = INLINE.exec(text)) !== null) {
		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index));
		}
		// The match offset is a stable position within the source string, so it
		// makes a safe React key (unlike an array index).
		const key = `${keyPrefix}-${match.index}`;
		const [, bold, code, linkLabel, linkUrl, italicStar, italicUnderscore] =
			match;

		if (bold !== undefined) {
			nodes.push(
				<Text key={key} className="font-sans font-semibold text-foreground">
					{bold}
				</Text>,
			);
		} else if (code !== undefined) {
			nodes.push(
				<Text
					key={key}
					className="bg-background-subtle text-foreground"
					style={{ fontFamily: MONO }}
				>
					{code}
				</Text>,
			);
		} else if (linkLabel !== undefined && linkUrl !== undefined) {
			nodes.push(
				<Text
					key={key}
					className="text-accent underline"
					onPress={() => {
						Linking.openURL(linkUrl).catch(() => {});
					}}
				>
					{linkLabel}
				</Text>,
			);
		} else {
			const italic = italicStar ?? italicUnderscore;
			nodes.push(
				<Text key={key} className="font-sans text-foreground italic">
					{italic}
				</Text>,
			);
		}
		lastIndex = INLINE.lastIndex;
	}

	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex));
	}
	return nodes;
}

const HEADING_CLASS: Record<number, string> = {
	1: "font-display font-bold text-foreground text-xl",
	2: "font-display font-bold text-foreground text-lg",
	3: "font-display font-semibold text-foreground text-base",
};

interface ListItem {
	id: string;
	text: string;
}

type Block =
	| { id: string; kind: "heading"; level: number; text: string }
	| { id: string; kind: "code"; text: string }
	| { id: string; kind: "quote"; text: string }
	| { id: string; kind: "ul"; items: ListItem[] }
	| { id: string; kind: "ol"; items: ListItem[] }
	| { id: string; kind: "p"; text: string };

/** Group raw markdown lines into renderable blocks with stable ids. */
function parseBlocks(markdown: string): Block[] {
	// A lone `\` at end of line is a markdown hard break (what the editor emits
	// for a soft return); drop the marker and let the newline render as the break
	// so the card matches the editor.
	const lines = markdown
		.replace(/\r\n/g, "\n")
		// The editor serialises some hard breaks as literal <br> HTML; render them
		// as newlines instead of showing "<br />" as text.
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/\\$/gm, "")
		.split("\n");
	const blocks: Block[] = [];
	let i = 0;
	let seq = 0;
	const nextId = () => {
		seq += 1;
		return `b${seq}`;
	};

	while (i < lines.length) {
		const line = lines[i];

		if (line.trim().length === 0) {
			i += 1;
			continue;
		}

		// Fenced code block.
		if (/^```/.test(line)) {
			const body: string[] = [];
			i += 1;
			while (i < lines.length && !/^```/.test(lines[i])) {
				body.push(lines[i]);
				i += 1;
			}
			i += 1; // skip closing fence
			blocks.push({ id: nextId(), kind: "code", text: body.join("\n") });
			continue;
		}

		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			blocks.push({
				id: nextId(),
				kind: "heading",
				level: Math.min(heading[1].length, 3),
				text: heading[2],
			});
			i += 1;
			continue;
		}

		if (/^>\s?/.test(line)) {
			const quote: string[] = [];
			while (i < lines.length && /^>\s?/.test(lines[i])) {
				quote.push(lines[i].replace(/^>\s?/, ""));
				i += 1;
			}
			blocks.push({ id: nextId(), kind: "quote", text: quote.join("\n") });
			continue;
		}

		if (/^[-*]\s+/.test(line)) {
			const items: ListItem[] = [];
			while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
				items.push({ id: nextId(), text: lines[i].replace(/^[-*]\s+/, "") });
				i += 1;
			}
			blocks.push({ id: nextId(), kind: "ul", items });
			continue;
		}

		if (/^\d+\.\s+/.test(line)) {
			const items: ListItem[] = [];
			while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
				items.push({ id: nextId(), text: lines[i].replace(/^\d+\.\s+/, "") });
				i += 1;
			}
			blocks.push({ id: nextId(), kind: "ol", items });
			continue;
		}

		// Paragraph: gather consecutive plain lines.
		const para: string[] = [];
		while (
			i < lines.length &&
			lines[i].trim().length > 0 &&
			!/^(```|#{1,6}\s|>\s?|[-*]\s|\d+\.\s)/.test(lines[i])
		) {
			para.push(lines[i]);
			i += 1;
		}
		blocks.push({ id: nextId(), kind: "p", text: para.join("\n") });
	}

	return blocks;
}

/**
 * A whole-line-clamped preview of a review body. RN can't line-clamp the block
 * renderer above (multiple Views), so this flattens block markers to a single
 * inline flow and clamps with `numberOfLines` — keeping inline bold/italic/code/
 * links while cutting cleanly on a line boundary (no mid-line slice).
 */
export function MarkdownPreview({
	value,
	numberOfLines,
}: {
	value: string;
	numberOfLines: number;
}) {
	const text = value
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/```/g, "")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^>\s?/gm, "")
		.replace(/^[-*]\s+/gm, "• ")
		.replace(/\n{2,}/g, "\n")
		.trim();
	return (
		<Text
			className="text-foreground leading-6"
			numberOfLines={numberOfLines}
			ellipsizeMode="tail"
		>
			{renderInline(text, "preview")}
		</Text>
	);
}

/** Renders the supported markdown subset as native RN views. */
export function Markdown({ value }: { value: string }) {
	const blocks = parseBlocks(value);

	if (blocks.length === 0) {
		return null;
	}

	return (
		<View className="gap-3">
			{blocks.map((block) => {
				switch (block.kind) {
					case "heading":
						return (
							<Text key={block.id} className={HEADING_CLASS[block.level]}>
								{renderInline(block.text, block.id)}
							</Text>
						);
					case "code":
						return (
							<View
								key={block.id}
								className="rounded-lg bg-background-subtle p-3"
							>
								<Text
									className="text-foreground text-sm"
									style={{ fontFamily: MONO }}
								>
									{block.text}
								</Text>
							</View>
						);
					case "quote":
						return (
							<View
								key={block.id}
								className="border-border-strong border-l-2 pl-3"
							>
								<Text className="text-muted-foreground italic leading-6">
									{renderInline(block.text, block.id)}
								</Text>
							</View>
						);
					case "ul":
						return (
							<View key={block.id} className="gap-1">
								{block.items.map((item) => (
									<View key={item.id} className="flex-row gap-2">
										<Text className="text-muted-foreground">{"•"}</Text>
										<Text className="flex-1 text-foreground leading-6">
											{renderInline(item.text, item.id)}
										</Text>
									</View>
								))}
							</View>
						);
					case "ol":
						return (
							<View key={block.id} className="gap-1">
								{block.items.map((item, itemIndex) => (
									<View key={item.id} className="flex-row gap-2">
										<Text className="text-muted-foreground">
											{itemIndex + 1}.
										</Text>
										<Text className="flex-1 text-foreground leading-6">
											{renderInline(item.text, item.id)}
										</Text>
									</View>
								))}
							</View>
						);
					default:
						return (
							<Text key={block.id} className="text-foreground leading-6">
								{renderInline(block.text, block.id)}
							</Text>
						);
				}
			})}
		</View>
	);
}
