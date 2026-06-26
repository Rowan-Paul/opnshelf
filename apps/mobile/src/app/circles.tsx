import type { CircleDto } from "@opnshelf/api";
import { Stack } from "expo-router";
import { Check, Pencil, Plus, Trash2, UsersRound } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import {
	useCircles,
	useCreateCircle,
	useDeleteCircle,
	useRenameCircle,
} from "@/lib/use-circles";

/**
 * Manage circles: private, named groups of people you follow used to filter the
 * activity feed. Create, rename, and delete here; add people from the
 * Connections screen. Reached from the Activity tab header.
 */
export default function CirclesScreen() {
	const { data: circles = [], isLoading } = useCircles();
	const createCircle = useCreateCircle();
	const renameCircle = useRenameCircle();
	const deleteCircle = useDeleteCircle();

	const [newName, setNewName] = useState("");
	const [editing, setEditing] = useState<{ id: string; value: string } | null>(
		null,
	);

	const handleCreate = () => {
		const name = newName.trim();
		if (!name) return;
		createCircle.mutate(
			{ body: { name } },
			{ onSuccess: () => setNewName("") },
		);
	};

	const handleRename = () => {
		if (!editing) return;
		const name = editing.value.trim();
		const original = circles.find((c) => c.id === editing.id);
		if (name && original && name !== original.name) {
			renameCircle.mutate({ path: { circleId: editing.id }, body: { name } });
		}
		setEditing(null);
	};

	const confirmDelete = (circle: CircleDto) => {
		Alert.alert(
			`Delete "${circle.name}"?`,
			"This won't unfollow anyone — it just removes the circle.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () => deleteCircle.mutate({ path: { circleId: circle.id } }),
				},
			],
		);
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: true, title: "Circles" }} />

			<View className="flex-row items-center gap-2 px-4 pt-3 pb-3">
				<View className="flex-1">
					<TextField
						value={newName}
						onChangeText={setNewName}
						placeholder="New circle name"
						maxLength={50}
						returnKeyType="done"
						onSubmitEditing={handleCreate}
					/>
				</View>
				<Pressable
					onPress={handleCreate}
					disabled={!newName.trim() || createCircle.isPending}
					className="size-11 items-center justify-center rounded-lg bg-primary"
					style={{
						opacity: !newName.trim() || createCircle.isPending ? 0.5 : 1,
					}}
				>
					<Plus color="#3f2e00" size={20} strokeWidth={3} />
				</Pressable>
			</View>

			{isLoading ? null : circles.length === 0 ? (
				<EmptyState
					icon={UsersRound}
					title="No circles yet"
					message="Create a circle above, then add people from the Connections screen to group your feed."
				/>
			) : (
				<ScrollView contentContainerClassName="gap-2 px-4 pb-8">
					{circles.map((circle) => {
						const isEditing = editing?.id === circle.id;
						return (
							<View
								key={circle.id}
								className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3"
							>
								{isEditing ? (
									<>
										<View className="flex-1">
											<TextField
												variant="subtle"
												autoFocus
												value={editing.value}
												onChangeText={(value) =>
													setEditing({ id: circle.id, value })
												}
												maxLength={50}
												returnKeyType="done"
												onSubmitEditing={handleRename}
											/>
										</View>
										<Pressable
											hitSlop={8}
											onPress={handleRename}
											className="size-9 items-center justify-center rounded-full bg-primary"
										>
											<Check color="#3f2e00" size={16} strokeWidth={3} />
										</Pressable>
									</>
								) : (
									<>
										<View className="min-w-0 flex-1">
											<Text
												className="font-medium text-foreground text-sm"
												numberOfLines={1}
											>
												{circle.name}
											</Text>
											<Text className="text-muted-foreground text-xs">
												{circle.memberCount}{" "}
												{circle.memberCount === 1 ? "person" : "people"}
											</Text>
										</View>
										<Pressable
											hitSlop={8}
											onPress={() =>
												setEditing({ id: circle.id, value: circle.name })
											}
											className="size-9 items-center justify-center rounded-full border border-border"
										>
											<Pencil color="#94a3b8" size={16} />
										</Pressable>
										<Pressable
											hitSlop={8}
											onPress={() => confirmDelete(circle)}
											className="size-9 items-center justify-center rounded-full border border-border"
										>
											<Trash2 color="#ef4444" size={16} />
										</Pressable>
									</>
								)}
							</View>
						);
					})}
				</ScrollView>
			)}
		</View>
	);
}
