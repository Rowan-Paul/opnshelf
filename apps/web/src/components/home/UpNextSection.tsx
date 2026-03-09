import type { UpNextShowDto } from "@opnshelf/api";
import { UpNextShowCollection } from "@/components/up-next/UpNextShowCollection";

type UpNextSectionProps = {
	isLoading: boolean;
	upNext: UpNextShowDto[];
	userDid: string;
};

export function UpNextSection({
	isLoading,
	upNext,
	userDid,
}: UpNextSectionProps) {
	return (
		<UpNextShowCollection
			isLoading={isLoading}
			upNext={upNext}
			userDid={userDid}
			limit={4}
			showHeader
			variant="dashboard"
		/>
	);
}
