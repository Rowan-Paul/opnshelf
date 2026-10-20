import { Redirect, router } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useCallback, useState } from "react";
import {
	ActivityIndicator,
	type ImageURISource,
	useColorScheme,
	View,
} from "react-native";
import { ShakeToFeedback } from "@/components/feedback/ShakeToFeedback";
import { NativeTabAvatar } from "@/components/navigation/native-tab-avatar";
import { tabIcons } from "@/components/navigation/tab-icons";
import { TraktSyncBanner } from "@/components/trakt/TraktSyncBanner";
import { useAuth } from "@/lib/auth-context";
import { darkNavTheme, lightNavTheme } from "@/theme";

export default function TabLayout() {
	const dark = useColorScheme() === "dark";
	const theme = dark ? darkNavTheme : lightNavTheme;
	// The brand yellow needs a darker shade for tab-label contrast on white.
	const tintColor = dark ? theme.colors.primary : "#806000";
	const { user, isLoading, isAuthenticated } = useAuth();
	const uri = user?.avatar ?? null;
	const [avatar, setAvatar] = useState<{
		uri: string | null;
		default: ImageURISource;
		selected: ImageURISource;
	}>();
	const onAvatarReady = useCallback(
		(images: { default: ImageURISource; selected: ImageURISource }) =>
			setAvatar({ uri, ...images }),
		[uri],
	);
	if (isLoading)
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" color={tintColor} />
			</View>
		);
	if (user?.needsEmailVerification) return <Redirect href="/verify-email" />;
	if (user?.needsOnboarding) return <Redirect href="/onboarding" />;
	const guest = !isAuthenticated || !user;
	return (
		<TraktSyncBanner>
			<ShakeToFeedback />
			{!guest && (
				<NativeTabAvatar
					key={`${uri ?? "fallback"}:${String(tintColor)}`}
					uri={uri}
					color={tintColor}
					onReady={onAvatarReady}
				/>
			)}
			<NativeTabs
				key={guest ? "guest" : "authenticated"}
				labelVisibilityMode="labeled"
				tintColor={tintColor}
				backgroundColor={theme.colors.card}
				backBehavior="history"
			>
				<NativeTabs.Trigger
					name="index"
					hidden={guest}
					disableAutomaticContentInsets={process.env.EXPO_OS === "ios"}
				>
					<NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon sf="house" src={tabIcons.home} />
				</NativeTabs.Trigger>
				<NativeTabs.Trigger
					name="search"
					disableAutomaticContentInsets={process.env.EXPO_OS === "ios"}
				>
					<NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon sf="safari" src={tabIcons.discover} />
				</NativeTabs.Trigger>
				<NativeTabs.Trigger
					name="social"
					hidden={guest}
					disableAutomaticContentInsets={process.env.EXPO_OS === "ios"}
				>
					<NativeTabs.Trigger.Label>Social</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon sf="person.2" src={tabIcons.social} />
				</NativeTabs.Trigger>
				<NativeTabs.Trigger
					name="profile"
					disableAutomaticContentInsets={process.env.EXPO_OS === "ios"}
					unstable_nativeProps={
						// SDK 58 omits Android original-color image tinting; keep the override here.
						!guest && avatar?.uri === uri
							? {
									android: {
										icon: {
											type: "imageSource",
											imageSource: avatar.default,
											tinting: "original",
										},
										selectedIcon: {
											type: "imageSource",
											imageSource: avatar.selected,
											tinting: "original",
										},
									},
								}
							: undefined
					}
					disabled={guest}
					listeners={
						guest ? { tabPress: () => router.push("/login") } : undefined
					}
				>
					<NativeTabs.Trigger.Label>
						{guest ? "Sign in" : "Profile"}
					</NativeTabs.Trigger.Label>
					{guest ? (
						<NativeTabs.Trigger.Icon
							sf="rectangle.portrait.and.arrow.right"
							src={tabIcons.login}
						/>
					) : avatar?.uri === uri ? (
						<NativeTabs.Trigger.Icon
							src={{ default: avatar.default, selected: avatar.selected }}
							renderingMode="original"
						/>
					) : (
						<NativeTabs.Trigger.Icon
							sf="person.crop.circle"
							src={tabIcons.profile}
						/>
					)}
				</NativeTabs.Trigger>
			</NativeTabs>
		</TraktSyncBanner>
	);
}
