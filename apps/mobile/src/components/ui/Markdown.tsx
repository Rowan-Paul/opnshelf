import type {
	BlockNode,
	HeadingNode,
	ImageNode,
	InlineNode,
	ListItemNode,
	ListNode,
	MarkdownDocument,
	TextNode,
} from "@tanstack/markdown";
import { parseMarkdown } from "@tanstack/markdown/parser";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Linking, type TextStyle, View } from "react-native";
import { Text } from "@/components/ui/text";
import { openExternalWebUrl } from "@/lib/safe-links";

const MONO = "Courier";
const BOLD = "Inter-Bold";
const ITALIC = "Inter-Italic";

const HEADING_CLASS: Record<HeadingNode["depth"], string> = {
	1: "text-foreground text-xl",
	2: "text-foreground text-lg",
	3: "text-foreground text-base",
	4: "text-foreground text-base",
	5: "text-foreground text-sm",
	6: "text-muted-foreground text-sm",
};

const HEADING_FAMILY: Record<HeadingNode["depth"], string> = {
	1: "PlusJakartaSans-Bold",
	2: "PlusJakartaSans-Bold",
	3: "PlusJakartaSans-SemiBold",
	4: "PlusJakartaSans-SemiBold",
	5: "PlusJakartaSans-SemiBold",
	6: "PlusJakartaSans-SemiBold",
};

const AUTOLINK_RE = /<((?:https?:\/\/)[^<>\s]+)>/gi;

function normalizeMarkdownSource(markdown: string) {
	return markdown.replace(/\r\n/g, "\n").replace(/<br\s*\/?>/gi, "\n");
}

function pushTextWithBreaks(nodes: InlineNode[], value: string) {
	const parts = value.split("\n");
	for (const [index, part] of parts.entries()) {
		if (part.length > 0) {
			nodes.push({ type: "text", value: part });
		}
		if (index < parts.length - 1) {
			nodes.push({ type: "break" });
		}
	}
}

function transformTextNode(node: TextNode): InlineNode[] {
	const nodes: InlineNode[] = [];
	let lastIndex = 0;
	AUTOLINK_RE.lastIndex = 0;

	for (const match of node.value.matchAll(AUTOLINK_RE)) {
		const href = match[1];
		const index = match.index ?? 0;
		if (index > lastIndex) {
			pushTextWithBreaks(nodes, node.value.slice(lastIndex, index));
		}
		nodes.push({
			type: "link",
			href,
			children: [{ type: "text", value: href }],
		});
		lastIndex = index + match[0].length;
	}

	if (lastIndex < node.value.length) {
		pushTextWithBreaks(nodes, node.value.slice(lastIndex));
	}

	return nodes;
}

function transformInlineNode(node: InlineNode): InlineNode[] {
	switch (node.type) {
		case "text":
			return transformTextNode(node);
		case "strong":
			return [
				{
					...node,
					children: transformInlineNodes(node.children),
				},
			];
		case "emphasis":
			return [
				{
					...node,
					children: transformInlineNodes(node.children),
				},
			];
		case "strike":
			return [
				{
					...node,
					children: transformInlineNodes(node.children),
				},
			];
		case "link":
			return [
				{
					...node,
					children: transformInlineNodes(node.children),
				},
			];
		default:
			return [node];
	}
}

function transformInlineNodes(nodes: InlineNode[]): InlineNode[] {
	return nodes.flatMap(transformInlineNode);
}

function transformBlockNode(node: BlockNode): BlockNode {
	switch (node.type) {
		case "heading":
		case "paragraph":
			return { ...node, children: transformInlineNodes(node.children) };
		case "blockquote":
			return { ...node, children: node.children.map(transformBlockNode) };
		case "list":
			return {
				...node,
				items: node.items.map((item) => ({
					...item,
					children: item.children.map(transformBlockNode),
				})),
			};
		default:
			return node;
	}
}

function parseReviewMarkdown(markdown: string): MarkdownDocument {
	const document = parseMarkdown(normalizeMarkdownSource(markdown));
	return {
		...document,
		children: document.children.map(transformBlockNode),
	};
}

