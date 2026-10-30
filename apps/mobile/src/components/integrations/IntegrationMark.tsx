import type { IntegrationId } from "@opnshelf/api";
import { Popcorn } from "lucide-react-native";
import { TraktMark } from "@/components/marks/TraktMark";
import { useThemeColors } from "@/theme/colors";

/**
 * Trakt keeps its own logomark. Popfeed publishes no brand assets we can use,
 * so it gets a neutral popcorn glyph rather than a copy of its logo. Same
 * choice as the Web App's `IntegrationMark`.
 */
export function IntegrationMark({
	id,
	size = 44,
}: {
	id: IntegrationId;
	size?: number;
}) {
	const colors = useThemeColors();
	if (id === "trakt") return <TraktMark size={size} />;
	return <Popcorn size={size} color={colors.accent} />;
}
