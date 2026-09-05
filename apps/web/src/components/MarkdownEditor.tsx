import {
	defaultValueCtx,
	Editor,
	editorViewCtx,
	prosePluginsCtx,
	rootCtx,
} from "@milkdown/kit/core";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import {
	commonmark,
	createCodeBlockCommand,
	toggleEmphasisCommand,
	toggleInlineCodeCommand,
	toggleLinkCommand,
	toggleStrongCommand,
	wrapInBlockquoteCommand,
	wrapInBulletListCommand,
	wrapInHeadingCommand,
	wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { type EditorState, Plugin } from "@milkdown/kit/prose/state";
import { callCommand } from "@milkdown/kit/utils";
import {
	Milkdown,
	MilkdownProvider,
	useEditor,
	useInstance,
} from "@milkdown/react";
import {
	Bold,
	Code,
	Heading1,
	Heading2,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	Quote,
	SquareCode,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

interface MarkdownEditorProps {
	/** Initial markdown. Read once at mount — remount (via `key`) to reset. */
	value: string;
	/** Fires with the serialized markdown on every change. */
	onChange: (markdown: string) => void;
}

// Box + ProseMirror content styling, mirroring the read renderer so the WYSIWYG
// surface matches how the review reads. `.ProseMirror` is the contenteditable
// root Milkdown mounts.
const EDITOR_CLASS = [
	"input min-h-[200px] overflow-auto",
	"[&_.ProseMirror]:min-h-[180px] [&_.ProseMirror]:space-y-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:outline-none",
	"[&_.ProseMirror_h1]:font-display [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:text-lg",
	"[&_.ProseMirror_h2]:font-display [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-lg",
	"[&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h4]:font-semibold [&_.ProseMirror_h5]:font-semibold [&_.ProseMirror_h6]:font-semibold",
	"[&_.ProseMirror_ul]:list-inside [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:space-y-1",
	"[&_.ProseMirror_ol]:list-inside [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:space-y-1",
	"[&_.ProseMirror_blockquote]:border-(--border) [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-(--foreground-muted) [&_.ProseMirror_blockquote]:italic",
	"[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-(--background-subtle) [&_.ProseMirror_code]:px-1",
	"[&_.ProseMirror_pre]:overflow-auto [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:bg-(--background-subtle) [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:text-xs",
	"[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0",
	"[&_.ProseMirror_a]:text-(--accent) [&_.ProseMirror_a]:underline",
].join(" ");

type BubblePos = { left: number; top: number };

interface ActiveFormatting {
	heading: boolean;
	subheading: boolean;
	bold: boolean;
	italic: boolean;
	inlineCode: boolean;
	link: boolean;
	bulletList: boolean;
	orderedList: boolean;
	quote: boolean;
	codeBlock: boolean;
}

/** A toolbar/bubble button. Prevents default mousedown so the editor keeps its
 * selection and focus when the command runs. */
function CommandButton({
	onRun,
	label,
	active,
	children,
}: {
	onRun: () => void;
	label: string;
	active?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={active}
			title={label}
			onMouseDown={(e) => e.preventDefault()}
			onClick={onRun}
			className={`flex size-7 items-center justify-center rounded transition-colors ${
				active
					? "bg-(--accent) text-(--accent-foreground)"
					: "text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--foreground)"
			}`}
		>
			{children}
		</button>
	);
}

export function isMarkActive(state: EditorState, markName: string) {
	const mark = state.schema.marks[markName];
	if (!mark) return false;

	const { empty, from, to, $from } = state.selection;
	if (empty) {
		return Boolean(mark.isInSet(state.storedMarks ?? $from.marks()));
	}

	return state.doc.rangeHasMark(from, to, mark);
}

export function isNodeActive(
	state: EditorState,
	nodeName: string,
	attrs: Record<string, unknown> = {},
) {
	const nodeType = state.schema.nodes[nodeName];
	if (!nodeType) return false;

	const matches = (node: ProseNode) =>
		node.type === nodeType &&
		Object.entries(attrs).every(([key, value]) => node.attrs[key] === value);
	const { $from, $to, from, to } = state.selection;

	for (let depth = $from.depth; depth >= 0; depth -= 1) {
		if (matches($from.node(depth))) return true;
	}
	for (let depth = $to.depth; depth >= 0; depth -= 1) {
		if (matches($to.node(depth))) return true;
	}

	let active = false;
	state.doc.nodesBetween(from, to, (node) => {
		if (matches(node)) active = true;
		return !active;
	});
	return active;
}

export function getActiveFormatting(state: EditorState): ActiveFormatting {
	return {
		heading: isNodeActive(state, "heading", { level: 2 }),
		subheading: isNodeActive(state, "heading", { level: 3 }),
		bold: isMarkActive(state, "strong"),
		italic: isMarkActive(state, "emphasis"),
		inlineCode: isMarkActive(state, "inlineCode"),
		link: isMarkActive(state, "link"),
		bulletList: isNodeActive(state, "bullet_list"),
		orderedList: isNodeActive(state, "ordered_list"),
		quote: isNodeActive(state, "blockquote"),
		codeBlock: isNodeActive(state, "code_block"),
	};
}

const EMPTY_FORMATTING: ActiveFormatting = {
	heading: false,
	subheading: false,
	bold: false,
	italic: false,
	inlineCode: false,
	link: false,
	bulletList: false,
	orderedList: false,
	quote: false,
	codeBlock: false,
};

function formattingIsEqual(
	left: ActiveFormatting,
	right: ActiveFormatting,
): boolean {
	return Object.keys(left).every(
		(key) =>
			left[key as keyof ActiveFormatting] ===
			right[key as keyof ActiveFormatting],
	);
}

function MilkdownEditorInner({ value, onChange }: MarkdownEditorProps) {
	const [, getEditor] = useInstance();
	const [bubble, setBubble] = useState<BubblePos | null>(null);
	const [activeFormatting, setActiveFormatting] = useState(EMPTY_FORMATTING);
	const wrapperRef = useRef<HTMLDivElement>(null);

	// Keep callbacks current without re-creating the editor (deps: []).
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const initialValueRef = useRef(value);

	useEditor(
		(root) =>
			Editor.make()
				.config((ctx) => {
					ctx.set(rootCtx, root);
					ctx.set(defaultValueCtx, initialValueRef.current);
					ctx.update(prosePluginsCtx, (plugins) =>
						plugins.concat(
							new Plugin({
								view: (view) => {
									const updateActiveFormatting = (state: EditorState) => {
										const next = getActiveFormatting(state);
										setActiveFormatting((current) =>
											formattingIsEqual(current, next) ? current : next,
										);
									};
									updateActiveFormatting(view.state);

									return {
										update: (nextView) =>
											updateActiveFormatting(nextView.state),
									};
								},
							}),
						),
					);

					const l = ctx.get(listenerCtx);
					l.markdownUpdated((_ctx, markdown) => {
						onChangeRef.current(markdown);
					});
					l.selectionUpdated((selCtx) => {
						const view = selCtx.get(editorViewCtx);
						// `updateId` and other setup transactions fire selectionUpdated
						// before the view's state is attached — bail until it exists.
						if (!view?.state) return;
						const sel = view.state.selection;
						const wrap = wrapperRef.current?.getBoundingClientRect();
						if (sel.empty || !view.hasFocus() || !wrap) {
							setBubble(null);
							return;
						}
						const start = view.coordsAtPos(sel.from);
						const end = view.coordsAtPos(sel.to);
						setBubble({
							left: (start.left + end.left) / 2 - wrap.left,
							top: start.top - wrap.top,
						});
					});
				})
				.use(commonmark)
				.use(history)
				.use(listener),
		[],
	);

	// `callCommand(...)` returns an editor action; run it against the instance.
	const run = (action: ReturnType<typeof callCommand>) => {
		getEditor()?.action(action);
	};

	const addLink = () => {
		const href = window.prompt("Link URL");
		if (href) run(callCommand(toggleLinkCommand.key, { href }));
	};

	const inlineTools = (
		<>
			<CommandButton
				label="Bold"
				active={activeFormatting.bold}
				onRun={() => run(callCommand(toggleStrongCommand.key))}
			>
				<Bold className="size-3.5" />
			</CommandButton>
			<CommandButton
				label="Italic"
				active={activeFormatting.italic}
				onRun={() => run(callCommand(toggleEmphasisCommand.key))}
			>
				<Italic className="size-3.5" />
			</CommandButton>
			<CommandButton
				label="Inline code"
				active={activeFormatting.inlineCode}
				onRun={() => run(callCommand(toggleInlineCodeCommand.key))}
			>
				<Code className="size-3.5" />
			</CommandButton>
			<CommandButton
				label="Link"
				active={activeFormatting.link}
				onRun={addLink}
			>
				<LinkIcon className="size-3.5" />
			</CommandButton>
		</>
	);

	return (
		<div ref={wrapperRef} className="relative">
			<div className="mb-1 flex flex-wrap items-center gap-0.5 rounded-md border border-(--border) bg-(--background-elevated) p-1">
				<CommandButton
					label="Heading"
					active={activeFormatting.heading}
					onRun={() => run(callCommand(wrapInHeadingCommand.key, 2))}
				>
					<Heading2 className="size-3.5" />
				</CommandButton>
				<CommandButton
					label="Subheading"
					active={activeFormatting.subheading}
					onRun={() => run(callCommand(wrapInHeadingCommand.key, 3))}
				>
					<Heading1 className="size-3.5" />
				</CommandButton>
				<span className="mx-1 h-4 w-px bg-(--border)" />
				{inlineTools}
				<span className="mx-1 h-4 w-px bg-(--border)" />
				<CommandButton
					label="Bullet list"
					active={activeFormatting.bulletList}
					onRun={() => run(callCommand(wrapInBulletListCommand.key))}
				>
					<List className="size-3.5" />
				</CommandButton>
				<CommandButton
					label="Numbered list"
					active={activeFormatting.orderedList}
					onRun={() => run(callCommand(wrapInOrderedListCommand.key))}
				>
					<ListOrdered className="size-3.5" />
				</CommandButton>
				<CommandButton
					label="Quote"
					active={activeFormatting.quote}
					onRun={() => run(callCommand(wrapInBlockquoteCommand.key))}
				>
					<Quote className="size-3.5" />
				</CommandButton>
				<CommandButton
					label="Code block"
					active={activeFormatting.codeBlock}
					onRun={() => run(callCommand(createCodeBlockCommand.key))}
				>
					<SquareCode className="size-3.5" />
				</CommandButton>
			</div>

			{bubble && (
				<div
					className="absolute z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-md border border-(--border) bg-(--background-elevated) p-1 shadow-lg"
					style={{ left: bubble.left, top: bubble.top - 6 }}
				>
					{inlineTools}
				</div>
			)}

			<div className={EDITOR_CLASS}>
				<Milkdown />
			</div>
		</div>
	);
}

/**
 * WYSIWYG markdown editor (Milkdown, headless CommonMark preset) for authoring
 * reviews. Markdown is the source of truth: the editor parses markdown in via
 * `defaultValueCtx` and serializes markdown out on every change, so editing an
 * existing review round-trips losslessly (see ADR-0028). Client-only — it must
 * not be rendered during SSR; ReviewDialog gates it behind a mount check.
 */
export default function MarkdownEditor(props: MarkdownEditorProps) {
	return (
		<MilkdownProvider>
			<MilkdownEditorInner {...props} />
		</MilkdownProvider>
	);
}
