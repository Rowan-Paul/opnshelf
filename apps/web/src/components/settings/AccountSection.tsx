import {
	authControllerMeOptions,
	type UserDto,
	type UserProfileDto,
	usersControllerDeleteMyAvatarMutation,
	usersControllerRefreshMySocialLinksMutation,
	usersControllerUpdateMyProfileMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ExternalLink, Loader2, RefreshCw, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "#/components/following/UserAvatar";
import { Button } from "#/components/ui/button";
import { Switch } from "#/components/ui/switch";
import { apiConfig } from "#/lib/api";

async function uploadAvatar(file: File): Promise<UserProfileDto> {
	const formData = new FormData();
	formData.append("avatar", file);

	const response = await fetch(`${apiConfig.baseUrl}/users/me/profile/avatar`, {
		method: "POST",
		body: formData,
		credentials: "include",
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({
			message: "Failed to upload avatar",
		}));
		throw new Error(errorData.message || "Failed to upload avatar");
	}

	return response.json();
}

export function AccountSection({ user }: { user: UserDto }) {
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const invalidateMe = () =>
		queryClient.invalidateQueries({
			queryKey: authControllerMeOptions().queryKey,
		});

	const updateProfileMutation = useMutation({
		mutationKey: ["users", "me", "profile", "update"],
		...usersControllerUpdateMyProfileMutation(),
		onSuccess: () => {
			invalidateMe();
			toast.success("Display name updated");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile",
			);
		},
	});

	const uploadAvatarMutation = useMutation({
		mutationKey: ["users", "me", "profile", "avatar", "upload"],
		mutationFn: uploadAvatar,
		onSuccess: () => {
			invalidateMe();
			toast.success("Profile photo updated");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to upload profile photo",
			);
		},
	});

	const deleteAvatarMutation = useMutation({
		mutationKey: ["users", "me", "profile", "avatar", "delete"],
		...usersControllerDeleteMyAvatarMutation(),
		onSuccess: () => {
			invalidateMe();
			toast.success("Profile photo removed");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove profile photo",
			);
		},
	});

	const refreshSocialLinksMutation = useMutation({
		mutationKey: ["users", "me", "profile", "refresh-social-links"],
		...usersControllerRefreshMySocialLinksMutation(),
		onSuccess: () => {
			invalidateMe();
			toast.success("Social links refreshed");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to refresh social links",
			);
		},
	});

	const [displayName, setDisplayName] = useState(user.displayName ?? "");
	useEffect(() => {
		setDisplayName(user.displayName ?? "");
	}, [user.displayName]);

	const [showBluesky, setShowBluesky] = useState(
		user.showBlueskyOnProfile ?? true,
	);
	const [showTangled, setShowTangled] = useState(
		user.showTangledOnProfile ?? true,
	);
	useEffect(() => {
		setShowBluesky(user.showBlueskyOnProfile ?? true);
		setShowTangled(user.showTangledOnProfile ?? true);
	}, [user.showBlueskyOnProfile, user.showTangledOnProfile]);

	return (
		<section id="account" className="scroll-mt-24 p-5 sm:p-7">
			<h2 className="mb-1 font-semibold text-lg">Account</h2>
			<p className="mb-6 text-(--foreground-muted) text-sm">
				Update your profile information
			</p>

			<div className="space-y-6">
				{/* Avatar */}
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						aria-label="Upload profile photo"
						className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-(--border) border-2 bg-(--background-subtle) transition-colors hover:border-(--accent) focus-visible:outline-none focus-visible:ring-(--accent) focus-visible:ring-2"
					>
						<UserAvatar
							src={user.avatar}
							alt=""
							className="h-full w-full rounded-full"
						/>
						<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
							<Camera className="size-5 text-white" />
						</div>
						{uploadAvatarMutation.isPending && (
							<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
								<Loader2 className="size-5 animate-spin text-white" />
							</div>
						)}
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="sr-only"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) uploadAvatarMutation.mutate(file);
							e.target.value = "";
						}}
					/>
					<div>
						<p className="font-medium text-sm">Profile photo</p>
						<p className="text-(--foreground-muted) text-sm">
							Click the avatar to upload a new photo
						</p>
						{user.avatar && (
							<button
								type="button"
								onClick={() => deleteAvatarMutation.mutate({})}
								disabled={deleteAvatarMutation.isPending}
								className="mt-1 font-medium text-red-600 text-sm hover:text-red-700 disabled:opacity-50"
							>
								{deleteAvatarMutation.isPending ? "Removing…" : "Remove photo"}
							</button>
						)}
					</div>
				</div>

				{/* Display Name */}
				<div className="max-w-xl space-y-2">
					<label htmlFor="display-name" className="font-medium text-sm">
						Display name
					</label>
					<div className="flex gap-2">
						<input
							id="display-name"
							type="text"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="Your display name"
							className="input flex-1"
						/>
						<Button
							onClick={() =>
								updateProfileMutation.mutate({
									body: { displayName: displayName || undefined },
								})
							}
							disabled={
								updateProfileMutation.isPending ||
								displayName === (user.displayName ?? "")
							}
						>
							{updateProfileMutation.isPending ? (
								<Loader2 data-icon="inline-start" className="animate-spin" />
							) : (
								<Save data-icon="inline-start" />
							)}
							Save
						</Button>
					</div>
				</div>

				{/* Handle */}
				<div className="max-w-xl space-y-2">
					<label htmlFor="handle" className="font-medium text-sm">
						Handle
					</label>
					<input
						id="handle"
						type="text"
						value={`@${user.handle}`}
						disabled
						className="input cursor-not-allowed bg-(--background-subtle)"
						readOnly
					/>
					<p className="text-(--foreground-muted) text-xs">
						Your handle comes from the account you signed in with.
					</p>
				</div>

				{/* Social Links */}
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="font-medium text-sm">Social links</h3>
						<button
							type="button"
							onClick={() => refreshSocialLinksMutation.mutate({})}
							disabled={refreshSocialLinksMutation.isPending}
							className="inline-flex items-center gap-1.5 text-(--accent) text-sm hover:underline disabled:opacity-50"
						>
							{refreshSocialLinksMutation.isPending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<RefreshCw className="size-3.5" />
							)}
							Refresh
						</button>
					</div>
					<p className="text-(--foreground-muted) text-xs">
						We automatically detect your Bluesky and Tangled profiles. Toggle to
						control visibility.
					</p>

					{/* Bluesky */}
					<div className="flex items-center justify-between rounded-lg border border-(--border) p-3">
						<div className="flex items-center gap-3">
							<img src="/bluesky.svg" alt="Bluesky" className="size-5" />
							<div>
								<p className="font-medium text-sm">Bluesky</p>
								{user.blueskyProfileUrl ? (
									<a
										href={user.blueskyProfileUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-(--accent) text-xs hover:underline"
									>
										View profile
										<ExternalLink className="size-3" />
									</a>
								) : (
									<p className="text-(--foreground-muted) text-xs">Not found</p>
								)}
							</div>
						</div>
						<Switch
							checked={showBluesky}
							onCheckedChange={(checked) => {
								setShowBluesky(checked);
								updateProfileMutation.mutate({
									body: { showBlueskyOnProfile: checked },
								});
							}}
							disabled={
								updateProfileMutation.isPending || !user.blueskyProfileUrl
							}
						/>
					</div>

					{/* Tangled */}
					<div className="flex items-center justify-between rounded-lg border border-(--border) p-3">
						<div className="flex items-center gap-3">
							<div className="relative size-5">
								<img
									src="/tangled-black.svg"
									alt="Tangled"
									className="absolute inset-0 block h-full w-full object-contain dark:hidden"
								/>
								<img
									src="/tangled-white.svg"
									alt="Tangled"
									className="absolute inset-0 hidden h-full w-full object-contain dark:block"
								/>
							</div>
							<div>
								<p className="font-medium text-sm">Tangled</p>
								{user.tangledProfileUrl ? (
									<a
										href={user.tangledProfileUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-(--accent) text-xs hover:underline"
									>
										View profile
										<ExternalLink className="size-3" />
									</a>
								) : (
									<p className="text-(--foreground-muted) text-xs">Not found</p>
								)}
							</div>
						</div>
						<Switch
							checked={showTangled}
							onCheckedChange={(checked) => {
								setShowTangled(checked);
								updateProfileMutation.mutate({
									body: { showTangledOnProfile: checked },
								});
							}}
							disabled={
								updateProfileMutation.isPending || !user.tangledProfileUrl
							}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
