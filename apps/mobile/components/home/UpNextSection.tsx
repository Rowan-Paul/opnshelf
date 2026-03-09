import type { UpNextShowDto } from "@opnshelf/api";
import { router } from "expo-router";
import { UpNextShowList } from "@/components/up-next/UpNextShowList";

type UpNextSectionProps = {
	isLoading: boolean;
	items: UpNextShowDto[];
	userDid: string;
};

export function UpNextSection({
	isLoading,
	items,
	userDid,
}: UpNextSectionProps) {
	return (
		<UpNextShowList
			isLoading={isLoading}
			items={items}
			userDid={userDid}
			variant="dashboard"
			showHeader
			onHeaderPress={() => router.push("/(tabs)/profile/up-next")}
		/>
	);
}
