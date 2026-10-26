import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotesTab } from "./NotesTab";

const profile = vi.hoisted(() => ({
	useNotes: vi.fn(),
	endReached: { current: undefined as (() => void) | undefined },
	showDialog: vi.fn(),
	mutate: vi.fn(),
	invalidateUserNotes: vi.fn(),
	invalidateQueries: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	notesControllerDeleteNoteMutation: () => ({}),
	notesControllerGetNoteQueryKey: () => ["notes", "item"],
	notesControllerUpsertNoteMutation: () => ({}),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({ isPending: false, mutate: profile.mutate }),
	useQueryClient: () => ({ invalidateQueries: profile.invalidateQueries }),
}));

vi.mock("@/lib/use-note", () => ({
	invalidateUserNotesQueries: profile.invalidateUserNotes,
}));
vi.mock("@/components/detail/NoteEditorSheet", async () => {
	const { createElement } = await import("react");
	return {
		NoteEditorSheet: (props: Record<string, unknown>) =>
			createElement("note-editor", props),
	};
});
vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: profile.showDialog }),
}));
vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/use-public-profile", () => ({
	useInfiniteProfileNotes: profile.useNotes,
}));

// Captures the tab's end-reached callback so the test can act as the scroll
// container nearing its bottom.
vi.mock("@/lib/use-end-reached", () => ({
	useEndReached: (callback: () => void) => {
		profile.endReached.current = callback;
	},
}));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		ActivityIndicator: () => createElement("activity-indicator"),
		Pressable: (props: Record<string, unknown>) =>
			createElement("pressable", props, props.children as never),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
	};
});

vi.mock("lucide-react-native", async () => {
	const { createElement } = await import("react");
	return {
		Pencil: () => createElement("icon"),
		StickyNote: () => createElement("sticky-note"),
		Trash2: () => createElement("icon"),
	};
});

vi.mock("@/components/profile/ProfileContentCard", async () => {
	const { createElement } = await import("react");
	return {
		ProfileContentCard: (props: Record<string, unknown>) =>
			createElement(
				"profile-card",
				props,
				createElement("text", null, props.title as string),
				props.headerRight as never,
				props.children as never,
			),
	};
});

vi.mock("@/components/ui/skeletons", async () => {
	const { createElement } = await import("react");
	return { ReviewsSkeleton: () => createElement("skeleton") };
});

vi.mock("@/components/ui/states", async () => {
	const { createElement } = await import("react");
	return {
		EmptyState: (props: Record<string, unknown>) =>
			createElement("empty-state", props),
		ErrorState: (props: Record<string, unknown>) =>
			createElement("error-state", props),
	};
});

vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

vi.mock("@/lib/media-href", () => ({ mediaHref: () => "/media" }));

const note = (id: string, title: string) => ({
	id,
	mediaType: "movie",
	mediaId: `m${id}`,
	mediaLabel: title,
	mediaTitle: title,
	content: `${title} content`,
	updatedAt: "2026-07-20T00:00:00.000Z",
	posterPath: null,
});

function renderedText(renderer: ReactTestRenderer) {
	return renderer.root
		.findAllByType("text")
		.flatMap((node) => node.children)
		.filter((child): child is string => typeof child === "string");
}

beforeEach(() => {
	profile.useNotes.mockReset();
	profile.endReached.current = undefined;
	profile.showDialog.mockReset();
	profile.mutate.mockReset();
	profile.invalidateUserNotes.mockReset();
	profile.invalidateQueries.mockReset();
});

function loaded(items: ReturnType<typeof note>[]) {
	return {
		data: { pages: [{ items, hasNextPage: false }] },
		isLoading: false,
		isError: false,
		fetchNextPage: vi.fn(),
		hasNextPage: false,
		isFetchingNextPage: false,
	};
}

function pressable(renderer: ReactTestRenderer, label: string) {
	return renderer.root
		.findAllByType("pressable" as never)
		.find((node) => node.props.accessibilityLabel === label);
}

