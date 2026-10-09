import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { privacyControllerStatusOptions } from "./generated/@tanstack/react-query.gen";
import {
	privacyControllerChange,
	privacyControllerChangeAllLists,
	privacyControllerListsDefault,
	privacyControllerRetry,
	privacyControllerStatus,
} from "./generated/sdk.gen";
import type {
	PrivacyChangeDto,
	PrivacyScopeDto,
	PrivacyStatusDto,
} from "./generated/types.gen";
import { getErrorMessage, getHttpStatus } from "./http-errors";

export type PrivacyAction = {
	kind: "change" | "retry" | "default" | "allLists" | "initial";
	body: PrivacyChangeDto;
};
export function privacyActionKey(action: PrivacyAction) {
	return action.kind === "default"
		? "default"
		: action.kind === "allLists"
			? "allLists"
			: `${action.body.category}:${action.body.listRkey ?? ""}`;
}
export function usePrivacy(
	authorize: (action: PrivacyAction) => Promise<boolean>,
) {
	const client = useQueryClient();
	const query = useQuery({
		...privacyControllerStatusOptions(),
		refetchInterval: (query) =>
			query.state.data?.scopes.some(
				(scope) =>
					scope.migration &&
					["running", "queued"].includes(scope.migration.status),
			)
				? 2000
				: false,
	});
	const previousMigrations = useRef<Set<string>>(new Set());
	useEffect(() => {
		if (!query.data) return;
		const current = new Set(
			query.data.scopes.flatMap((scope) =>
				scope.migration ? [scope.migration.id] : [],
			),
		);
		if ([...previousMigrations.current].some((id) => !current.has(id))) {
			void client.invalidateQueries({
				predicate: (query) =>
					/(?:usersControllerGetUser|shelfController|moviesControllerGetUser|showsControllerGetUser|listsController|notesController|libraryController)/.test(
						JSON.stringify(query.queryKey),
					),
			});
		}
		previousMigrations.current = current;
	}, [query.data, client]);
	const mutation = useMutation({
		mutationFn: async (action: PrivacyAction) => {
			try {
				if (
					action.body.visibility === "private" ||
					action.kind === "retry" ||
					(action.kind !== "default" &&
						query.data?.scopes.some(
							(scope) =>
								scope.category === action.body.category &&
								scope.visibility === "private",
						))
				) {
					const fresh = await privacyControllerStatus({ throwOnError: true });
					if (!fresh.data.authorized) {
						if (!(await authorize(action))) return;
						const granted = await privacyControllerStatus({
							throwOnError: true,
						});
						if (!granted.data.authorized)
							throw new Error(
								"Private access was not authorized. Your visibility is unchanged.",
							);
					}
				}
				if (action.kind === "default")
					return (
						await privacyControllerListsDefault({
							body: { visibility: action.body.visibility },
							throwOnError: true,
						})
					).data;
				if (action.kind === "allLists")
					return (
						await privacyControllerChangeAllLists({
							body: action.body,
							throwOnError: true,
						})
					).data;
				if (action.kind === "retry")
					return (
						await privacyControllerRetry({
							body: action.body,
							throwOnError: true,
						})
					).data;
				if (action.kind === "initial") {
					for (const category of ["watches", "library", "notes"] as const)
						await privacyControllerChange({
							body: { ...action.body, category },
							throwOnError: true,
						});
					await privacyControllerListsDefault({
						body: { visibility: action.body.visibility },
						throwOnError: true,
					});
					return (
						await privacyControllerChangeAllLists({
							body: { ...action.body, category: "lists" },
							throwOnError: true,
						})
					).data;
				}
				return (
					await privacyControllerChange({
						body: action.body,
						throwOnError: true,
					})
				).data;
			} catch (error) {
				// A duplicate request can lose the worker lock after its first request was
				// accepted. Reconcile the actual status before reporting a failed change.
				const message =
					error && typeof error === "object" && "message" in error
						? String(error.message)
						: "";
				if (
					getHttpStatus(error) === 409 &&
					/another watch operation/i.test(message) &&
					action.kind !== "initial"
				) {
					const fresh = await privacyControllerStatus({ throwOnError: true });
					const target = action.body.visibility;
					const matches = (scope: PrivacyScopeDto) =>
						scope.migration
							? scope.migration.target === target &&
								["queued", "running"].includes(scope.migration.status)
							: scope.visibility === target;
					const relevant = fresh.data.scopes.filter((scope) =>
						action.kind === "allLists"
							? scope.category === "lists"
							: scope.category === action.body.category &&
								scope.listRkey === (action.body.listRkey ?? null),
					);
					const accepted =
						action.kind === "default"
							? fresh.data.listsDefaultVisibility === target
							: action.kind === "allLists"
								? fresh.data.listsDefaultVisibility === target &&
									relevant.every(matches)
								: relevant.length === 1 && matches(relevant[0]);
					if (accepted) return fresh.data;
				}
				throw error;
			}
		},
		onSuccess: (data: PrivacyStatusDto | undefined) => {
			if (data)
				client.setQueryData(privacyControllerStatusOptions().queryKey, data);
			void client.invalidateQueries({
				predicate: (query) =>
					/(?:privacyController|watchPrivacyController|usersControllerGetUser|shelfController|moviesControllerGetUser|showsControllerGetUser|listsController|notesController|libraryController)/.test(
						JSON.stringify(query.queryKey),
					),
			});
		},
		onError: () => {
			void query.refetch();
		},
	});
	return {
		query,
		mutation,
		pendingKey:
			mutation.isPending && mutation.variables
				? privacyActionKey(mutation.variables)
				: null,
	};
}

