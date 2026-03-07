import { ChevronLeft, ChevronRight } from "lucide-react";
import { M3Button } from "@/components/ui/m3-button";

interface PaginationControlsProps {
	currentPage: number;
	totalPages: number;
	pageNumbers: Array<number | "ellipsis">;
	isFetching: boolean;
	onPageChange: (page: number) => void;
}

export function PaginationControls({
	currentPage,
	totalPages,
	pageNumbers,
	isFetching,
	onPageChange,
}: PaginationControlsProps) {
	if (totalPages <= 1) {
		return null;
	}

	return (
		<div
			className="grid gap-3 rounded-[28px] border px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center"
			style={{
				backgroundColor: "var(--md-sys-color-surface-container)",
				borderColor: "var(--md-sys-color-outline-variant)",
			}}
		>
			<div className="flex flex-wrap items-center justify-center gap-1 md:gap-2 md:hidden">
				{pageNumbers.map((pageNumber, index) =>
					pageNumber === "ellipsis" ? (
						<span
							key={`mobile-ellipsis-${pageNumbers[index - 1]}-${pageNumbers[index + 1]}`}
							className="px-1 text-sm"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							...
						</span>
					) : (
						<M3Button
							key={`mobile-${pageNumber}`}
							variant={pageNumber === currentPage ? "filled-tonal" : "text"}
							size="sm"
							onClick={() => onPageChange(pageNumber)}
							disabled={isFetching && pageNumber === currentPage}
							aria-current={pageNumber === currentPage ? "page" : undefined}
						>
							{pageNumber}
						</M3Button>
					),
				)}
			</div>

			<div className="grid grid-cols-2 gap-3 md:hidden">
				<M3Button
					variant="outlined"
					size="sm"
					className="w-full justify-center"
					disabled={currentPage <= 1 || isFetching}
					onClick={() => onPageChange(currentPage - 1)}
				>
					<ChevronLeft className="size-4" />
					Previous
				</M3Button>
				<M3Button
					variant="outlined"
					size="sm"
					className="w-full justify-center"
					disabled={currentPage >= totalPages || isFetching}
					onClick={() => onPageChange(currentPage + 1)}
				>
					Next
					<ChevronRight className="size-4" />
				</M3Button>
			</div>

			<div className="hidden items-center gap-2 md:flex md:justify-self-start">
				<M3Button
					variant="outlined"
					size="sm"
					disabled={currentPage <= 1 || isFetching}
					onClick={() => onPageChange(currentPage - 1)}
				>
					<ChevronLeft className="size-4" />
					Previous
				</M3Button>
			</div>

			<div className="hidden flex-wrap items-center justify-center gap-2 md:flex md:justify-self-center">
				{pageNumbers.map((pageNumber, index) =>
					pageNumber === "ellipsis" ? (
						<span
							key={`ellipsis-${pageNumbers[index - 1]}-${pageNumbers[index + 1]}`}
							className="px-1 text-sm"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							...
						</span>
					) : (
						<M3Button
							key={pageNumber}
							variant={pageNumber === currentPage ? "filled-tonal" : "text"}
							size="sm"
							onClick={() => onPageChange(pageNumber)}
							disabled={isFetching && pageNumber === currentPage}
							aria-current={pageNumber === currentPage ? "page" : undefined}
						>
							{pageNumber}
						</M3Button>
					),
				)}
			</div>

			<div className="hidden items-center gap-2 md:flex md:justify-self-end">
				<M3Button
					variant="outlined"
					size="sm"
					disabled={currentPage >= totalPages || isFetching}
					onClick={() => onPageChange(currentPage + 1)}
				>
					Next
					<ChevronRight className="size-4" />
				</M3Button>
			</div>
		</div>
	);
}
