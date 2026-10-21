import type { ReactNode, RefObject } from "react";
import {
	ScrollView,
	type ScrollViewInstance,
	type ScrollViewProps,
	View,
} from "react-native";
import { usePaneWidth, useWideLayout } from "@/lib/use-wide-layout";

/** One compact page, or independently scrolling poster/actions and content panes. */
export function DetailColumns({
	primary,
	secondary,
	scrollRef,
	refreshControl,
	renderContent,
}: {
	primary: ReactNode;
	secondary: ReactNode;
	scrollRef?: RefObject<ScrollViewInstance | null>;
	refreshControl?: ScrollViewProps["refreshControl"];
	/** Season pages supply a virtualized episode list instead of a ScrollView. */
	renderContent?: (header: ReactNode) => ReactNode;
}) {
	const wide = useWideLayout();
	const primaryWidth = usePaneWidth();
	const header = (
		<>
			{!wide && <View style={{ gap: 24 }}>{primary}</View>}
			{secondary}
		</>
	);
	return (
		<View style={{ flex: 1, flexDirection: "row", gap: wide ? 24 : 0 }}>
			{wide && (
				<View style={{ width: primaryWidth, minWidth: 0 }}>
					<ScrollView
						style={{ flex: 1 }}
						contentContainerStyle={{ gap: 24, paddingBottom: 48 }}
						showsVerticalScrollIndicator={false}
					>
						{primary}
					</ScrollView>
				</View>
			)}
			<View style={{ flex: 1, minWidth: 0, paddingTop: wide ? 24 : 0 }}>
				{renderContent ? (
					renderContent(header)
				) : (
					<ScrollView
						ref={scrollRef}
						contentContainerStyle={{ gap: 24, paddingBottom: 48 }}
						showsVerticalScrollIndicator={false}
						refreshControl={refreshControl}
					>
						{header}
					</ScrollView>
				)}
			</View>
		</View>
	);
}