/** Keep a finished migration visible until the next change or leaving the page. */
export function usePrivacyProgress(
	scopes: PrivacyScopeDto[] | undefined,
	pending: boolean,
) {
	const [history, setHistory] = useState<PrivacyScopeDto[]>([]);
	useEffect(() => {
		if (pending) setHistory([]);
	}, [pending]);
	useEffect(() => {
		if (!scopes) return;
		setHistory((previous) => {
			const entries = new Map(
				previous.map((scope) => [
					`${scope.category}:${scope.listRkey ?? ""}`,
					scope,
				]),
			);
			for (const scope of scopes)
				if (scope.migration)
					entries.set(`${scope.category}:${scope.listRkey ?? ""}`, scope);
			return [...entries.values()];
		});
	}, [scopes]);
	return history.map((previous) => {
		const current = scopes?.find(
			(scope) =>
				scope.category === previous.category &&
				scope.listRkey === previous.listRkey,
		);
		if (current?.migration) return current;
		const moving = previous.migration;
		if (current && moving && current.visibility === moving.target)
			return {
				...current,
				migration: {
					...moving,
					status: "completed",
					copied: moving.total ?? moving.copied,
					error: null,
				},
			};
		return previous;
	});
}

/** Heading and state for the progress dialog. A failed change keeps its
 * migration, so "stopped" is told apart from one that is still running. */
export function privacyProgressTitle(
	scopes: PrivacyScopeDto[],
	pending: boolean,
) {
	const statuses = scopes.flatMap((scope) =>
		scope.migration ? [scope.migration.status] : [],
	);
	const state: "running" | "stopped" | "done" =
		pending || statuses.some((status) => ["queued", "running"].includes(status))
			? "running"
			: statuses.some((status) => status !== "completed")
				? "stopped"
				: "done";
	const targets = new Set(
		scopes.flatMap((scope) =>
			scope.migration ? [scope.migration.target] : [],
		),
	);
	const target =
		targets.size !== 1
			? null
			: [...targets][0] === "private"
				? "Private"
				: "Public";
	if (state === "stopped")
		return { state, target, title: "Visibility change stopped" };
	if (!target)
		return {
			state,
			target,
			title: state === "running" ? "Changing visibility" : "Visibility changed",
		};
	const subject =
		scopes.length === 1
			? scopes[0].category === "watches"
				? "Shelf"
				: scopes[0].label
			: scopes.every((scope) => scope.category === "lists")
				? `${scopes.length} Lists`
				: "your data";
	if (state === "running")
		return { state, target, title: `Making ${subject} ${target}` };
	return {
		state,
		target,
		title: `${subject[0].toUpperCase()}${subject.slice(1)} ${
			scopes.length === 1 ? "is" : "are"
		} ${target}`,
	};
}

export function privacyErrorMessage(error: unknown, fallback: string) {
	const message = getErrorMessage(error, fallback);
	if (
		/fetch failed|failed to fetch|network request failed|could not connect to the server/i.test(
			message,
		)
	)
		return "We could not reach the server. Please check your connection and try again.";
	if (/another watch operation|watch operations are busy/i.test(message))
		return "Your account is still finishing another change. Please wait a moment, then try again.";
	return message;
}
