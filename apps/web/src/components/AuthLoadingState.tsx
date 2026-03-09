import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthLoadingStateProps {
	className?: string;
}

export function AuthLoadingState({ className }: AuthLoadingStateProps) {
	return (
		<div
			className={cn(
				"mx-auto flex min-h-[40vh] w-full items-center justify-center px-4 py-10",
				className,
			)}
		>
			<output
				aria-live="polite"
				className="flex items-center justify-center"
				style={{ color: "var(--md-sys-color-primary)" }}
			>
				<Loader2 className="h-8 w-8 animate-spin" />
				<span className="sr-only">Checking account status</span>
			</output>
		</div>
	);
}
