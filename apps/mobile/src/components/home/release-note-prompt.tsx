import type { ReleaseNote } from "@opnshelf/api";
import { Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useReleaseNotes } from "@/lib/use-release-notes";

function Placeholder() {
	return (
		<View
			accessibilityLabel="Loading what’s new"
			className="gap-4 rounded-2xl border border-border p-5"
		>
			<View className="h-6 w-2/3 rounded bg-background-subtle" />
			<View className="h-10 rounded bg-background-subtle" />
			<View className="h-10 w-40 self-end rounded bg-background-subtle" />
		</View>
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
	};
	if (dismissed === null) return <Placeholder />;
	if (dismissed) return null;
	return (
		<View className="gap-4 rounded-2xl border border-border bg-card p-5">
			<View className="flex-row items-start gap-3">
				<View className="rounded-full bg-primary/10 p-3">
					<Sparkles color="#f3bc00" size={20} />
				</View>
				<View className="flex-1 gap-1">
					<Text className="font-display font-semibold text-foreground text-lg">
						{entry.title}
					</Text>
					<Text className="text-muted-foreground text-sm leading-5">
						{entry.summary}
					</Text>
				</View>
			</View>
			<View className="flex-row flex-wrap justify-end gap-2">
				<Button
					label="Dismiss"
					variant="secondary"
					size="sm"
					onPress={dismiss}
				/>
				<Link
					href={{ pathname: "/whats-new/[slug]", params: { slug: entry.slug } }}
					asChild
				>
					<Button label="Read what’s new" size="sm" onPress={dismiss} />
				</Link>
			</View>
		</View>
	);
}
