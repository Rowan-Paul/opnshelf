import {
	type SocialUserCardDto,
	socialControllerGetFollowingOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { z } from "zod";
import { UserAvatar } from "#/components/following/UserAvatar";
import { useAuth } from "#/lib/auth-context";
import {
	useAddCircleMember,
	useCircleMembers,
	useCircles,
	useDeleteCircle,
	useRemoveCircleMember,
	useRenameCircle,
} from "#/lib/hooks/useCircles";

const socialSearchSchema = z.object({ circleId: z.string().optional() });

export const Route = createFileRoute("/social/circles/$circleId")({
	validateSearch: socialSearchSchema,
	head: () => ({ meta: [{ title: "Circle | Opnshelf" }] }),
	component: CircleDetailPage,
});

function UserLine({
	user,
	action,
}: {
	user: SocialUserCardDto;
	action: ReactNode;
}) {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-(--border) p-3">
			<UserAvatar
				src={user.avatar}
				alt={String(user.displayName) || user.handle}
			/>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">
					{String(user.displayName) || user.handle}
				</p>
				<p className="truncate text-(--foreground-muted) text-xs">
					@{user.handle}
				</p>
			</div>
			{action}
		</div>
	);
}

function CircleDetailPage() {
	const { circleId } = Route.useParams();
	const { circleId: selectedCircleId } = Route.useSearch();
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const circlesQuery = useCircles();
	const circle = circlesQuery.data?.find((item) => item.id === circleId);
	const { data: membersData } = useCircleMembers(circleId);
	const members = membersData?.items ?? [];
	const { data: followingData } = useQuery({
		...socialControllerGetFollowingOptions({
			path: { handle: user?.handle || "" },
			query: { pageSize: 50 },
		}),
		enabled: !!user?.handle,
	});
	const addable = (followingData?.items ?? []).filter(
		(item) => !(item.circleIds ?? []).includes(circleId),
	);
	const addMember = useAddCircleMember();
	const removeMember = useRemoveCircleMember();
	const renameCircle = useRenameCircle();
	const deleteCircle = useDeleteCircle();
	const [name, setName] = useState("");

	useEffect(() => {
		if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
	}, [authLoading, isAuthenticated, navigate]);
	useEffect(() => {
		if (circle) setName(circle.name);
	}, [circle]);
	useEffect(() => {
		if (circlesQuery.isSuccess && !circle) {
			navigate({ to: "/social", search: {}, replace: true });
		}
	}, [circle, circlesQuery.isSuccess, navigate]);

	const rename = () => {
		const trimmed = name.trim();
		if (circle && trimmed && trimmed !== circle.name) {
			renameCircle.mutate({ path: { circleId }, body: { name: trimmed } });
		}
	};
	const remove = () => {
		if (
			!window.confirm(`Delete "${circle?.name}"? This won't unfollow anyone.`)
		) {
			return;
		}
		deleteCircle.mutate(
			{ path: { circleId } },
			{
				onSuccess: () => navigate({ to: "/social", search: {}, replace: true }),
			},
		);
	};

	return (
		<div className="container-app py-8">
			<Link
				to="/social/circles"
				search={selectedCircleId ? { circleId: selectedCircleId } : {}}
				className="mb-4 inline-flex items-center gap-1 text-(--foreground-muted) text-sm hover:text-(--foreground)"
			>
				<ArrowLeft className="size-4" /> Circles
			</Link>
			<div className="space-y-8">
				<div className="flex items-center gap-2">
					<input
						className="input flex-1 font-display font-semibold text-lg"
						value={name}
						maxLength={50}
						onChange={(event) => setName(event.target.value)}
						onBlur={rename}
						onKeyDown={(event) =>
							event.key === "Enter" && event.currentTarget.blur()
						}
					/>
					<button
						type="button"
						className="btn bg-red-600 text-white hover:bg-red-700"
						onClick={remove}
						disabled={deleteCircle.isPending}
						title="Delete circle"
					>
						<Trash2 className="size-4" />
					</button>
				</div>

				<section className="space-y-3">
					<h2 className="font-display font-semibold">
						Members ({members.length})
					</h2>
					{members.length === 0 ? (
						<p className="text-(--foreground-muted) text-sm">
							No one in this circle yet. Add people below.
						</p>
					) : (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{members.map((member) => (
								<UserLine
									key={member.did}
									user={member}
									action={
										<button
											type="button"
											className="btn btn-secondary btn-sm"
											disabled={
												removeMember.isPending &&
												removeMember.variables?.path?.targetDid === member.did
											}
											onClick={() =>
												removeMember.mutate({
													path: { circleId, targetDid: member.did },
												})
											}
										>
											Remove
										</button>
									}
								/>
							))}
						</div>
					)}
				</section>

				<section className="space-y-3">
					<h2 className="font-display font-semibold">Add people you follow</h2>
					{addable.length === 0 ? (
						<p className="text-(--foreground-muted) text-sm">
							Everyone you follow is already in this circle.
						</p>
					) : (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{addable.map((person) => {
								const pending =
									addMember.isPending &&
									addMember.variables?.path?.targetDid === person.did;
								return (
									<UserLine
										key={person.did}
										user={person}
										action={
											<button
												type="button"
												className="btn btn-primary btn-sm"
												disabled={pending}
												onClick={() =>
													addMember.mutate({
														path: { circleId, targetDid: person.did },
													})
												}
											>
												{pending ? (
													<Loader2 className="size-3 animate-spin" />
												) : (
													<Plus className="mr-1 size-3" />
												)}
												Add
											</button>
										}
									/>
								);
							})}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
