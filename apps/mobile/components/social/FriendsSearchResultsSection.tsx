import type { SocialUserCardDto } from "@opnshelf/api";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SocialUserRow } from "@/components/social/SocialUserRow";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

export function FriendsSearchResultsSection({
	hasResolved,
	hasNextPage = false,
	isFetching,
	isFetchingNextPage = false,
	onLoadMore,
	query,
	results,
	viewerHandle,
}: {
	hasResolved: boolean;
	hasNextPage?: boolean;
	isFetching: boolean;
	isFetchingNextPage?: boolean;
	onLoadMore?: () => void;
	query: string;
	results: SocialUserCardDto[];
	viewerHandle?: string | null;
}) {
	const { colors } = useTheme();
	const opacity = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		const nextOpacity = isFetching && results.length > 0 ? 0.58 : 1;
		Animated.timing(opacity, {
			toValue: nextOpacity,
			duration: 180,
			useNativeDriver: true,
		}).start();
	}, [isFetching, opacity, results.length]);

	if (!hasResolved) {
		return null;
	}

	if (results.length === 0) {
		return (
			<Card
				style={{
					...styles.stateCard,
					backgroundColor: colors.surfaceContainerHigh,
					borderColor: colors.outlineVariant,
				}}
			>
				<CardHeader>
					<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
						No results
					</Text>
					<Text
						style={[
							styles.stateDescription,
							{ color: colors.onSurfaceVariant },
						]}
					>
						No OpnShelf users matched "{query}".
					</Text>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Animated.View style={{ opacity }}>
			<View style={styles.results}>
				{results.map((result) => (
					<SocialUserRow
						key={result.did}
						user={result}
						viewerHandle={viewerHandle}
					/>
				))}
				{hasNextPage && onLoadMore ? (
					<Button
						variant="outlined"
						onPress={onLoadMore}
						disabled={isFetchingNextPage}
					>
						<Text>Load more</Text>
					</Button>
				) : null}
			</View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	results: {
		gap: spacing.md,
	},
	stateCard: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
	},
	stateTitle: {
		fontSize: 22,
		fontWeight: "700",
	},
	stateDescription: {
		fontSize: 15,
		lineHeight: 22,
	},
});
