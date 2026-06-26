import type { CircleDto } from "@opnshelf/api";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { ManageCirclesDialog } from "./ManageCirclesDialog";

interface CircleFilterBarProps {
	circles: CircleDto[];
	activeCircleId?: string;
	onSelect: (circleId?: string) => void;
}

export function CircleFilterBar({
	circles,
	activeCircleId,
	onSelect,
}: CircleFilterBarProps) {
	const [manageOpen, setManageOpen] = useState(false);

	const pillClass = (active: boolean) =>
		`rounded-full px-3 py-1 text-sm transition-colors ${
			active
				? "bg-(--accent) text-(--accent-foreground)"
				: "bg-(--background-elevated) text-(--foreground-muted) hover:text-(--foreground)"
		}`;

	return (
		<div className="flex flex-wrap items-center gap-2">
			<button
				type="button"
				className={pillClass(!activeCircleId)}
				onClick={() => onSelect(undefined)}
			>
				All
			</button>
			{circles.map((circle) => (
				<button
					key={circle.id}
					type="button"
					className={pillClass(activeCircleId === circle.id)}
					onClick={() => onSelect(circle.id)}
				>
					{circle.name}
				</button>
			))}
			<button
				type="button"
				className="ml-auto inline-flex items-center gap-1 text-(--foreground-muted) text-sm hover:text-(--foreground)"
				onClick={() => setManageOpen(true)}
			>
				<Settings2 className="size-4" />
				Manage
			</button>

			<ManageCirclesDialog
				open={manageOpen}
				onOpenChange={setManageOpen}
				circles={circles}
			/>
		</div>
	);
}
