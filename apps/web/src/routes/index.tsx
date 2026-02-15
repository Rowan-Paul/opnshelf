import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Search } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [{ title: "OpnShelf" }],
	}),
	component: HomePage,
});

function HomePage() {
	const { seedColor } = useTheme();

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-16 max-w-4xl">
				<div className="text-center mb-12">
					<div className="flex justify-center mb-6">
						<Film className="w-16 h-16" style={{ color: seedColor }} />
					</div>
					<h1 className="md-display-large mb-4">OpnShelf</h1>
					<p
						className="md-headline-small mb-8"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Your personal media tracker powered by AT Protocol
					</p>
					<M3Button variant="filled" size="lg" asChild>
						<Link to="/search" search={{ q: "" }}>
							<Search className="w-5 h-5 mr-2" />
							Search Movies
						</Link>
					</M3Button>
				</div>

				<div className="grid md:grid-cols-3 gap-6 mt-16">
					<M3Card variant="elevated">
						<M3CardHeader>
							<M3CardTitle>Track Your Media</M3CardTitle>
						</M3CardHeader>
						<M3CardContent>
							<M3CardDescription>
								Keep track of movies, shows, and games you&apos;ve watched and
								played
							</M3CardDescription>
						</M3CardContent>
					</M3Card>
					<M3Card variant="elevated">
						<M3CardHeader>
							<M3CardTitle>Own Your Data</M3CardTitle>
						</M3CardHeader>
						<M3CardContent>
							<M3CardDescription>
								Built on AT Protocol - your data belongs to you
							</M3CardDescription>
						</M3CardContent>
					</M3Card>
					<M3Card variant="elevated">
						<M3CardHeader>
							<M3CardTitle>Discover & Share</M3CardTitle>
						</M3CardHeader>
						<M3CardContent>
							<M3CardDescription>
								See what others are watching and share your favorites
							</M3CardDescription>
						</M3CardContent>
					</M3Card>
				</div>
			</div>
		</div>
	);
}
