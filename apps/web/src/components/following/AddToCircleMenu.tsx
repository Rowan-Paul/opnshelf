import type { CircleDto } from "@opnshelf/api";
import { Loader2, Plus } from "lucide-react";
import {
	useAddCircleMember,
	useRemoveCircleMember,
} from "#/lib/hooks/useCircles";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface AddToCircleMenuProps {
	targetDid: string;
	circles: CircleDto[];
	// Ids of the circles this user already belongs to.
	memberOf: string[];
}

export function AddToCircleMenu({
	targetDid,
	circles,
	memberOf,
}: AddToCircleMenuProps) {
	const addMember = useAddCircleMember();
	const removeMember = useRemoveCircleMember();
	const isPending = addMember.isPending || removeMember.isPending;
	const member = new Set(memberOf);

	const toggle = (circleId: string, currentlyMember: boolean) => {
		const variables = { path: { circleId, targetDid } };
		if (currentlyMember) {
			removeMember.mutate(variables);
		} else {
			addMember.mutate(variables);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="btn btn-secondary btn-sm h-8 px-2 text-xs"
					title="Add to circle"
					disabled={isPending}
				>
					{isPending ? (
						<Loader2 className="size-3 animate-spin" />
					) : (
						<Plus className="size-3" />
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel>Circles</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{circles.length === 0 ? (
					<div className="px-2 py-1.5 text-(--foreground-muted) text-xs">
						No circles yet. Create one below the feed.
					</div>
				) : (
					circles.map((circle) => {
						const currentlyMember = member.has(circle.id);
						return (
							<DropdownMenuCheckboxItem
								key={circle.id}
								checked={currentlyMember}
								// Keep the menu open so multiple circles can be toggled.
								onSelect={(event) => {
									event.preventDefault();
									toggle(circle.id, currentlyMember);
								}}
							>
								{circle.name}
							</DropdownMenuCheckboxItem>
						);
					})
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
