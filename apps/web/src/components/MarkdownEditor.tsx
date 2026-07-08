import {
	defaultValueCtx,
	Editor,
	editorViewCtx,
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

/** A toolbar/bubble button. Prevents default mousedown so the editor keeps its
 * selection and focus when the command runs. */
function CommandButton({
	onRun,
	label,
	children,
}: {
	onRun: () => void;
	label: string;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onMouseDown={(e) => e.preventDefault()}
			onClick={onRun}
			className="flex size-7 items-center justify-center rounded text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--foreground)"
		>
			{children}
		</button>
	);
}

function MilkdownEditorInner({ value, onChange }: MarkdownEditorProps) {
	const [, getEditor] = useInstance();
	const [bubble, setBubble] = useState<BubblePos | null>(null);
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
				onRun={() => run(callCommand(toggleStrongCommand.key))}
			>
				<Bold className="size-3.5" />
			</CommandButton>
			<CommandButton
				label="Italic"
				onRun={() => run(callCommand(toggleEmphasisCommand.key))}
			>
				<Italic className="size-3.5" />
			</CommandButton>
			<CommandButton
				label="Inline code"
				onRun={() => run(callCommand(toggleInlineCodeCommand.key))}
			>
				<Code className="size-3.5" />
			</CommandButton>
			<CommandButton label="Link" onRun={addLink}>
				<LinkIcon className="size-3.5" />
			</CommandButton>
		</>
	);

	return (
		<div ref={wrapperRef} className="relative">
			<div className="mb-1 flex flex-wrap items-center gap-0.5 rounded-md border border-(--border) bg-(--background-elevated) p-1">
				<CommandButton
					label="Heading"
					onRun={() => run(callCommand(wrapInHeadingCommand.key, 2))}
				>
					<Heading2 className="size-3.5" />
				</CommandButton>
				<CommandButton
					label="Subheading"
					onRun={() => run(callCommand(wrapInHeadingCommand.key, 3))}
				>
					<Heading1 className="size-3.5" />
				</CommandButton>
				<span className="mx-1 h-4 w-px bg-(--border)" />
				{inlineTools}
				<span className="mx-1 h-4 w-px bg-(--border)" />
				<CommandButton
					label="Bullet list"
					onRun={() => run(callCommand(wrapInBulletListCommand.key))}
				>
					<List className="size-3.5" />
				</CommandButton>
				<CommandButton
					label="Numbered list"
					onRun={() => run(callCommand(wrapInOrderedListCommand.key))}
				>
					<ListOrdered className="size-3.5" />
				</CommandButton>
				<CommandButton
					label="Quote"
					onRun={() => run(callCommand(wrapInBlockquoteCommand.key))}
				>
					<Quote className="size-3.5" />
				</CommandButton>
				<CommandButton
					label="Code block"
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
 * existing review round-trips losslessly (see ADR-0005). Client-only — it must
 * not be rendered during SSR; ReviewDialog gates it behind a mount check.
 */
export default function MarkdownEditor(props: MarkdownEditorProps) {
	return (
		<MilkdownProvider>
			<MilkdownEditorInner {...props} />
		</MilkdownProvider>
	);
}
