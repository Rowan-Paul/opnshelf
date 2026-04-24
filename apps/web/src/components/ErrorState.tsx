import { Link } from "@tanstack/react-router";

interface ErrorStateProps {
	message?: string;
	subMessage?: string;
	backTo?: string;
	backLabel?: string;
}

export default function ErrorState({
	message = "Failed to load",
	subMessage = "Please check your connection and try again.",
	backTo = "/",
	backLabel = "Back to Dashboard",
}: ErrorStateProps) {
	return (
		<div className="container-app py-8">
			<div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-800">
				<p className="font-medium text-lg">{message}</p>
				<p className="mt-2">{subMessage}</p>
				<Link to={backTo} className="btn btn-primary mt-4 inline-flex">
					{backLabel}
				</Link>
			</div>
		</div>
	);
}
