import type { SocialUserCardDto } from "@opnshelf/api";
import { StyleSheet, Text, View } from "react-native";
import { Users } from "lucide-react-native";
import { SocialUserRow } from "@/components/social/SocialUserRow";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

export function SocialConnectionsSection({
	emptyDescription,
	emptyTitle,
	hasNextPage = false,
	isFetchingNextPage = false,
	isLoading,
	items,
	onLoadMore,
	viewerHandle,
}: {
	emptyDescription: string;
	emptyTitle: string;
	hasNextPage?: boolean;
	isFetchingNextPage?: boolean;
	isLoading: boolean;
	items: SocialUserCardDto[];
	onLoadMore?: () => void;
	viewerHandle?: string | null;
}) {
	const { colors } = useTheme();

	if (isLoading) {
		return (
			<View style={styles.centerContent}>
				<Text style={{ color: colors.onSurfaceVariant }}>Loading…</Text>
			</View>
		);
	}

	if (items.length === 0) {
		return (
			<Card
				style={{
					...styles.stateCard,
					backgroundColor: colors.surfaceContainerHigh,
					borderColor: colors.outlineVariant,
				}}
			>
				<CardHeader>
					<Users size={28} color={colors.primary} style={styles.stateIcon} />
					<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
						{emptyTitle}
					</Text>
					<Text
						style={[
							styles.stateDescription,
							{ color: colors.onSurfaceVariant },
						]}
					>
						{emptyDescription}
					</Text>
				</CardHeader>
			</Card>
		);
	}

	return (
		<View style={styles.section}>
			{items.map((item) => (
				<SocialUserRow
					key={item.did}
					user={item}
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
	);
}

const styles = StyleSheet.create({
	section: {
		gap: spacing.md,
	},
	centerContent: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: spacing.xl,
	},
	stateCard: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
	},
	stateIcon: {
		marginBottom: spacing.sm,
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