function inlineTextValue(nodes: InlineNode[]): string {
	return nodes
		.map((node) => {
			switch (node.type) {
				case "text":
					return node.value;
				case "inlineCode":
					return node.value;
				case "strong":
				case "emphasis":
				case "strike":
				case "link":
					return inlineTextValue(node.children);
				case "image":
					return node.alt || node.src;
				case "footnoteReference":
					return `[${node.number}]`;
				case "break":
					return "\n";
				case "inlineHtml":
					return node.value;
				default:
					return "";
			}
		})
		.join("");
}

function renderInlineNodes(
	nodes: InlineNode[],
	keyPrefix: string,
): ReactNode[] {
	return nodes.map((node, index) => {
		const key = `${keyPrefix}-${index}`;
		switch (node.type) {
			case "text":
				return node.value;
			case "break":
				return "\n";
			case "inlineCode":
				return (
					<Text
						key={key}
						className="bg-background-subtle text-foreground"
						style={{ fontFamily: MONO }}
					>
						{node.value}
					</Text>
				);
			case "strong":
				return (
					<Text
						key={key}
						className="text-foreground"
						style={{ fontFamily: BOLD }}
					>
						{renderInlineNodes(node.children, key)}
					</Text>
				);
			case "emphasis":
				return (
					<Text
						key={key}
						className="text-foreground"
						style={{ fontFamily: ITALIC }}
					>
						{renderInlineNodes(node.children, key)}
					</Text>
				);
			case "strike":
				return (
					<Text key={key} className="text-foreground line-through">
						{renderInlineNodes(node.children, key)}
					</Text>
				);
			case "link":
				return (
					<Text
						key={key}
						className="text-accent underline"
						onPress={() => {
							openExternalWebUrl(node.href, Linking.openURL);
						}}
					>
						{renderInlineNodes(node.children, key)}
					</Text>
				);
			case "footnoteReference":
				return `[${node.number}]`;
			case "inlineHtml":
				return node.value;
			case "image":
				return node.alt || node.src;
			default:
				return null;
		}
	});
}

function splitInlineRuns(nodes: InlineNode[]) {
	const runs: Array<
		| { type: "text"; nodes: Exclude<InlineNode, ImageNode>[] }
		| { type: "image"; node: ImageNode }
	> = [];
	let current: Exclude<InlineNode, ImageNode>[] = [];

	for (const node of nodes) {
		if (node.type === "image") {
			if (current.length > 0) {
				runs.push({ type: "text", nodes: [...current] });
				current = [];
			}
			runs.push({ type: "image", node });
			continue;
		}
		current.push(node);
	}

	if (current.length > 0) {
		runs.push({ type: "text", nodes: [...current] });
	}

	return runs;
}

function renderInlineFlow(
	nodes: InlineNode[],
	keyPrefix: string,
	textClassName: string,
	textStyle?: TextStyle,
) {
	const runs = splitInlineRuns(nodes);
	if (runs.length === 0) {
		return null;
	}
	if (runs.length === 1 && runs[0]?.type === "text") {
		return (
			<Text
				key={`${keyPrefix}-text`}
				className={textClassName}
				style={textStyle}
			>
				{renderInlineNodes(runs[0].nodes, `${keyPrefix}-text`)}
			</Text>
		);
	}

	return (
		<View key={`${keyPrefix}-flow`} className="gap-3">
			{runs.map((run, index) => {
				const key = `${keyPrefix}-run-${index}`;
				if (run.type === "image") {
					return (
						<Image
							key={key}
							source={{ uri: run.node.src }}
							accessibilityLabel={run.node.alt}
							contentFit="contain"
							style={{ width: "100%", height: 240, borderRadius: 12 }}
						/>
					);
				}
				return (
					<Text key={key} className={textClassName} style={textStyle}>
						{renderInlineNodes(run.nodes, key)}
					</Text>
				);
			})}
		</View>
	);
}

