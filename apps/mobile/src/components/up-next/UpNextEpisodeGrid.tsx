import { Children, type ReactNode, useState } from "react";
import { View } from "react-native";

/** Keep keyed cards mounted as folding or rotating changes the column count. */
export function UpNextEpisodeGrid({ children }: { children: ReactNode }) {
	const [width, setWidth] = useState(0);
	const columns = width >= 1000 ? 3 : width >= 600 ? 2 : 1;
	return (
		<View
			testID="up-next-episode-grid"
			className="flex-row flex-wrap gap-3"
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
		>
			{Children.map(children, (child) => (
				<View
					style={{
						width:
							columns === 1 ? "100%" : (width - 12 * (columns - 1)) / columns,
					}}
				>
					{child}
				</View>
			))}
		</View>
	);
}
