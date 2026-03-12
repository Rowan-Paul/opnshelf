import { getYouTubeEmbedUrl, type TmdbTrailerDto } from "@opnshelf/api";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type TrailerPlayerModalProps = {
	visible: boolean;
	trailer: TmdbTrailerDto | null;
	onClose: () => void;
};

const FALLBACK_APP_ID = "com.rowanpaul.opnshelf";

function getYouTubeReferer(): string {
	const appId = (Application.applicationId || FALLBACK_APP_ID).toLowerCase();
	return `https://${appId}`;
}

export function TrailerPlayerModal({
	visible,
	trailer,
	onClose,
}: TrailerPlayerModalProps) {
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	const referer = getYouTubeReferer();

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="fullScreen"
			onRequestClose={onClose}
		>
			<SafeAreaView
				style={[
					styles.container,
					{
						backgroundColor: colors.background,
						paddingTop: Math.max(insets.top, spacing.xl),
						paddingBottom: Math.max(insets.bottom, spacing.lg),
					},
				]}
				edges={["left", "right"]}
			>
				<View style={styles.header}>
					<View style={styles.headerCopy}>
						<Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
							Trailer
						</Text>
						<Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
							{trailer?.name || "Trailer"}
						</Text>
					</View>
					<Pressable
						onPress={onClose}
						style={[
							styles.closeButton,
							{ backgroundColor: colors.surfaceContainerHigh },
						]}
					>
						<Ionicons name="close" size={22} color={colors.onSurface} />
					</Pressable>
				</View>

				<View
					style={[
						styles.playerFrame,
						{ backgroundColor: colors.surfaceContainerHigh },
					]}
				>
					{trailer ? (
						<WebView
							source={{
								uri: getYouTubeEmbedUrl(trailer.key, { autoplay: true }),
								headers: {
									Referer: referer,
								},
							}}
							style={styles.webview}
							allowsFullscreenVideo
							allowsInlineMediaPlayback
							javaScriptEnabled
							domStorageEnabled
							mediaPlaybackRequiresUserAction={false}
						/>
					) : null}
				</View>
			</SafeAreaView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: spacing.md,
	},
	header: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: spacing.md,
		justifyContent: "space-between",
		marginBottom: spacing.lg,
	},
	headerCopy: {
		flex: 1,
		gap: spacing.xs,
	},
	eyebrow: {
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 1.2,
		textTransform: "uppercase",
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
	},
	closeButton: {
		alignItems: "center",
		borderRadius: borderRadius.full,
		height: 40,
		justifyContent: "center",
		width: 40,
	},
	playerFrame: {
		aspectRatio: 16 / 9,
		borderRadius: borderRadius.xl,
		overflow: "hidden",
	},
	webview: {
		flex: 1,
	},
});