function renderBlockNode(
	node: BlockNode,
	key: string,
	context?: { quoted?: boolean },
): ReactNode {
	switch (node.type) {
		case "heading":
			return (
				<Text
					key={key}
					className={HEADING_CLASS[node.depth]}
					style={{ fontFamily: HEADING_FAMILY[node.depth] }}
				>
					{renderInlineNodes(node.children, key)}
				</Text>
			);
		case "paragraph":
			return renderInlineFlow(
				node.children,
				key,
				context?.quoted
					? "text-muted-foreground leading-6"
					: "text-foreground leading-6",
				context?.quoted ? { fontFamily: ITALIC } : undefined,
			);
		case "code":
			return (
				<View key={key} className="rounded-lg bg-background-subtle p-3">
					<Text
						className="text-foreground text-sm"
						style={{ fontFamily: MONO }}
					>
						{node.value}
					</Text>
				</View>
			);
		case "blockquote":
			return (
				<View key={key} className="gap-3 border-border-strong border-l-2 pl-3">
					{node.children.map((child, index) =>
						renderBlockNode(child, `${key}-${index}`, { quoted: true }),
					)}
				</View>
			);
		case "list":
			return (
				<View key={key} className="gap-2">
					{node.items.map((item, index) =>
						renderListItem(node, item, index, `${key}-${index}`),
					)}
				</View>
			);
		case "thematicBreak":
			return <View key={key} className="h-px bg-border" />;
		case "html":
			return (
				<Text key={key} className="text-foreground leading-6">
					{node.value}
				</Text>
			);
		case "table":
			return (
				<View key={key} className="gap-2 rounded-lg bg-background-subtle p-3">
					{node.header.length > 0 ? (
						<View className="flex-row flex-wrap gap-2">
							{node.header.map((cell, index) => (
								<Text
									key={`${key}-header-${inlineTextValue(cell.children) || "cell"}`}
									className="text-foreground"
									style={{ fontFamily: BOLD }}
								>
									{renderInlineNodes(cell.children, `${key}-header-${index}`)}
								</Text>
							))}
						</View>
					) : null}
					{node.rows.map((row, rowIndex) => (
						<View
							key={`${key}-row-${row.map((cell) => inlineTextValue(cell.children) || "cell").join("|")}`}
							className="flex-row flex-wrap gap-2"
						>
							{row.map((cell, cellIndex) => (
								<Text
									key={`${key}-row-cell-${inlineTextValue(cell.children) || "cell"}`}
									className="text-foreground"
								>
									{renderInlineNodes(
										cell.children,
										`${key}-row-${rowIndex}-${cellIndex}`,
									)}
								</Text>
							))}
						</View>
					))}
				</View>
			);
		case "footnotes":
			return (
				<View key={key} className="gap-2">
					{node.items.map((item) => (
						<View key={`${key}-${item.id}`} className="flex-row gap-2">
							<Text className="text-muted-foreground">{item.number}.</Text>
							<View className="flex-1 gap-2">
								{item.children.map((child, childIndex) =>
									renderBlockNode(child, `${key}-${item.id}-${childIndex}`),
								)}
							</View>
						</View>
					))}
				</View>
			);
		case "callout":
			return (
				<View
					key={key}
					className="rounded-lg border border-border bg-background-subtle p-3"
				>
					<Text className="mb-2 text-foreground" style={{ fontFamily: BOLD }}>
						{node.title}
					</Text>
					<View className="gap-3">
						{node.children.map((child, index) =>
							renderBlockNode(child, `${key}-${index}`),
						)}
					</View>
				</View>
			);
		case "component":
			return (
				<View key={key} className="gap-3">
					{node.children.map((child, index) =>
						renderBlockNode(child, `${key}-${index}`),
					)}
				</View>
			);
	}
}

function renderListItem(
	list: ListNode,
	item: ListItemNode,
	index: number,
	key: string,
) {
	const marker = list.ordered
		? `${(list.start ?? 1) + index}.`
		: item.checked === true
			? "☑"
			: item.checked === false
				? "☐"
				: "•";
	return (
		<View key={key} className="flex-row gap-2">
			<Text className="text-muted-foreground leading-6">{marker}</Text>
			<View className="min-w-0 flex-1 gap-2">
				{item.children.map((child, childIndex) =>
					renderBlockNode(child, `${key}-${childIndex}`),
				)}
			</View>
		</View>
	);
}

