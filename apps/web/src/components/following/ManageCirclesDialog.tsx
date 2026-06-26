import type { CircleDto } from "@opnshelf/api";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	useCreateCircle,
	useDeleteCircle,
	useRenameCircle,
} from "#/lib/hooks/useCircles";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";

interface ManageCirclesDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	circles: CircleDto[];
}

export function ManageCirclesDialog({
	open,
	onOpenChange,
	circles,
}: ManageCirclesDialogProps) {
	const [newName, setNewName] = useState("");
	const createCircle = useCreateCircle();
	const renameCircle = useRenameCircle();
	const deleteCircle = useDeleteCircle();

	const handleCreate = () => {
		const name = newName.trim();
		if (!name) return;
		createCircle.mutate(
			{ body: { name } },
			{ onSuccess: () => setNewName("") },
		);
	};

	const handleRename = (circle: CircleDto, value: string) => {
		const name = value.trim();
		if (!name || name === circle.name) return;
		renameCircle.mutate({ path: { circleId: circle.id }, body: { name } });
	};

	const handleDelete = (circle: CircleDto) => {
		if (
			!window.confirm(
				`Delete the "${circle.name}" circle? This won't unfollow anyone.`,
			)
		) {
			return;
		}
		deleteCircle.mutate({ path: { circleId: circle.id } });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Manage circles</DialogTitle>
					<DialogDescription>
						Circles are private groups of people you follow. Use them to filter
						your feed.
					</DialogDescription>
				</DialogHeader>

				<div className="flex gap-2">
					<input
						className="input flex-1"
						placeholder="New circle name"
						maxLength={50}
						value={newName}
						onChange={(event) => setNewName(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") handleCreate();
						}}
					/>
					<button
						type="button"
						className="btn btn-primary"
						onClick={handleCreate}
						disabled={!newName.trim() || createCircle.isPending}
					>
						{createCircle.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							"Add"
						)}
					</button>
				</div>

				{circles.length > 0 && (
					<div className="space-y-2">
						{circles.map((circle) => (
							<div key={circle.id} className="flex items-center gap-2">
								<input
									className="input flex-1"
									defaultValue={circle.name}
									maxLength={50}
									onBlur={(event) => handleRename(circle, event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") event.currentTarget.blur();
									}}
								/>
								<span className="w-16 text-(--foreground-muted) text-xs">
									{circle.memberCount}{" "}
									{circle.memberCount === 1 ? "member" : "members"}
								</span>
								<button
									type="button"
									className="btn btn-ghost btn-sm h-9 px-2 text-red-600"
									onClick={() => handleDelete(circle)}
									disabled={
										deleteCircle.isPending &&
										deleteCircle.variables?.path?.circleId === circle.id
									}
									title="Delete circle"
								>
									<Trash2 className="size-4" />
								</button>
							</div>
						))}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
