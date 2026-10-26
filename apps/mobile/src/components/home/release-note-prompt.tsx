import type { ReleaseNote } from "@opnshelf/api";
import { Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import {
	PromptCard,
	PromptSlotItem,
	usePromptCooldown,
} from "@/components/home/prompt-slot";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useReleaseNotes } from "@/lib/use-release-notes";

/** Holds the slot (and its height) while we learn whether there is news. */
function Placeholder() {
	return (
		<PromptSlotItem id="release-note">
			<View
				accessibilityLabel="Loading what’s new"
				className="gap-4 rounded-2xl border border-border p-5"
			>
				<View className="h-6 w-2/3 rounded bg-background-subtle" />
				<View className="h-10 rounded bg-background-subtle" />
				<View className="h-10 w-40 self-end rounded bg-background-subtle" />
			</View>
		</PromptSlotItem>
	);
}

export function ReleaseNotePrompt() {
	const { user } = useAuth();
	const notes = useReleaseNotes({ enabled: Boolean(user) });
	if (!user) return null;
	if (notes.isPending || notes.readPending) return <Placeholder />;
	const entry = notes.data?.[0];
	if (!notes.unread || !entry) return null;
	const storageKey = `release-note-prompt-${user.did.replaceAll(":", "-")}-${entry.slug}`;
	return (
		<Announcement key={storageKey} storageKey={storageKey} entry={entry} />
	);
}

function Announcement({
	storageKey,
	entry,
}: {
	storageKey: string;
	entry: ReleaseNote;
}) {
	const startCooldown = usePromptCooldown();
	const [dismissed, setDismissed] = useState<boolean | null>(null);
	useEffect(() => {
		let active = true;
		void SecureStore.getItemAsync(storageKey)
			.then((value) => {
				if (active) setDismissed(value === "1");
			})
			.catch(() => {
				if (active) setDismissed(false);
			});
		return () => {
			active = false;
		};
	}, [storageKey]);
	const dismiss = () => {
		setDismissed(true);
		void SecureStore.setItemAsync(storageKey, "1").catch(() => {});
		startCooldown();
	};
	if (dismissed === null) return <Placeholder />;
	if (dismissed) return null;
	return (
		<PromptSlotItem id="release-note">
			<PromptCard
				icon={Sparkles}
				title={entry.title}
				actions={
					<>
						<Button
							label="Dismiss"
							variant="ghost"
							size="sm"
							onPress={dismiss}
						/>
						<Link
							href={{
								pathname: "/whats-new/[slug]",
								params: { slug: entry.slug },
							}}
							asChild
						>
							<Button label="Read what’s new" size="sm" onPress={dismiss} />
						</Link>
					</>
				}
			>
				{entry.summary}
			</PromptCard>
		</PromptSlotItem>
	);
}
