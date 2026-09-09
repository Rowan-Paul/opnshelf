import { useCallback } from "react";
import { useDialog } from "@/components/ui/dialog";

/**
 * Guards a "remove from shelf" tap that would delete more than one Watch.
 *
 * Every remove path unmarks with `mode: "all"`, so one tap on a card that
 * stands for several Watches wipes the lot. That is fine for a single Watch and
 * destructive-without-warning for a rewatch, so anything above one Watch asks
 * first. Mirrors the Web `ConfirmRemoveDialog`, down to its copy, so the same
 * action reads the same on both clients.
 */
export function useConfirmRemoveWatches() {
	const { showDialog } = useDialog();

	return useCallback(
		({
			title,
			entryCount,
			onConfirm,
		}: {
			/** The item as the user sees it on the card being removed. */
			title: string;
			/** Watches this removal would delete. One or fewer skips the dialog. */
			entryCount: number;
			onConfirm: () => void;
		}) => {
			if (entryCount <= 1) {
				onConfirm();
				return;
			}
			showDialog({
				title: "Remove all watches?",
				description: `This will remove all ${entryCount} watches of ${title}. This action cannot be undone.`,
				actions: [
					{ label: "Cancel" },
					{ label: "Remove all", variant: "destructive", onPress: onConfirm },
				],
			});
		},
		[showDialog],
	);
}
