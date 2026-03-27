import { Link } from "@tanstack/react-router";
import { BookOpen, LogIn, Settings2 } from "lucide-react";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

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

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-16 max-w-4xl">
				<M3Card variant="filled" className="rounded-xl text-center">
					<M3CardHeader className="items-center px-6 pt-8">
						<Icon
							className="size-16 mb-4"
							style={{ color: "var(--md-sys-color-primary)" }}
						/>
						<M3CardTitle className="md-headline-medium">{title}</M3CardTitle>
						<M3CardDescription className="md-title-large">
							{description}
						</M3CardDescription>
					</M3CardHeader>
					<M3CardContent className="pb-8">
						<M3Button
							variant="filled"
							size="lg"
							asChild
							className="rounded-full"
						>
							<Link to="/login">
								<LogIn className="size-5" />
								Sign in
							</Link>
						</M3Button>
					</M3CardContent>
				</M3Card>
			</div>
		</div>
	);
}
