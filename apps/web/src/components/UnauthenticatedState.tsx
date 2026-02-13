import { Link } from "@tanstack/react-router";
import { BookOpen, LogIn, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface UnauthenticatedStateProps {
	title: string;
	description: string;
	icon?: "shelf" | "settings";
}

export function UnauthenticatedState({
	title,
	description,
	icon = "shelf",
}: UnauthenticatedStateProps) {
	const Icon = icon === "settings" ? Settings2 : BookOpen;
	const iconColor = icon === "settings" ? "text-amber-500" : "text-purple-500";

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-16 max-w-4xl">
				<Card className="bg-gray-900 border-gray-800 text-center">
					<CardHeader>
						<Icon className={`w-16 h-16 ${iconColor} mx-auto mb-4`} />
						<CardTitle className="text-3xl">{title}</CardTitle>
						<CardDescription className="text-xl">{description}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild size="lg">
							<Link to="/login">
								<LogIn className="w-5 h-5 mr-2" />
								Sign in
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
