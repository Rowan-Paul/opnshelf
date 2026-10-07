import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { privacyControllerStatusOptions } from "./generated/@tanstack/react-query.gen";
import {
	privacyControllerChange,
	privacyControllerChangeAllLists,
	privacyControllerListsDefault,
	privacyControllerRetry,
	privacyControllerStatus,
} from "./generated/sdk.gen";
import type { PrivacyChangeDto, PrivacyStatusDto } from "./generated/types.gen";

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
					const granted = await privacyControllerStatus({ throwOnError: true });
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
				await privacyControllerChange({ body: action.body, throwOnError: true })
			).data;
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
