import {
	atStoreReviewsControllerGetPromptOptions,
	atStoreReviewsControllerPublishMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import { Star } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { posthog } from "@/lib/posthog";

const PLATFORM = { platform: "mobile" } as const;

export default function AtStoreReviewScreen() {
	const queryClient = useQueryClient();
	const navigation = useNavigation();
	const toast = useToast();
	const { showDialog } = useDialog();
	const [rating, setRating] = useState<number | null>(null);
	const [text, setText] = useState("");
	const dirty = rating !== null || text.length > 0;
	const allowClose = useRef(false);

	useEffect(() => {
		posthog?.capture("atstore_review_composer_opened", PLATFORM);
	}, []);

	useEffect(
		() =>
			navigation.addListener("beforeRemove", (event) => {
				if (!dirty || allowClose.current) return;
				event.preventDefault();
				showDialog({
					title: "Discard this review?",
					description: "Your rating and review text will not be saved.",
					actions: [
						{ label: "Keep editing" },
						{
							label: "Discard",
							variant: "destructive",
							onPress: () => {
								allowClose.current = true;
								navigation.dispatch(event.data.action);
							},
						},
					],
				});
			}),
		[dirty, navigation, showDialog],
	);

	const publishMutation = useMutation({
		mutationKey: ["atstore-review", "publish"],
		...atStoreReviewsControllerPublishMutation(),
		onSuccess: () => {
			queryClient.setQueryData(
				atStoreReviewsControllerGetPromptOptions().queryKey,
				{ eligible: false, permissionGranted: true },
			);
			posthog?.capture("atstore_review_published", PLATFORM);
			if (process.env.EXPO_OS === "ios") {
				void Haptics.notificationAsync(
					Haptics.NotificationFeedbackType.Success,
				);
			}
			toast.success("Review published");
			allowClose.current = true;
			router.back();
		},
		onError: () => toast.error("Could not publish your review. Try again."),
	});

	const close = () => {
		if (!dirty) {
			router.back();
			return;
		}
		showDialog({
			title: "Discard this review?",
			description: "Your rating and review text will not be saved.",
			actions: [
				{ label: "Keep editing" },
				{
					label: "Discard",
					variant: "destructive",
					onPress: () => {
						allowClose.current = true;
						router.back();
					},
				},
			],
		});
	};

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
			contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 24 }}
		>
			<View className="gap-2">
				<Text className="font-bold font-display text-2xl text-foreground">
					Review OpnShelf
				</Text>
				<Text className="text-muted-foreground text-sm leading-5">
					Your review will appear on OpnShelf’s page at atstore.fyi.
				</Text>
			</View>

			<View className="gap-3">
				<Text className="font-medium text-foreground text-sm">Your rating</Text>
				<View className="flex-row gap-2" accessibilityRole="radiogroup">
					{[1, 2, 3, 4, 5].map((value) => {
						const selected = rating !== null && value <= rating;
						return (
							<Pressable
								key={value}
								accessibilityRole="radio"
								accessibilityState={{ checked: rating === value }}
								accessibilityLabel={`${value} ${value === 1 ? "star" : "stars"}`}
								hitSlop={4}
								onPress={() => {
									setRating(value);
									if (process.env.EXPO_OS === "ios") {
										void Haptics.selectionAsync();
									}
								}}
								className="rounded-lg p-1"
							>
								<Star
									color={selected ? "#f3bc00" : "#94a3b8"}
									fill={selected ? "#f3bc00" : "transparent"}
									size={34}
								/>
							</Pressable>
						);
					})}
				</View>
			</View>

			<TextField
				label="Review (optional)"
				value={text}
				onChangeText={setText}
				maxLength={8000}
				multiline
				numberOfLines={7}
				className="min-h-36"
				placeholder="What has your experience been like?"
				helperText={`${text.length.toLocaleString()} / 8,000`}
			/>

			<View className="flex-row gap-3">
				<Pressable
					accessibilityRole="button"
					onPress={close}
					className="flex-1 items-center rounded-lg border border-border px-4 py-3"
				>
					<Text className="font-semibold text-foreground">Cancel</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					disabled={rating === null || publishMutation.isPending}
					onPress={() =>
						rating !== null &&
						publishMutation.mutate({
							body: { rating, text: text || undefined },
						})
					}
					className="flex-1 items-center rounded-lg bg-primary px-4 py-3"
					style={{
						opacity: rating === null || publishMutation.isPending ? 0.45 : 1,
					}}
				>
					<Text className="font-semibold text-[#3f2e00]">
						{publishMutation.isPending ? "Publishing…" : "Publish review"}
					</Text>
				</Pressable>
			</View>
		</ScrollView>
	);
}
