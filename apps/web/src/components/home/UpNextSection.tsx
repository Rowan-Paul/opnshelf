import type { UpNextShowDto } from "@opnshelf/api";
import { UpNextShowCollection } from "@/components/up-next/UpNextShowCollection";

type UpNextSectionProps = {
	isLoading: boolean;
	upNext: UpNextShowDto[];
	userDid: string;
	userHandle: string;
};

export function UpNextSection({
	isLoading,
	upNext,
	userDid,
	userHandle,
}: UpNextSectionProps) {
	return (
		<UpNextShowCollection
			isLoading={isLoading}
			upNext={upNext}
			userDid={userDid}
			profileHandle={userHandle}
			limit={4}
			showHeader
			variant="dashboard"
		/>
	);
}
