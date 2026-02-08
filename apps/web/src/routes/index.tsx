import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [{ title: "OpnShelf" }],
	}),
	component: HomePage,
});

function HomePage() {
	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-16 max-w-4xl">
				<div className="text-center mb-12">
					<div className="flex justify-center mb-6">
						<Film className="w-16 h-16 text-purple-500" />
					</div>
					<h1 className="text-5xl font-bold mb-4">OpnShelf</h1>
					<p className="text-xl text-gray-400 mb-8">
						Your personal media tracker powered by AT Protocol
					</p>
					<Button asChild size="lg">
						<Link to="/search" search={{ q: "" }}>
							<Search className="w-5 h-5 mr-2" />
							Search Movies
						</Link>
					</Button>
				</div>

				<div className="grid md:grid-cols-3 gap-6 mt-16">
					<Card className="bg-gray-900 border-gray-800">
						<CardHeader>
							<CardTitle>Track Your Media</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription>
								Keep track of movies, shows, and games you&apos;ve watched and
								played
							</CardDescription>
						</CardContent>
					</Card>
					<Card className="bg-gray-900 border-gray-800">
						<CardHeader>
							<CardTitle>Own Your Data</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription>
								Built on AT Protocol - your data belongs to you
							</CardDescription>
						</CardContent>
					</Card>
					<Card className="bg-gray-900 border-gray-800">
						<CardHeader>
							<CardTitle>Discover & Share</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription>
								See what others are watching and share your favorites
							</CardDescription>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
