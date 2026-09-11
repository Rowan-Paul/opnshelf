import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Plus, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { UserRow } from "@/components/social/UserRow";
import { useDialog } from "@/components/ui/dialog";
import { canLoadMore, LoadMoreFooter } from "@/components/ui/load-more";
import { UserRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import {
	useAddCircleMember,
	useCircleMembers,
	useCircles,
	useDeleteCircle,
	useRemoveCircleMember,
	useRenameCircle,
} from "@/lib/use-circles";
import { EndReachedScrollView } from "@/lib/use-end-reached";
import { useFollowing } from "@/lib/use-social";

/**
 * Circle detail: see and edit who's in a circle. Members (removable), the people
 * you follow who aren't in it yet (addable), plus rename and delete. Reached from
 * the Circles list under Social.
 */
export default function CircleDetailScreen() {
	const { circleId } = useLocalSearchParams<{ circleId: string }>();
	const router = useRouter();
	const { user } = useAuth();
	const { showDialog } = useDialog();

	const { data: circles = [] } = useCircles();
	const circle = circles.find((c) => c.id === circleId);

	const {
		data: membersData,
		isLoading: membersLoading,
		isError: membersError,
		refetch: refetchMembers,
	} = useCircleMembers(circleId);
	const members = membersData?.items ?? [];

	const following = useFollowing(user?.handle ?? "");
	const addable = following.items.filter(
		(u) => !(u.circleIds ?? []).includes(circleId),
	);
	// The addable list is the tail of the screen, so nearing the bottom pulls
	// the next page of people you follow. This screen owns the container, so
	// it listens through the prop rather than `useEndReached`.
	const loadMoreFollowing = () => {
		if (canLoadMore(following)) void following.fetchNextPage();
	};

	const addMember = useAddCircleMember();
	const removeMember = useRemoveCircleMember();
	const renameCircle = useRenameCircle();
	const deleteCircle = useDeleteCircle();

	const [name, setName] = useState("");
	useEffect(() => {
		if (circle) setName(circle.name);
	}, [circle]);

	const handleRename = () => {
		const trimmed = name.trim();
		if (trimmed && circle && trimmed !== circle.name) {
			renameCircle.mutate({ path: { circleId }, body: { name: trimmed } });
		}
	};

	const confirmDelete = () => {
		showDialog({
			title: `Delete "${circle?.name ?? "circle"}"?`,
			description: "This won't unfollow anyone — it just removes the circle.",
			actions: [
				{ label: "Cancel" },
				{
					label: "Delete",
					variant: "destructive",
					onPress: () =>
						deleteCircle.mutate(
							{ path: { circleId } },
							{ onSuccess: () => router.back() },
						),
				},
			],
		});
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: circle?.name ?? "Circle" }}
			/>

			<EndReachedScrollView
				contentContainerClassName="px-4 py-4 gap-6"
				onEndReached={loadMoreFollowing}
			>
				<View className="flex-row items-center gap-2">
					<View className="flex-1">
						<TextField
							value={name}
							onChangeText={setName}
							onBlur={handleRename}
							maxLength={50}
							returnKeyType="done"
							onSubmitEditing={handleRename}
						/>
					</View>
					<Pressable
						accessibilityLabel="Delete circle"
						onPress={confirmDelete}
						className="size-11 items-center justify-center rounded-lg border border-border"
					>
						<Trash2 color="#ef4444" size={18} />
					</Pressable>
				</View>

				<View className="gap-2">
					<Text className="font-display font-semibold text-foreground">
						Members ({members.length})
					</Text>
					{membersLoading ? (
						<UserRowsSkeleton />
					) : membersError ? (
						<ErrorState
							message="Couldn't load this Circle's members."
							onRetry={() => void refetchMembers()}
						/>
					) : members.length === 0 ? (
						<Text className="text-muted-foreground text-sm">
							No one in this circle yet. Add people below.
						</Text>
					) : (
						members.map((member) => {
							const pending =
								removeMember.isPending &&
								removeMember.variables?.path?.targetDid === member.did;
							return (
								<View key={member.did} className="flex-row items-center gap-2">
									<View className="flex-1">
										<UserRow user={member} isSelf onToggleFollow={() => {}} />
									</View>
									<Pressable
										onPress={() =>
											removeMember.mutate({
												path: { circleId, targetDid: member.did },
											})
										}
										disabled={pending}
										className="rounded-full border border-border px-3 py-1.5"
										style={{ opacity: pending ? 0.5 : 1 }}
									>
										<Text className="font-medium text-muted-foreground text-xs">
											{pending ? "Removing…" : "Remove"}
										</Text>
									</Pressable>
								</View>
							);
						})
					)}
				</View>

				<View className="gap-2">
					<Text className="font-display font-semibold text-foreground">
						Add people you follow
					</Text>
					{following.isLoading ? (
						<UserRowsSkeleton />
					) : addable.length === 0 ? (
						<EmptyState
							title="Nobody to add"
							message="Everyone you follow is already in this circle."
						/>
					) : (
						addable.map((u) => {
							const pending =
								addMember.isPending &&
								addMember.variables?.path?.targetDid === u.did;
							return (
								<View key={u.did} className="flex-row items-center gap-2">
									<View className="flex-1">
										<UserRow user={u} isSelf onToggleFollow={() => {}} />
									</View>
									<Pressable
										onPress={() =>
											addMember.mutate({ path: { circleId, targetDid: u.did } })
										}
										disabled={pending}
										className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-1.5"
										style={{ opacity: pending ? 0.5 : 1 }}
									>
										<Plus color="#3f2e00" size={14} strokeWidth={3} />
										<Text className="font-medium text-primary-foreground text-xs">
											{pending ? "Adding…" : "Add"}
										</Text>
									</Pressable>
								</View>
							);
						})
					)}
					<LoadMoreFooter
						isFetchingNextPage={following.isFetchingNextPage}
						isFetchNextPageError={following.isFetchNextPageError}
						onRetry={() => void following.fetchNextPage()}
						skeleton={<UserRowsSkeleton rows={2} />}
					/>
				</View>
			</EndReachedScrollView>
		</View>
	);
}
