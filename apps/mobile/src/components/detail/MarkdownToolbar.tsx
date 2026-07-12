import {
	Bold,
	Code,
	Heading2,
	Heading3,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	type LucideIcon,
	Quote,
	SquareCode,
} from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { useDialog } from "@/components/ui/dialog";
import {
	insertLink,
	type MarkdownEdit,
	type TextSelection,
	toggleBulletList,
	toggleCodeBlock,
	toggleHeading,
	toggleOrderedList,
	toggleQuote,
	wrapInline,
} from "@/lib/markdown-format";

interface MarkdownToolbarProps {
	value: string;
	selection: TextSelection;
	/** Apply a transform's result back to the editor (text + new selection). */
	onChange: (edit: MarkdownEdit) => void;
}

const ICON_COLOR = "#94a3b8";

function ToolbarButton({
	icon: Icon,
	label,
	onPress,
}: {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityLabel={label}
			hitSlop={6}
			onPress={onPress}
			className="h-9 w-9 items-center justify-center rounded-md active:bg-background-strong"
		>
			<Icon color={ICON_COLOR} size={18} />
		</Pressable>
	);
}

function Divider() {
	return <View className="mx-0.5 h-5 w-px self-center bg-border" />;
}

/**
 * Formatting toolbar for the markdown review editor. Each button rewrites the
 * underlying markdown string via the pure helpers in `markdown-format` and
 * repositions the selection — markdown stays the source of truth, so the
 * round-trip is lossless. Mirrors the web editor's button set.
 */
export function MarkdownToolbar({
	value,
	selection,
	onChange,
}: MarkdownToolbarProps) {
	const { showDialog } = useDialog();
	const handleLink = () => {
		showDialog({
			title: "Add link",
			description: "Enter the URL",
			actions: [{ label: "Cancel" }],
			input: {
				initialValue: "https://",
				placeholder: "https://example.com",
				onSubmit: (url) => {
					if (url.trim()) onChange(insertLink(value, selection, url.trim()));
				},
			},
		});
	};

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			keyboardShouldPersistTaps="always"
			contentContainerClassName="items-center gap-0.5 px-1"
			className="rounded-lg border border-border bg-background-elevated"
		>
			<ToolbarButton
				icon={Heading2}
				label="Heading"
				onPress={() => onChange(toggleHeading(value, selection, 2))}
			/>
			<ToolbarButton
				icon={Heading3}
				label="Subheading"
				onPress={() => onChange(toggleHeading(value, selection, 3))}
			/>
			<Divider />
			<ToolbarButton
				icon={Bold}
				label="Bold"
				onPress={() => onChange(wrapInline(value, selection, "**"))}
			/>
			<ToolbarButton
				icon={Italic}
				label="Italic"
				onPress={() => onChange(wrapInline(value, selection, "*"))}
			/>
			<ToolbarButton
				icon={Code}
				label="Inline code"
				onPress={() => onChange(wrapInline(value, selection, "`"))}
			/>
			<ToolbarButton icon={LinkIcon} label="Link" onPress={handleLink} />
			<Divider />
			<ToolbarButton
				icon={List}
				label="Bullet list"
				onPress={() => onChange(toggleBulletList(value, selection))}
			/>
			<ToolbarButton
				icon={ListOrdered}
				label="Numbered list"
				onPress={() => onChange(toggleOrderedList(value, selection))}
			/>
			<ToolbarButton
				icon={Quote}
				label="Quote"
				onPress={() => onChange(toggleQuote(value, selection))}
			/>
			<ToolbarButton
				icon={SquareCode}
				label="Code block"
				onPress={() => onChange(toggleCodeBlock(value, selection))}
			/>
		</ScrollView>
	);
}
