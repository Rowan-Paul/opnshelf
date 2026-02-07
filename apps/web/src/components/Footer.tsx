import { Link } from "@tanstack/react-router";
import { Film, Github } from "lucide-react";

export default function Footer() {
	return (
		<footer className="bg-gray-900 text-gray-400 py-8 border-t border-gray-800">
			<div className="container mx-auto px-4">
				<div className="flex flex-col md:flex-row items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<Film className="w-6 h-6 text-purple-500" />
						<span className="font-semibold text-white">OpnShelf</span>
					</div>

					<nav className="flex items-center gap-6 text-sm">
						<Link to="/privacy" className="hover:text-white transition-colors">
							Privacy Policy
						</Link>
						<a
							href="https://github.com/Rowan-Paul/opnshelf"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 hover:text-white transition-colors"
						>
							<Github className="w-4 h-4" />
							GitHub
						</a>
					</nav>

					<p className="text-sm">
						© {new Date().getFullYear()} OpnShelf. Built on AT Protocol.
					</p>
				</div>
			</div>
		</footer>
	);
}
