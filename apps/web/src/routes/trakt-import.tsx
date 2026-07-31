import { authControllerMeOptions } from "@opnshelf/api";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { TraktImportManager } from "#/components/trakt/TraktImportManager";
import { ssrAuthOptions } from "#/lib/api";

function isUnauthorizedError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		("status" in error || "statusCode" in error) &&
		((error as Record<string, unknown>).status === 401 ||
			(error as Record<string, unknown>).statusCode === 401)
	);
}

export const Route = createFileRoute("/trakt-import")({
	beforeLoad: async ({ context }) => {
		try {
			await context.queryClient.fetchQuery(
				authControllerMeOptions(ssrAuthOptions()),
			);
		} catch (error) {
			if (isUnauthorizedError(error)) {
				throw redirect({
					to: "/login",
					search: { message: "Please log in to import from Trakt" },
				});
			}
			throw error;
		}
	},
	head: () => ({ meta: [{ title: "Import from Trakt | Opnshelf" }] }),
	component: TraktImportPage,
});

function TraktImportPage() {
	return (
		<div className="container-app py-8 sm:py-12">
			<TraktImportManager />
		</div>
	);
}
