import {
	socialControllerGetRelationshipOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpen, List, Star, Tv, Users } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SocialFollowButton } from "@/components/social/SocialFollowButton";
import { SocialUserAvatar } from "@/components/social/SocialUserAvatar";
import { Card, CardContent } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { getDisplayName } from "@/components/social/social-display";

type Section =
	| "shelf"
	| "up-next"
	| "lists"
	| "friends"
	| "followers"
	| "following";

const ownerSectionItems: Array<{
	section: Section;
	label: string;
	icon: typeof BookOpen;
}> = [
	{ section: "shelf", label: "Shelf", icon: BookOpen },
	{ section: "up-next", label: "Up Next", icon: Tv },
	{ section: "lists", label: "Lists", icon: List },
	{ section: "friends", label: "Friends", icon: Users },
];

const publicSectionItems: Array<{
	section: Section;
	label: string;
	icon: typeof BookOpen;
}> = [
	{ section: "shelf", label: "Shelf", icon: BookOpen },
	{ section: "up-next", label: "Up Next", icon: Tv },
	{ section: "lists", label: "Lists", icon: List },
	{ section: "followers", label: "Followers", icon: Users },
	{ section: "following", label: "Following", icon: Star },
];

export function PublicProfileScaffold({
	beforeTabs,
	section,
	children,
}: {
	beforeTabs?: React.ReactNode;
	section: Section;
	children: React.ReactNode;
}) {
	const { handle } = useLocalSearchParams<{ handle: string }>();
	const normalizedHandle = (handle ?? "").trim().replace(/^@/, "").toLowerCase();
	const { user } = useAuth();
	const { colors } = useTheme();
	const profileQuery = useQuery({
		...usersControllerGetPublicProfileOptions({
			path: { handle: normalizedHandle },
		}),
		enabled: !!normalizedHandle,
		retry: false,
	});
	const isOwner = Boolean(user?.did && profileQuery.data?.did === user.did);
	const relationshipQuery = useQuery({
		...socialControllerGetRelationshipOptions({
			path: { targetDid: profileQuery.data?.did ?? "" },
		}),
		enabled: Boolean(user?.did && profileQuery.data?.did && !isOwner),
		retry: false,
	});

	if (profileQuery.isLoading || !profileQuery.data) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<View style={styles.loadingWrap}>
					<Text style={{ color: colors.onBackground }}>Loading profile...</Text>
				</View>
			</SafeAreaView>
		);
	}

	const profile = profileQuery.data;
	const displayName = getDisplayName(profile.displayName, profile.handle);
	const sectionItems = isOwner ? ownerSectionItems : publicSectionItems;

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top", "left", "right", "bottom"]}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<Card
					style={{
						...styles.headerCard,
						backgroundColor: colors.surfaceContainerHigh,
						borderColor: colors.outlineVariant,
					}}
				>
					<CardContent style={styles.headerContent}>
						<SocialUserAvatar
							avatar={profile.avatar}
							displayName={profile.displayName}
							handle={profile.handle}
							size={72}
						/>
						<View style={styles.headerCopy}>
							<Text style={[styles.name, { color: colors.onSurface }]}>
								{displayName}
							</Text>
							<Text style={[styles.handle, { color: colors.onSurfaceVariant }]}>
								@{profile.handle}
							</Text>
							<View style={styles.countsRow}>
								<CountPill
									label="Following"
									value={profile.followingCount}
									interactive={!!user}
									onPress={() =>
										router.push(
											isOwner
												? {
														pathname: "/user/[handle]/friends",
														params: {
															handle: profile.handle,
															tab: "following",
														},
													}
												: {
														pathname: "/user/[handle]/following",
														params: { handle: profile.handle },
													},
										)
									}
								/>
								<CountPill
									label="Followers"
									value={profile.followersCount}
									interactive={!!user}
									onPress={() =>
										router.push(
											isOwner
												? {
														pathname: "/user/[handle]/friends",
														params: {
															handle: profile.handle,
															tab: "followers",
														},
													}
												: {
														pathname: "/user/[handle]/followers",
														params: { handle: profile.handle },
													},
										)
									}
								/>
							</View>
						</View>
						{user && !isOwner ? (
							<SocialFollowButton
								targetDid={profile.did}
								targetHandle={profile.handle}
								viewerHandle={user.handle}
								isFollowing={relationshipQuery.data?.isFollowing ?? false}
								isFollowedBy={relationshipQuery.data?.isFollowedBy ?? false}
								disabled={relationshipQuery.isLoading}
							/>
						) : null}
					</CardContent>
				</Card>

				{beforeTabs}

				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.tabs}
				>
					{sectionItems.map((item) => {
						const Icon = item.icon;
						const active = item.section === section;
						return (
							<TouchableOpacity
								key={item.section}
								style={[
									styles.tab,
									{
										backgroundColor: active
											? colors.primaryContainer
											: colors.surfaceContainer,
										borderColor: active
											? colors.primaryContainer
											: colors.outlineVariant,
									},
								]}
								onPress={() =>
									router.replace({
										pathname: `/user/[handle]/${item.section}`,
										params:
											item.section === "friends"
												? { handle: profile.handle, tab: "following" }
												: { handle: profile.handle },
									})
								}
							>
								<Icon
									size={16}
									color={active ? colors.onPrimaryContainer : colors.onSurfaceVariant}
								/>
								<Text
									style={{
										color: active
											? colors.onPrimaryContainer
											: colors.onSurfaceVariant,
										fontWeight: "600",
									}}
								>
									{item.label}
								</Text>
							</TouchableOpacity>
						);
					})}
				</ScrollView>

				{children}
			</ScrollView>
		</SafeAreaView>
	);
}

function CountPill({
	label,
	value,
	interactive,
	onPress,
}: {
	label: string;
	value: number;
	interactive: boolean;
	onPress: () => void;
}) {
	const { colors } = useTheme();

	if (!interactive) {
		return (
			<View
				style={[
					styles.countPill,
					{ backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
				]}
			>
				<Text style={[styles.countValue, { color: colors.onSurface }]}>{value}</Text>
				<Text style={[styles.countLabel, { color: colors.onSurfaceVariant }]}>
					{label}
				</Text>
			</View>
		);
	}

	return (
		<TouchableOpacity
			style={[
				styles.countPill,
				{ backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
			]}
			onPress={onPress}
		>
			<Text style={[styles.countValue, { color: colors.onSurface }]}>{value}</Text>
			<Text style={[styles.countLabel, { color: colors.onSurfaceVariant }]}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		padding: spacing.lg,
		gap: spacing.lg,
	},
	loadingWrap: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	headerCard: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
	},
	headerContent: {
		gap: spacing.lg,
	},
	headerCopy: {
		gap: spacing.xs,
	},
	name: {
		fontSize: 28,
		fontWeight: "700",
	},
	handle: {
		fontSize: 16,
	},
	countsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	countPill: {
		borderWidth: 1,
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	countValue: {
		fontSize: 16,
		fontWeight: "700",
	},
	countLabel: {
		fontSize: 12,
	},
	tabs: {
		gap: spacing.sm,
	},
	tab: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		borderWidth: 1,
	},
});