describe("NotesTab", () => {
	it("appends the next page when the scroll container nears its end", () => {
		const fetchNextPage = vi.fn();
		let state = {
			data: { pages: [{ items: [note("1", "First")], hasNextPage: true }] },
			isLoading: false,
			isError: false,
			fetchNextPage,
			hasNextPage: true,
			isFetchingNextPage: false,
		};
		profile.useNotes.mockImplementation(() => state);
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<NotesTab userDid="did:one" isOwner={false} />);
		});
		expect(renderer.root.findAllByType("pressable" as never)).toHaveLength(0);

		act(() => profile.endReached.current?.());
		expect(fetchNextPage).toHaveBeenCalledTimes(1);

		// While the page is in flight a trailing skeleton stands in for it and
		// another end-reached signal does not start a second request.
		state = { ...state, isFetchingNextPage: true };
		act(() => renderer.update(<NotesTab userDid="did:one" isOwner={false} />));
		expect(renderer.root.findAllByType("skeleton" as never)).toHaveLength(1);
		act(() => profile.endReached.current?.());
		expect(fetchNextPage).toHaveBeenCalledTimes(1);

		state = {
			...state,
			data: {
				pages: [
					{ items: [note("1", "First")], hasNextPage: true },
					{ items: [note("2", "Second")], hasNextPage: false },
				],
			},
			isFetchingNextPage: false,
			hasNextPage: false,
		};
		act(() => renderer.update(<NotesTab userDid="did:one" isOwner={false} />));

		const text = renderedText(renderer);
		expect(text.filter((value) => value === "First")).toHaveLength(1);
		expect(text.filter((value) => value === "Second")).toHaveLength(1);
		expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
		expect(renderer.root.findAllByType("skeleton" as never)).toHaveLength(0);
	});

	it("does not show the previous user's pages while a new profile loads", () => {
		profile.useNotes.mockImplementation((userDid: string) => {
			if (userDid === "did:a") {
				return {
					data: {
						pages: [{ items: [note("a", "A note")], hasNextPage: false }],
					},
					isLoading: false,
					isError: false,
					fetchNextPage: vi.fn(),
					hasNextPage: false,
					isFetchingNextPage: false,
				};
			}
			return {
				data: undefined,
				isLoading: true,
				isError: false,
				fetchNextPage: vi.fn(),
				hasNextPage: false,
				isFetchingNextPage: false,
			};
		});
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<NotesTab userDid="did:a" isOwner={false} />);
		});
		expect(renderedText(renderer)).toContain("A note");

		act(() => renderer.update(<NotesTab userDid="did:b" isOwner={false} />));
		expect(renderedText(renderer)).not.toContain("A note");
		expect(renderer.root.findAllByType("skeleton" as never)).toHaveLength(1);
	});

	it("gives the owner Edit and Delete, and visitors neither", () => {
		profile.useNotes.mockReturnValue(loaded([note("1", "First")]));
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<NotesTab userDid="did:one" isOwner={false} />);
		});
		expect(pressable(renderer, "Edit note")).toBeUndefined();
		expect(renderer.root.findAllByType("note-editor" as never)).toHaveLength(0);

		act(() => renderer.update(<NotesTab userDid="did:one" isOwner />));
		const editor = renderer.root.findByType("note-editor" as never);
		expect(editor.props.visible).toBe(false);
		act(() =>
			pressable(renderer, "Edit note")?.props.onPress({
				stopPropagation: vi.fn(),
			}),
		);
		expect(
			renderer.root.findByType("note-editor" as never).props,
		).toMatchObject({
			visible: true,
			initialContent: "First content",
			isEditing: true,
		});

		// Saving upserts the same media coordinates with the trimmed content.
		act(() =>
			renderer.root.findByType("note-editor" as never).props.onSave("  New  "),
		);
		expect(profile.mutate).toHaveBeenCalledWith(
			{
				body: {
					mediaType: "movie",
					mediaId: "m1",
					seasonNumber: undefined,
					episodeNumber: undefined,
					content: "New",
				},
			},
			expect.anything(),
		);
	});

	it("deletes a note only after the owner confirms", () => {
		profile.useNotes.mockReturnValue(loaded([note("1", "First")]));
		profile.mutate.mockImplementation(
			(_variables: unknown, options?: { onSuccess?: () => void }) =>
				options?.onSuccess?.(),
		);
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<NotesTab userDid="did:one" isOwner />);
		});
		act(() =>
			pressable(renderer, "Delete note")?.props.onPress({
				stopPropagation: vi.fn(),
			}),
		);
		expect(profile.mutate).not.toHaveBeenCalled();
		const dialog = profile.showDialog.mock.calls[0][0];
		expect(dialog.title).toBe("Delete note?");

		act(() =>
			dialog.actions
				.find(
					(action: { variant?: string }) => action.variant === "destructive",
				)
				.onPress(),
		);
		expect(profile.mutate).toHaveBeenCalledWith(
			{ path: { noteId: "1" } },
			expect.anything(),
		);
		expect(profile.invalidateUserNotes).toHaveBeenCalledWith(
			expect.anything(),
			"did:one",
		);
		expect(profile.invalidateQueries).toHaveBeenCalledWith({
			queryKey: ["notes", "item"],
		});
	});

	it("uses the owner and visitor empty-state copy", () => {
		profile.useNotes.mockReturnValue(loaded([]));
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(<NotesTab userDid="did:one" isOwner />);
		});
		expect(renderer.root.findByType("empty-state" as never).props.message).toBe(
			"You haven't written any notes yet.",
		);
		act(() => renderer.update(<NotesTab userDid="did:one" isOwner={false} />));
		expect(renderer.root.findByType("empty-state" as never).props.message).toBe(
			"No notes yet.",
		);
	});
});
