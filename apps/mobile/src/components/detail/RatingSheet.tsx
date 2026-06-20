import { StarOff, X } from "lucide-react-native";
import { Modal, Pressable, View } from "react-native";
import { StarRating } from "@/components/detail/StarRating";
import { Text } from "@/components/ui/text";

/**
 * Bottom sheet for setting the single star rating of a media item. Keeps the
 * rating off the main detail surface (it's opened from `RatingButton`) so it
 * isn't competing for attention with tracking actions.
 */
export function RatingSheet({
	visible,
	onDismiss,
	rating,
	onChange,
	onClear,
	isClearing,
}: {
	visible: boolean;
	onDismiss: () => void;
	/** 1-10 scale (0 = unrated). */
	rating: number;
	onChange: (rating: number) => void;
	onClear: () => void;
	isClearing?: boolean;
}) {
	const rated = rating > 0;

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			<View className="flex-1 justify-end">
				<Pressable className="flex-1" onPress={onDismiss} />
				<View className="gap-5 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							Your rating
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<View className="items-center gap-3 py-2">
						<StarRating rating={rating} onChange={onChange} size={40} />
						{rated ? (
							<View className="flex-row items-baseline gap-0.5">
								<Text className="font-bold font-display text-2xl text-foreground">
									{(rating / 2).toFixed(1)}
								</Text>
								<Text className="text-muted-foreground text-sm"> / 5</Text>
							</View>
						) : (
							<Text className="text-muted-foreground text-sm">
								Tap a star to rate
							</Text>
						)}
					</View>

					{rated ? (
						<Pressable
							onPress={() => {
								onClear();
								onDismiss();
							}}
							disabled={isClearing}
							className="flex-row items-center justify-center gap-1.5 rounded-lg border border-border py-3"
							style={{ opacity: isClearing ? 0.6 : 1 }}
						>
							<StarOff color="#94a3b8" size={16} />
							<Text className="font-medium text-muted-foreground">
								Clear rating
							</Text>
						</Pressable>
					) : null}
				</View>
			</View>
		</Modal>
	);
}
