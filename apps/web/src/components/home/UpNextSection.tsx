import type { UpNextShowDto } from "@opnshelf/api";
import { UpNextShowCollection } from "@/components/up-next/UpNextShowCollection";

type UpNextSectionProps = {
	isFetching: boolean;
	isLoading: boolean;
	upNext: UpNextShowDto[];
	userDid: string;
	userHandle: string;
};

export function UpNextSection({
	isFetching,
	isLoading,
	upNext,
	userDid,
	userHandle,
}: UpNextSectionProps) {
	return (
		<UpNextShowCollection
			isFetching={isFetching}
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
