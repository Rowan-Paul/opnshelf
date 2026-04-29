interface PaginationProps {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

export function Pagination({
	page,
	totalPages,
	onPageChange,
}: PaginationProps) {
	if (totalPages <= 1) return null;

	const getPageNumbers = () => {
		const pages: (number | string)[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible + 2) {
			for (let i = 1; i <= totalPages; i++) pages.push(i);
		} else {
			pages.push(1);
			if (page > 3) pages.push("...");

			const start = Math.max(2, page - 1);
			const end = Math.min(totalPages - 1, page + 1);
			for (let i = start; i <= end; i++) pages.push(i);

			if (page < totalPages - 2) pages.push("...");
			pages.push(totalPages);
		}
		return pages;
	};

	return (
		<div className="flex items-center justify-center gap-1">
			<button
				type="button"
				onClick={() => onPageChange(page - 1)}
				disabled={page <= 1}
				className="flex h-9 items-center rounded-md border border-(--border) bg-(--background-elevated) px-3 text-sm transition-colors hover:bg-(--background-subtle) disabled:opacity-40 disabled:hover:bg-(--background-elevated)"
			>
				← Prev
			</button>

			{getPageNumbers().map((p, i) =>
				p === "..." ? (
					<span
						key={`ellipsis-${i}`}
						className="flex h-9 w-9 items-center justify-center text-(--foreground-muted) text-sm"
					>
						...
					</span>
				) : (
					<button
						key={p}
						type="button"
						onClick={() => onPageChange(p as number)}
						className={`flex h-9 w-9 items-center justify-center rounded-md border font-medium text-sm transition-colors ${
							page === p
								? "border-(--accent) bg-(--accent) text-[#3f2e00]"
								: "border-(--border) bg-(--background-elevated) hover:bg-(--background-subtle)"
						}`}
					>
						{p}
					</button>
				),
			)}

			<button
				type="button"
				onClick={() => onPageChange(page + 1)}
				disabled={page >= totalPages}
				className="flex h-9 items-center rounded-md border border-(--border) bg-(--background-elevated) px-3 text-sm transition-colors hover:bg-(--background-subtle) disabled:opacity-40 disabled:hover:bg-(--background-elevated)"
			>
				Next →
			</button>
		</div>
	);
}
