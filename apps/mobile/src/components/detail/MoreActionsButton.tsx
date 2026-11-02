import {
	Calendar,
	ChevronRight,
	Disc,
	Heart,
	ListPlus,
	type LucideIcon,
	MoreHorizontal,
	Share2,
	StickyNote,
	X,
} from "lucide-react-native";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { NoteEditorSheet } from "@/components/detail/NoteEditorSheet";
import { AddToLibrarySheet } from "@/components/library/AddToLibrarySheet";
import { AddToListSheet } from "@/components/lists/AddToListSheet";
import { BottomSheetModal } from "@/components/ui/bottom-sheet-modal";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import { useDetailLayoutLock } from "@/lib/detail-layout-lock";
import { posthog } from "@/lib/posthog";
import { useLibraryOwnership } from "@/lib/use-library";
import { useListMembership } from "@/lib/use-lists";
import { useNote } from "@/lib/use-note";
import { useThemeColors } from "@/theme/colors";

type Target = {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
};

/**
 * The last button in the detail shelf row: opens a sheet with the less
 * frequent actions (date, Favorites, Note, Library, Lists, Share), like the
 * More menu in web's `MediaActionsBar`. A dot on the button says something in
 * the sheet is already set, since the row no longer shows it. Signed out, only
 * sharing applies, so the button is a plain Share button instead.
 */
export function MoreActionsButton({
	target,
	share,
	addWithDate,
}: {
	target: Target;
	/** The public web URL to share; absent until the slug's name is known. */
	share?: { url: string; title: string };
	/** Opens the shelf's date picker; absent when it does not apply. */
	addWithDate?: () => void;
}) {
	const colors = useThemeColors();
	const { isAuthenticated } = useAuth();
	const [sheet, setSheet] = useState<
		"more" | "note" | "library" | "lists" | null
	>(null);
	const lists = useListMembership(target);
	const library = useLibraryOwnership(target);
	const { note, saveNote, deleteNote, isSaving, isDeleting } = useNote(target);
	useDetailLayoutLock(sheet === "more");
	// Runs once the More sheet has closed: another sheet or the share sheet
	// presented while it is still closing would be dismissed with it on iOS.
	const afterMore = useRef<(() => void) | null>(null);

	const onShare = share
		? () => {
				// message carries the URL (Android ignores the `url` field); title
				// names the Android chooser. iOS shows the link from the message text.
				Share.share({ message: share.url, title: share.title })
					.then((result) => {
						if (result.action === Share.sharedAction) {
							posthog?.capture("share_completed", { surface: "media_detail" });
						}
					})
					.catch(() => {});
			}
		: undefined;

	if (!isAuthenticated) {
		return onShare ? (
			<SquareButton label="Share" onPress={onShare}>
				<Share2 color={colors.mutedForeground} size={20} />
			</SquareButton>
		) : null;
	}

	const isInFavorites =
		lists.memberships.find((l) => l.listSlug === "favorites")?.isInList ??
		false;
	const listCount = lists.memberships.filter(
		(l) => l.isInList && !l.isDefault,
	).length;
	const ownedCount = library.ownedFormats.size;
	const hasNote = !!note?.content;
	const hasHiddenState =
		isInFavorites || listCount > 0 || ownedCount > 0 || hasNote;
	const close = () => setSheet(null);
	const closeMoreThen = (next: () => void) => {
		afterMore.current = next;
		close();
	};

	return (
		<>
			<SquareButton
				label={hasHiddenState ? "More actions, some set" : "More actions"}
				onPress={() => setSheet("more")}
			>
				<MoreHorizontal color={colors.mutedForeground} size={20} />
				{hasHiddenState ? (
					<View className="absolute top-2 right-2 size-2 rounded-full bg-primary" />
				) : null}
			</SquareButton>

			<BottomSheetModal
				visible={sheet === "more"}
				onRequestClose={close}
				onClosed={() => {
					const next = afterMore.current;
					afterMore.current = null;
					next?.();
				}}
			>
				<View className="flex-1 justify-end">
					<Pressable className="flex-1" onPress={close} />
					<View className="gap-1 rounded-t-2xl border border-border bg-card p-5 pb-10">
						<View className="mb-2 flex-row items-center justify-between">
							<Text className="font-display-bold text-foreground text-lg">
								More
							</Text>
							<Pressable hitSlop={8} onPress={close} accessibilityLabel="Close">
								<X color={colors.mutedForeground} size={22} />
							</Pressable>
						</View>
						{addWithDate ? (
							<SheetRow
								icon={Calendar}
								label="Add with date"
								first
								onPress={() => closeMoreThen(addWithDate)}
							/>
						) : null}
						{/* A toggle keeps the sheet open so the change shows. */}
						<SheetRow
							icon={Heart}
							iconColor={isInFavorites ? colors.destructive : undefined}
							filled={isInFavorites}
							label={
								isInFavorites ? "Remove from Favorites" : "Add to Favorites"
							}
							disabled={lists.isPending}
							first={!addWithDate}
							onPress={() => lists.toggle("favorites", isInFavorites)}
						/>
						<SheetRow
							icon={StickyNote}
							filled={hasNote}
							label={hasNote ? "Edit note" : "Add note"}
							opensSheet
							onPress={() => closeMoreThen(() => setSheet("note"))}
						/>
						<SheetRow
							icon={Disc}
							active={ownedCount > 0}
							label={
								ownedCount > 0 ? `Owned · ${ownedCount}` : "Add to library"
							}
							opensSheet
							onPress={() => closeMoreThen(() => setSheet("library"))}
						/>
						<SheetRow
							icon={ListPlus}
							active={listCount > 0}
							label={listCount > 0 ? `Lists · ${listCount}` : "Add to a list"}
							opensSheet
							onPress={() => closeMoreThen(() => setSheet("lists"))}
						/>
						{onShare ? (
							<SheetRow
								icon={Share2}
								label="Share"
								onPress={() => closeMoreThen(onShare)}
							/>
						) : null}
					</View>
				</View>
			</BottomSheetModal>

			<NoteEditorSheet
				visible={sheet === "note"}
				onDismiss={close}
				isEditing={hasNote}
				initialContent={note?.content ?? ""}
				onSave={(content) => {
					saveNote(content);
					close();
				}}
				onDelete={
					note?.id
						? () => {
								deleteNote();
								close();
							}
						: undefined
				}
				isSaving={isSaving}
				isDeleting={isDeleting}
			/>
			<AddToLibrarySheet
				visible={sheet === "library"}
				onDismiss={close}
				ownedFormats={library.ownedFormats}
				isLoading={library.isLoading}
				onToggle={library.toggle}
			/>
			<AddToListSheet
				visible={sheet === "lists"}
				onDismiss={close}
				memberships={lists.memberships}
				isLoading={lists.isLoading}
				onToggle={lists.toggle}
			/>
		</>
	);
}

