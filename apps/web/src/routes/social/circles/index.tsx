import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "#/lib/auth-context";
import { useCircles, useCreateCircle } from "#/lib/hooks/useCircles";

const socialSearchSchema = z.object({ circleId: z.string().optional() });

export const Route = createFileRoute("/social/circles/")({
	validateSearch: socialSearchSchema,
	head: () => ({ meta: [{ title: "Circles | Opnshelf" }] }),
	component: CirclesPage,
});

function CirclesPage() {
	const { circleId } = Route.useSearch();
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const { data: circles = [] } = useCircles();
	const createCircle = useCreateCircle();
	const [name, setName] = useState("");

	useEffect(() => {
		if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
	}, [authLoading, isAuthenticated, navigate]);

	const create = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		createCircle.mutate(
			{ body: { name: trimmed } },
			{ onSuccess: () => setName("") },
		);
	};

	return (
		<div className="container-app py-8">
			<Link
				to="/social"
				search={circleId ? { circleId } : {}}
				className="mb-4 inline-flex items-center gap-1 text-(--foreground-muted) text-sm hover:text-(--foreground)"
			>
				<ChevronRight className="size-4 rotate-180" /> Social
			</Link>
			<div className="space-y-6">
				<div>
					<h1 className="font-bold font-display text-3xl">Circles</h1>
					<p className="text-(--foreground-muted)">
						Private groups of people you follow, for filtering your activity
						feed.
					</p>
				</div>
				<div className="flex gap-2">
					<input
						className="input flex-1"
						placeholder="New circle name"
						maxLength={50}
						value={name}
						onChange={(event) => setName(event.target.value)}
						onKeyDown={(event) => event.key === "Enter" && create()}
					/>
					<button
						type="button"
						className="btn btn-primary"
						onClick={create}
						disabled={!name.trim() || createCircle.isPending}
					>
						{createCircle.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Plus className="size-4" />
						)}
						<span className="sr-only">Create circle</span>
					</button>
				</div>
				{circles.length === 0 ? (
					<div className="card p-8 text-center text-(--foreground-muted)">
						<p className="font-medium text-(--foreground)">No circles yet</p>
						<p className="mt-1 text-sm">
							Create one, then add people you follow.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{circles.map((circle) => (
							<Link
								key={circle.id}
								to="/social/circles/$circleId"
								params={{ circleId: circle.id }}
								search={{ circleId: circleId ?? circle.id }}
								className="card flex items-center justify-between p-4 hover:opacity-80"
							>
								<div>
									<p className="font-medium">{circle.name}</p>
									<p className="text-(--foreground-muted) text-sm">
										{circle.memberCount}{" "}
										{circle.memberCount === 1 ? "person" : "people"}
									</p>
								</div>
								<ChevronRight className="size-5 text-(--foreground-muted)" />
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
