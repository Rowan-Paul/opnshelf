import { createFileRoute } from "@tanstack/react-router";
import { FeaturedEditor } from "#/components/featured/FeaturedEditor";

export const Route = createFileRoute("/admin/featured")({
	head: () => ({
		meta: [
			{ title: "Featured Content · Opnshelf" },
			{ name: "robots", content: "noindex" },
		],
	}),
	component: FeaturedEditor,
});
