import { usersControllerGetMySettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

interface SpoilerShieldProps {
	/** Author-declared Spoiler Flag on the review (ADR-0016). */
	spoiler: boolean;
	/** DID of the review's author, to never shield the viewer's own reviews. */
	authorDid?: string;
	children: ReactNode;
}

/**
 * Reader-facing Spoiler Shield: covers a flagged review's body until tapped.
 * Reveals are ephemeral (local `useState`, nothing persisted). Never shields
 * the viewer's own reviews, and is skipped entirely when the viewer has
 * "always show spoiler content" on; logged-out/other-profile viewing always
 * shields. The title is never passed through here — callers only wrap the
 * body/excerpt.
 */
export function SpoilerShield({
	spoiler,
	authorDid,
	children,
}: SpoilerShieldProps) {
	const { user, isAuthenticated } = useAuth();
	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: isAuthenticated,
	});
	const [revealed, setRevealed] = useState(false);

	const isOwn = isAuthenticated && !!authorDid && user?.did === authorDid;
	const alwaysShowSpoilers = settings?.alwaysShowSpoilers ?? false;

	if (!spoiler || isOwn || alwaysShowSpoilers || revealed) {
		return <>{children}</>;
	}

	return (
		<View className="flex-row items-center justify-between gap-3 rounded-lg border border-border bg-background-subtle px-3 py-2.5">
			<Text className="flex-1 text-muted-foreground text-sm">
				⚠️ Contains spoilers
			</Text>
			<Pressable
				onPress={() => setRevealed(true)}
				hitSlop={8}
				className="rounded-md border border-border px-2.5 py-1"
			>
				<Text className="font-medium text-foreground text-sm">Show</Text>
			</Pressable>
		</View>
	);
}