function SquareButton({
	label,
	onPress,
	children,
}: {
	label: string;
	onPress: () => void;
	children: ReactNode;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			className="size-12 items-center justify-center rounded-lg border border-border"
		>
			{children}
		</Pressable>
	);
}

function SheetRow({
	icon: Icon,
	label,
	onPress,
	filled = false,
	active = filled,
	iconColor,
	opensSheet = false,
	disabled = false,
	first = false,
}: {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
	/** Fills the icon, for the set state of heart and note. */
	filled?: boolean;
	/** Tints the icon with the accent, for the set state. */
	active?: boolean;
	iconColor?: string;
	/** Shows a chevron: the row opens another sheet. */
	opensSheet?: boolean;
	disabled?: boolean;
	/** The top row, which has no divider above it. */
	first?: boolean;
}) {
	const colors = useThemeColors();
	const color = iconColor ?? (active ? colors.accent : colors.mutedForeground);
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			disabled={disabled}
			className={cn(
				"flex-row items-center gap-3 py-3",
				!first && "border-border border-t",
			)}
			style={{ opacity: disabled ? 0.6 : 1 }}
		>
			<Icon color={color} fill={filled ? color : "transparent"} size={20} />
			<Text className="flex-1 font-medium text-foreground">{label}</Text>
			{opensSheet ? (
				<ChevronRight color={colors.mutedForeground} size={18} />
			) : null}
		</Pressable>
	);
}
