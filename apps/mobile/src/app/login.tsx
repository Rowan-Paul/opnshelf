import { authControllerSuggestionsOptions } from "@opnshelf/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { User, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { AppleMark } from "@/components/marks/AppleMark";
import { GoogleMark } from "@/components/marks/GoogleMark";
import {
	ProviderButtons,
	useProviderSignIn,
} from "@/components/ProviderButtons";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import {
	forgetAccount,
	type RecentAccount,
	useRecentAccounts,
} from "@/lib/recent-accounts";
import { useTheme } from "@/lib/theme-context";
import { useDebounce } from "@/lib/use-debounce";
import { useTwStyle } from "@/lib/use-tw-style";
import { useThemeColors } from "@/theme/colors";

type LoginParams = {
	reason?: "session_expired";
};

export default function LoginScreen() {
	const colors = useThemeColors();
	const { scheme } = useTheme();
	const { user, isLoading, isAuthenticated, login } = useAuth();
	const { reason } = useLocalSearchParams<LoginParams>();
	const [handle, setHandle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	// A provider flow and a handle sign-in both end in completeSession, so
	// running them at once races session state and navigation.
	const [providerBusy, setProviderBusy] = useState(false);
	const recentAccounts = useRecentAccounts();
	const recentProvider = useProviderSignIn();
	// The remembered account being signed in to, so only its row shows progress.
	const [continuingDid, setContinuingDid] = useState<string | null>(null);
	const authBusy = isSubmitting || providerBusy || recentProvider.busy !== null;
	const [error, setError] = useState<string | null>(null);
	const avatarStyle = useTwStyle("size-9");

	const debouncedHandle = useDebounce(handle, 300).trim();
	const suggestionsQuery = useQuery({
		...authControllerSuggestionsOptions({ query: { q: debouncedHandle } }),
		enabled: debouncedHandle.length >= 2,
		// Keep the previous query's rows on screen while the next one loads, so
		// typing dims the list instead of replacing it with a spinner.
		placeholderData: keepPreviousData,
	});
	const suggestions = suggestionsQuery.data ?? [];
	const showSuggestions = debouncedHandle.length >= 2 && !isSubmitting;
	// Only the very first search has nothing to show, so that is the only time a
	// spinner beats stale rows.
	const isSearchingEmpty =
		suggestionsQuery.isFetching && suggestions.length === 0;

	// Already signed in: let the index gate decide onboarding vs tabs.
	if (!isLoading && isAuthenticated && user) {
		return <Redirect href="/" />;
	}

	const submit = async (action: () => Promise<unknown>) => {
		if (isSubmitting) {
			return;
		}
		setIsSubmitting(true);
		setError(null);
		try {
			await action();
		} catch (err) {
			console.error("Auth error:", err);
			setError("Sign in failed. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const continueAs = async (account: RecentAccount) => {
		setContinuingDid(account.did);
		try {
			if (account.method === "handle") {
				await submit(() => login(account.handle));
			} else {
				await recentProvider.signIn(account.method);
			}
		} finally {
			setContinuingDid(null);
		}
	};

	return (
		<Screen>
			<View className="flex-1 justify-center gap-6">
				<View className="items-center gap-4">
					<Image
						source={require("../../assets/images/icon.png")}
						style={{ width: 64, height: 64, borderRadius: 16 }}
					/>
					<View className="items-center gap-1.5">
						<Text className="text-center font-display-bold text-3xl text-foreground">
							Welcome to Opnshelf
						</Text>
						<Text className="text-center text-base text-muted-foreground">
							Track what you watch.
						</Text>
					</View>
				</View>

				{reason === "session_expired" && (
					<View className="rounded-lg border border-border bg-muted p-4">
						<Text className="font-semibold text-foreground">
							You were signed out
						</Text>
						<Text className="mt-1 text-muted-foreground text-sm">
							Your session expired. Please sign in again to continue.
						</Text>
					</View>
				)}

				{error && (
					<View className="rounded-lg border border-destructive bg-muted p-4">
						<Text className="text-destructive text-sm">{error}</Text>
					</View>
				)}

				{recentAccounts.length > 0 ? (
					<View className="gap-1.5">
						<Text className="font-medium text-foreground text-sm">
							Continue as
						</Text>
						<View className="overflow-hidden rounded-lg border border-border bg-card">
							{recentAccounts.map((account, index) => (
								<View
									key={account.did}
									className={`flex-row items-center ${index > 0 ? "border-border border-t" : ""} ${authBusy && continuingDid !== account.did ? "opacity-60" : ""}`}
								>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={`Continue as ${account.displayName || account.handle}, @${account.handle}${account.method === "handle" ? "" : `, with ${account.method === "google" ? "Google" : "Apple"}`}`}
										accessibilityState={{
											disabled: authBusy,
											busy: continuingDid === account.did,
										}}
										disabled={authBusy}
										onPress={() => void continueAs(account)}
										className="min-w-0 flex-1 flex-row items-center gap-3 py-3 pl-3"
									>
										<View className="size-9 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
											{account.avatar ? (
												<Image
													source={{ uri: account.avatar }}
													style={avatarStyle}
													contentFit="cover"
												/>
											) : (
												<User color={colors.mutedForeground} size={16} />
											)}
										</View>
										<View className="min-w-0 flex-1">
											<Text
												className="font-medium text-foreground text-sm"
												numberOfLines={1}
											>
												{account.displayName || account.handle}
											</Text>
											<Text
												className="text-muted-foreground text-xs"
												numberOfLines={1}
											>
												@{account.handle}
											</Text>
										</View>
										{continuingDid === account.did ? (
											<ActivityIndicator size="small" />
										) : account.method === "google" ? (
											<GoogleMark size={16} />
										) : account.method === "apple" ? (
											<AppleMark
												size={16}
												color={scheme === "dark" ? "#FFFFFF" : "#000000"}
											/>
										) : null}
									</Pressable>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={`Remove @${account.handle} from this device`}
										disabled={authBusy}
										onPress={() => void forgetAccount(account.did)}
										hitSlop={4}
										className="justify-center self-stretch px-3"
									>
										<X color={colors.mutedForeground} size={16} />
									</Pressable>
								</View>
							))}
						</View>
					</View>
				) : null}

				<ProviderButtons disabled={authBusy} onBusyChange={setProviderBusy} />

				<View className="flex-row items-center gap-3">
					<View className="h-px flex-1 bg-border" />
					<Text className="text-muted-foreground text-xs uppercase">or</Text>
					<View className="h-px flex-1 bg-border" />
				</View>

				<View className="gap-3">
					<TextField
						label="Handle"
						helperText="Already have a Bluesky or AT Protocol handle? That works here too."
						value={handle}
						onChangeText={setHandle}
						placeholder="bob.opnshelf.social"
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="go"
						editable={!authBusy}
						onSubmitEditing={() => submit(() => login(handle))}
					/>

					{showSuggestions && (isSearchingEmpty || suggestions.length > 0) ? (
						<View className="overflow-hidden rounded-lg border border-border bg-card">
							{isSearchingEmpty ? (
								<View className="flex-row items-center justify-center gap-2 p-4">
									<ActivityIndicator size="small" />
									<Text className="text-muted-foreground text-sm">
										Searching...
									</Text>
								</View>
							) : (
								<ScrollView
									style={{ maxHeight: 232 }}
									keyboardShouldPersistTaps="handled"
								>
									{suggestions.map((actor, index) => (
										<Pressable
											key={actor.did}
											disabled={authBusy}
											onPress={() => {
												setHandle(actor.handle);
												submit(() => login(actor.handle));
											}}
											className={`flex-row items-center gap-3 p-3 ${index > 0 ? "border-border border-t" : ""} ${suggestionsQuery.isFetching ? "opacity-60" : ""}`}
										>
											<View className="size-9 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
												{actor.avatar ? (
													<Image
														source={{ uri: actor.avatar }}
														style={avatarStyle}
														contentFit="cover"
													/>
												) : (
													<User color={colors.mutedForeground} size={16} />
												)}
											</View>
											<View className="min-w-0 flex-1">
												<Text
													className="font-medium text-foreground text-sm"
													numberOfLines={1}
												>
													{actor.displayName || actor.handle}
												</Text>
												<Text
													className="text-muted-foreground text-xs"
													numberOfLines={1}
												>
													@{actor.handle}
												</Text>
											</View>
										</Pressable>
									))}
								</ScrollView>
							)}
						</View>
					) : null}

					<Button
						label="Sign In"
						loadingLabel="Connecting..."
						loading={isSubmitting}
						disabled={authBusy}
						onPress={() => submit(() => login(handle))}
					/>

					<Button
						label="Create New Account"
						variant="secondary"
						disabled={authBusy}
						onPress={() => router.push("/signup")}
					/>

					<Pressable
						disabled={authBusy}
						onPress={() =>
							router.canGoBack() ? router.back() : router.replace("/search")
						}
						className="items-center py-2"
					>
						<Text className="text-muted-foreground text-sm">
							Browse without an account
						</Text>
					</Pressable>
				</View>
			</View>
		</Screen>
	);
}
