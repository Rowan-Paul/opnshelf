// Native tab icons accept image sources, so rasterize the circular crop and ring.
import { useEffect, useRef, useState } from "react";
import { type ColorValue, type ImageURISource, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, Image, Path } from "react-native-svg";
import { useThemeColors } from "@/theme/colors";

type Images = { default: ImageURISource; selected: ImageURISource };
export function NativeTabAvatar({
	uri,
	color,
	onReady,
}: {
	uri?: string | null;
	color: ColorValue;
	onReady: (images: Images) => void;
}) {
	const colors = useThemeColors();
	const [loaded, setLoaded] = useState({ normal: false, selected: false });
	const normal = useRef<Svg>(null);
	const selected = useRef<Svg>(null);
	useEffect(() => {
		// Android skips image load events on memory-cache hits. Export after drawing,
		// then refresh when either uncached image finishes loading.
		if (
			process.env.EXPO_OS !== "android" &&
			uri &&
			(!loaded.normal || !loaded.selected)
		)
			return;
		let active = true;
		const frame = requestAnimationFrame(() => {
			normal.current?.toDataURL(
				(defaultImage) => {
					if (!active) return;
					selected.current?.toDataURL(
						(selectedImage) => {
							if (!active) return;
							const source = (data: string): ImageURISource => ({
								uri: `data:image/png;base64,${data}`,
								width: 28,
								height: 28,
								scale: 3,
							});
							onReady({
								default: source(defaultImage),
								selected: source(selectedImage),
							});
						},
						{ width: 84, height: 84 },
					);
				},
				{ width: 84, height: 84 },
			);
		});
		return () => {
			active = false;
			cancelAnimationFrame(frame);
		};
	}, [loaded.normal, loaded.selected, uri, onReady]);

	return (
		<View
			pointerEvents="none"
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={{ position: "absolute", left: -1000, top: -1000 }}
		>
			{[false, true].map((focused) => (
				<Svg
					key={String(focused)}
					ref={focused ? selected : normal}
					width={84}
					height={84}
					viewBox="0 0 28 28"
				>
					<Defs>
						<ClipPath id="avatar">
							<Circle cx={14} cy={14} r={focused ? 12 : 14} />
						</ClipPath>
					</Defs>
					<Circle cx={14} cy={14} r={14} fill="#1e293b" />
					{(!loaded.normal || !loaded.selected) &&
						(process.env.EXPO_OS !== "android" || !uri) && (
							<>
								<Circle
									cx={14}
									cy={10}
									r={4}
									fill="none"
									stroke={colors.mutedForeground}
									strokeWidth={2}
								/>
								<Path
									d="M7 23v-3c0-6 14-6 14 0v3"
									fill="none"
									stroke={colors.mutedForeground}
									strokeWidth={2}
								/>
							</>
						)}
					{uri && (
						<Image
							href={{ uri }}
							width={28}
							height={28}
							preserveAspectRatio="xMidYMid slice"
							clipPath="url(#avatar)"
							onLoad={() => {
								setLoaded((current) => ({
									...current,
									[focused ? "selected" : "normal"]: true,
								}));
							}}
						/>
					)}
					{focused && (
						<Circle
							cx={14}
							cy={14}
							r={13}
							fill="none"
							stroke={color}
							strokeWidth={2}
						/>
					)}
				</Svg>
			))}
		</View>
	);
}
