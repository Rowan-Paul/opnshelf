import { Link, Stack, useRouter } from "expo-router";
import { ChevronRight, Plus, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ListRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useCircles, useCreateCircle } from "@/lib/use-circles";

/** Owned Circles and their creation flow. Editing stays on the detail route. */
export default function CirclesScreen() {
	const router = useRouter();
	const { data: circles = [], isLoading, isError } = useCircles();
	const createCircle = useCreateCircle();
	const [name, setName] = useState("");

	const create = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		createCircle.mutate(
			{ body: { name: trimmed } },
			{
				onSuccess: (circle) => {
					setName("");
					router.push(`/social/circles/${circle.id}` as const);
				},
			},
		);
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: true, title: "Circles" }} />
			<ScrollView contentContainerClassName="gap-4 px-4 py-4 pb-8">
				<Text className="text-muted-foreground text-sm">
					Group people you follow to filter your Activity Feed.
				</Text>
				<View className="flex-row items-end gap-2">
					<View className="flex-1">
						<TextField
							value={name}
							onChangeText={setName}
							placeholder="New Circle name"
							maxLength={50}
							returnKeyType="done"
							onSubmitEditing={create}
						/>
					</View>
					<Pressable
						onPress={create}
						disabled={!name.trim() || createCircle.isPending}
						className="size-11 items-center justify-center rounded-lg bg-primary"
						style={{
							opacity: !name.trim() || createCircle.isPending ? 0.5 : 1,
						}}
					>
						<Plus color="#3f2e00" size={20} strokeWidth={3} />
					</Pressable>
				</View>

				{isLoading ? (
					<ListRowsSkeleton />
				) : isError ? (
					<ErrorState message="Couldn't load your Circles." />
				) : circles.length === 0 ? (
					<EmptyState
						icon={Users}
						title="No Circles yet"
						message="Create your first Circle, then add people you follow."
					/>
				) : (
					<View className="gap-2">
						{circles.map((circle) => (
							<Link
								key={circle.id}
								href={`/social/circles/${circle.id}` as const}
								asChild
							>
								<Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-4">
									<View className="min-w-0 flex-1">
										<Text
											className="font-medium text-foreground"
											numberOfLines={1}
										>
											{circle.name}
										</Text>
										<Text className="text-muted-foreground text-xs">
											{circle.memberCount}{" "}
											{circle.memberCount === 1 ? "person" : "people"}
										</Text>
									</View>
									<ChevronRight color="#94a3b8" size={18} />
								</Pressable>
							</Link>
						))}
					</View>
				)}
			</ScrollView>
		</View>
	);
}
