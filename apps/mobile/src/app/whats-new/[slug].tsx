import { useLocalSearchParams } from "expo-router";
import { ReleaseNotesScreen } from "@/components/release-notes/ReleaseNotesScreen";
export default function ReleaseNotesDetail() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	return <ReleaseNotesScreen slug={slug} />;
}
