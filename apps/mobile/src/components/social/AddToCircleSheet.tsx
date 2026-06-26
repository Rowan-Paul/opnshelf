import type { CircleDto } from "@opnshelf/api";
import { Check, Plus, X } from "lucide-react-native";
import { useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { useCreateCircle } from "@/lib/use-circles";

/**
 * Bottom sheet listing the viewer's circles with membership checkmarks for one
 * followed user. Tapping a row toggles that user in/out of the circle. A
 * followed user may belong to many circles, so the sheet stays open. Includes an
 * inline "new circle" field so you can create-and-add without leaving the flow.
 */
export function AddToCircleSheet({
	visible,
	onDismiss,
	circles,
	memberOf,
	onToggle,
}: {
	visible: boolean;
	onDismiss: () => void;
	circles: CircleDto[];
	memberOf: string[];
	onToggle: (circleId: string, isMember: boolean) => void;
}) {
	const member = new Set(memberOf);
	const [newName, setNewName] = useState("");
	const createCircle = useCreateCircle();

	const handleCreate = () => {
		const name = newName.trim();
		if (!name) return;
		createCircle.mutate(
			{ body: { name } },
			{ onSuccess: () => setNewName("") },
		);
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1 justify-end"
			>
				<Pressable className="flex-1" onPress={onDismiss} />
				<View className="max-h-[75%] gap-3 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							Add to circle
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					{circles.length === 0 ? (
						<Text className="text-muted-foreground text-sm">
							No circles yet. Create one below to start grouping people you
							follow.
						</Text>
					) : (
						<ScrollView showsVerticalScrollIndicator={false}>
							<View className="gap-2">
								{circles.map((circle) => {
									const isMember = member.has(circle.id);
									return (
										<Pressable
											key={circle.id}
											onPress={() => onToggle(circle.id, isMember)}
											className="flex-row items-center gap-3 rounded-lg border border-border p-3"
										>
											<View
												className={cn(
													"size-6 items-center justify-center rounded-md border",
													isMember
														? "border-primary bg-primary"
														: "border-border",
												)}
											>
												{isMember ? (
													<Check color="#3f2e00" size={16} strokeWidth={3} />
												) : null}
											</View>
											<Text
												className="flex-1 font-medium text-foreground text-sm"
												numberOfLines={1}
											>
												{circle.name}
											</Text>
										</Pressable>
									);
								})}
							</View>
						</ScrollView>
					)}

					<View className="flex-row items-center gap-2">
						<View className="flex-1">
							<TextField
								variant="subtle"
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
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
