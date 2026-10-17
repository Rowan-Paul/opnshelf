import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pick-for-me/result")({
	component: () => null,
	head: () => ({ meta: [{ title: "Your pick | Opnshelf" }] }),
});
