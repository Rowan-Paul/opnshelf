import { Check, UserPlus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/**
 * Optimistic follow/unfollow toggle. Holds local state so the tap feels
 * instant; re-syncs to the server value when the parent's `following` prop
 * changes (after the social caches are invalidated and refetch).
 */
export function FollowButton({
	following,
	onToggle,
}: {
	following: boolean;
	onToggle: (currentlyFollowing: boolean) => void;
}) {
	const [optimistic, setOptimistic] = useState(following);

	useEffect(() => {
		setOptimistic(following);
	}, [following]);

	const handlePress = () => {
		onToggle(optimistic);
		setOptimistic((v) => !v);
	};

	return (
		<Pressable
			onPress={handlePress}
			hitSlop={6}
			className={cn(
				"flex-row items-center gap-1.5 rounded-full px-3 py-1.5",
				optimistic ? "border border-border bg-card" : "bg-primary",
			)}
		>
			{optimistic ? (
				<>
					<Check color="#94a3b8" size={14} strokeWidth={3} />
					<Text className="font-medium text-muted-foreground text-xs">
						Following
					</Text>
				</>
			) : (
				<>
					<UserPlus color="#3f2e00" size={14} />
					<Text className="font-medium text-primary-foreground text-xs">
						Follow
					</Text>
				</>
			)}
		</Pressable>
	);
}
