import { showsControllerGetUserUpNextOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PaginationControls } from "@/components/PaginationControls";
import { UpNextShowCollection } from "@/components/up-next/UpNextShowCollection";
import { usePublicProfile } from "@/hooks/usePublicProfile";
import { getVisiblePages, parsePageNumber } from "@/lib/pagination";

const PAGE_SIZE = 8;

export const Route = createFileRoute("/u/$handle/up-next")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: parsePageNumber(search.page),
	}),
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} Up Next | OpnShelf` }],
	}),
	component: PublicUpNextPage,
});

function PublicUpNextPage() {
	const { handle } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data: profile } = usePublicProfile(handle);
	const userDid = profile?.did ?? "";

	const upNextQuery = useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: !!userDid,
	});
	const items = upNextQuery.data?.items ?? [];
	const currentPage = upNextQuery.data?.page ?? page;
	const totalPages = upNextQuery.data?.totalPages ?? 0;
	const pageNumbers = useMemo(
		() => getVisiblePages(currentPage, totalPages),
		[currentPage, totalPages],
	);

	useEffect(() => {
		if (!upNextQuery.data) {
			return;
		}

		if (upNextQuery.data.page !== page) {
			navigate({
				search: { page: upNextQuery.data.page },
				replace: true,
				resetScroll: false,
			});
		}
	}, [navigate, page, upNextQuery.data]);

	if (!profile) {
		return null;
	}

	return (
		<div className="space-y-6">
			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={upNextQuery.isFetching}
				onPageChange={(nextPage) => {
					navigate({ search: { page: nextPage } });
				}}
			/>

			<UpNextShowCollection
				isLoading={upNextQuery.isLoading}
				upNext={items}
				userDid={userDid}
				readOnly
				showHeader={false}
				variant="profile"
			/>

			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={upNextQuery.isFetching}
				onPageChange={(nextPage) => {
					navigate({ search: { page: nextPage } });
				}}
			/>
		</div>
	);
}
