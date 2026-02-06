import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Search } from "lucide-react";

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
					<Link
						to="/search"
						search={{ q: "" }}
						className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
					>
						<Search className="w-5 h-5" />
						Search Movies
					</Link>
				</div>

				<div className="grid md:grid-cols-3 gap-6 mt-16">
					<div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
						<h3 className="text-lg font-semibold mb-2">Track Your Media</h3>
						<p className="text-gray-400">
							Keep track of movies, shows, and games you've watched and played
						</p>
					</div>
					<div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
						<h3 className="text-lg font-semibold mb-2">Own Your Data</h3>
						<p className="text-gray-400">
							Built on AT Protocol - your data belongs to you
						</p>
					</div>
					<div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
						<h3 className="text-lg font-semibold mb-2">Discover & Share</h3>
						<p className="text-gray-400">
							See what others are watching and share your favorites
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
