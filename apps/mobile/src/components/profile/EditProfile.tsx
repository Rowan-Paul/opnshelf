import type { UserDto } from "@opnshelf/api";
import { ExternalLink, RefreshCw } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	Pressable,
	Switch,
	View,
} from "react-native";
import { AvatarEditor } from "@/components/profile/AvatarEditor";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useProfileSetup } from "@/lib/use-profile";

/** Amber primary used for active switches and accents, matching settings. */
const PRIMARY = "#f3bc00";

/**
 * Post-onboarding profile editor: avatar (upload/remove), display name, and
 * Bluesky/Tangled social-link visibility. Uses the exact same backend mutations
 * the web settings page uses, via the shared `useProfileSetup` hook.
 */
export function EditProfile({ user }: { user: UserDto }) {
	const {
		updateProfile,
		uploadAvatar,
		deleteAvatar,
		refreshSocialLinks,
		pickAndUploadAvatar,
	} = useProfileSetup();

	// Display name — locally editable, saved explicitly via the Save button.
	const [displayName, setDisplayName] = useState(user.displayName ?? "");
	useEffect(() => {
		setDisplayName(user.displayName ?? "");
	}, [user.displayName]);

	// Social-link visibility — optimistic local state, persisted on toggle.
	const [showBluesky, setShowBluesky] = useState(user.showBlueskyOnProfile);
	const [showTangled, setShowTangled] = useState(user.showTangledOnProfile);
	useEffect(() => {
		setShowBluesky(user.showBlueskyOnProfile);
		setShowTangled(user.showTangledOnProfile);
	}, [user.showBlueskyOnProfile, user.showTangledOnProfile]);

	const displayNameDirty = displayName !== (user.displayName ?? "");
	const saveDisabled = updateProfile.isPending || !displayNameDirty;

	return (
		<View className="gap-6">
			{/* Avatar */}
			<AvatarEditor
				avatarUrl={user.avatar}
				uploading={uploadAvatar.isPending}
				removing={deleteAvatar.isPending}
				onPick={pickAndUploadAvatar}
				onRemove={() => deleteAvatar.mutate({})}
			/>

			{/* Display name */}
			<View className="gap-2">
				<TextField
					label="Display name"
					value={displayName}
					onChangeText={setDisplayName}
					placeholder="Your display name"
					autoCapitalize="words"
				/>
				<Pressable
					onPress={() =>
						updateProfile.mutate({
							body: { displayName: displayName || undefined },
						})
					}
					disabled={saveDisabled}
					className="flex-row items-center justify-center gap-2 self-start rounded-lg bg-primary px-4 py-2.5"
					style={{ opacity: saveDisabled ? 0.6 : 1 }}
				>
					{updateProfile.isPending ? (
						<ActivityIndicator size="small" color="#3f2e00" />
					) : null}
					<Text className="font-semibold text-primary-foreground text-sm">
						Save
					</Text>
				</Pressable>
			</View>

			{/* Handle (read-only) */}
			<View className="gap-1.5">
				<Text className="font-medium text-foreground text-sm">Handle</Text>
				<View className="rounded-lg border border-border bg-background-subtle px-4 py-3">
					<Text className="text-[16px] text-muted-foreground">
						@{user.handle}
					</Text>
				</View>
				<Text className="text-muted-foreground text-xs">
					Your handle comes from the account you signed in with.
				</Text>
			</View>

			{/* Social links */}
			<View className="gap-4">
				<View className="flex-row items-center justify-between">
					<Text className="font-medium text-foreground text-sm">
						Social links
					</Text>
					<Pressable
						onPress={() => refreshSocialLinks.mutate({})}
						disabled={refreshSocialLinks.isPending}
						className="flex-row items-center gap-1.5"
						style={{ opacity: refreshSocialLinks.isPending ? 0.6 : 1 }}
						hitSlop={8}
					>
						{refreshSocialLinks.isPending ? (
							<ActivityIndicator size="small" color={PRIMARY} />
						) : (
							<RefreshCw color={PRIMARY} size={14} />
						)}
						<Text className="text-primary text-sm">Refresh</Text>
					</Pressable>
				</View>
				<Text className="text-muted-foreground text-xs leading-5">
					We automatically detect your Bluesky and Tangled profiles. Toggle to
					control visibility.
				</Text>

				<SocialLinkRow
					name="Bluesky"
					profileUrl={user.blueskyProfileUrl}
					value={showBluesky}
					disabled={updateProfile.isPending || !user.blueskyProfileUrl}
					onValueChange={(checked) => {
						setShowBluesky(checked);
						updateProfile.mutate({ body: { showBlueskyOnProfile: checked } });
					}}
				/>

				<SocialLinkRow
					name="Tangled"
					profileUrl={user.tangledProfileUrl}
					value={showTangled}
					disabled={updateProfile.isPending || !user.tangledProfileUrl}
					onValueChange={(checked) => {
						setShowTangled(checked);
						updateProfile.mutate({ body: { showTangledOnProfile: checked } });
					}}
				/>
			</View>
		</View>
	);
}

/** A single social-link entry: name, view-profile link (or "Not found"), toggle. */
function SocialLinkRow({
	name,
	profileUrl,
	value,
	disabled,
	onValueChange,
}: {
	name: string;
	profileUrl: string | null;
	value: boolean;
	disabled: boolean;
	onValueChange: (checked: boolean) => void;
}) {
	return (
		<View className="flex-row items-center justify-between rounded-lg border border-border p-3">
			<View className="flex-1 gap-0.5">
				<Text className="font-medium text-foreground text-sm">{name}</Text>
				{profileUrl ? (
					<Pressable
						onPress={() => {
							Linking.openURL(profileUrl).catch(() => {});
						}}
						className="flex-row items-center gap-1"
						hitSlop={6}
					>
						<Text className="text-primary text-xs">View profile</Text>
						<ExternalLink color={PRIMARY} size={12} />
					</Pressable>
				) : (
					<Text className="text-muted-foreground text-xs">Not found</Text>
				)}
			</View>
			<Switch
				value={value}
				onValueChange={onValueChange}
				disabled={disabled}
				trackColor={{ false: "#3f3f46", true: PRIMARY }}
				thumbColor="#ffffff"
			/>
		</View>
	);
}