function renderPreviewInlineNodes(
	nodes: InlineNode[],
	keyPrefix: string,
): ReactNode[] {
	return nodes.map((node, index) => {
		const key = `${keyPrefix}-${index}`;
		switch (node.type) {
			case "text":
				return node.value;
			case "break":
				return "\n";
			case "inlineCode":
				return (
					<Text
						key={key}
						className="bg-background-subtle text-foreground"
						style={{ fontFamily: MONO }}
					>
						{node.value}
					</Text>
				);
			case "strong":
				return (
					<Text
						key={key}
						className="text-foreground"
						style={{ fontFamily: BOLD }}
					>
						{renderPreviewInlineNodes(node.children, key)}
					</Text>
				);
			case "emphasis":
				return (
					<Text
						key={key}
						className="text-foreground"
						style={{ fontFamily: ITALIC }}
					>
						{renderPreviewInlineNodes(node.children, key)}
					</Text>
				);
			case "strike":
				return (
					<Text key={key} className="text-foreground line-through">
						{renderPreviewInlineNodes(node.children, key)}
					</Text>
				);
			case "link":
				return (
					<Text key={key} className="text-accent underline">
						{renderPreviewInlineNodes(node.children, key)}
					</Text>
				);
			case "image":
				return node.alt || "";
			case "footnoteReference":
				return `[${node.number}]`;
			case "inlineHtml":
				return node.value;
			default:
				return null;
		}
	});
}

function appendPreviewText(
	nodes: ReactNode[],
	value: ReactNode | null,
	separator = "\n",
) {
	if (value == null) {
		return;
	}
	if (nodes.length > 0) {
		nodes.push(separator);
	}
	if (Array.isArray(value)) {
		nodes.push(...value);
		return;
	}
	nodes.push(value);
}

function buildPreviewNodes(
	blocks: BlockNode[],
	keyPrefix: string,
): ReactNode[] {
	const nodes: ReactNode[] = [];

	for (const [index, block] of blocks.entries()) {
		const key = `${keyPrefix}-${index}`;
		switch (block.type) {
			case "heading":
			case "paragraph":
				appendPreviewText(nodes, renderPreviewInlineNodes(block.children, key));
				break;
			case "code":
				appendPreviewText(
					nodes,
					<Text
						key={`${key}-code`}
						className="text-foreground"
						style={{ fontFamily: MONO }}
					>
						{block.value}
					</Text>,
				);
				break;
			case "blockquote":
				appendPreviewText(nodes, buildPreviewNodes(block.children, key));
				break;
			case "list":
				for (const [itemIndex, item] of block.items.entries()) {
					const marker = block.ordered
						? `${(block.start ?? 1) + itemIndex}. `
						: item.checked === true
							? "☑ "
							: item.checked === false
								? "☐ "
								: "• ";
					appendPreviewText(nodes, [
						marker,
						...buildPreviewNodes(item.children, `${key}-${itemIndex}`),
					]);
				}
				break;
			case "thematicBreak":
				appendPreviewText(nodes, " ");
				break;
			case "html":
				appendPreviewText(nodes, block.value);
				break;
			case "table":
				appendPreviewText(nodes, [
					...block.header.flatMap((cell, cellIndex) => [
						cellIndex > 0 ? " | " : "",
						...renderPreviewInlineNodes(
							cell.children,
							`${key}-header-${cellIndex}`,
						),
					]),
				]);
				break;
			case "footnotes":
				for (const footnote of block.items) {
					appendPreviewText(nodes, buildPreviewNodes(footnote.children, key));
				}
				break;
			case "callout":
				appendPreviewText(nodes, [
					block.title,
					block.children.length > 0 ? "\n" : "",
					...buildPreviewNodes(block.children, key),
				]);
				break;
			case "component":
				appendPreviewText(nodes, buildPreviewNodes(block.children, key));
				break;
		}
	}

	return nodes;
}

export function MarkdownPreview({
	value,
	numberOfLines,
}: {
	value: string;
	numberOfLines: number;
}) {
	const document = parseReviewMarkdown(value);
	const nodes = buildPreviewNodes(document.children, "preview");

	return (
		<Text
			className="text-foreground leading-6"
			numberOfLines={numberOfLines}
			ellipsizeMode="tail"
		>
			{nodes}
		</Text>
	);
}

export function Markdown({ value }: { value: string }) {
	const document = parseReviewMarkdown(value);

	if (document.children.length === 0) {
		return null;
	}

	return (
		<View className="gap-3">
			{document.children.map((block, index) =>
				renderBlockNode(block, `block-${index}`),
			)}
		</View>
	);
}
