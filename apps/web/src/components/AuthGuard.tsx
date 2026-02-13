import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { UnauthenticatedState } from "./UnauthenticatedState";

interface AuthGuardProps {
	children: React.ReactNode;
	loadingComponent?: React.ReactNode;
	unauthenticatedComponent?: React.ReactNode;
}

export function AuthGuard({
	children,
	loadingComponent,
	unauthenticatedComponent,
}: AuthGuardProps) {
	const { data: user, isLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	if (isLoading) {
		return (
			loadingComponent || (
				<div className="min-h-screen bg-gray-950 text-gray-50">
					<div className="container mx-auto px-4 py-4 max-w-7xl">
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
							{Array.from({ length: 10 }, (_, i) => i).map((index) => (
								<Skeleton
									key={`loading-${index}`}
									className="aspect-2/3 rounded-lg"
								/>
							))}
						</div>
					</div>
				</div>
			)
		);
	}

	if (!user) {
		return (
			unauthenticatedComponent || (
				<UnauthenticatedState
					title="My Shelf"
					description="Sign in to track movies you've watched"
				/>
			)
		);
	}

	return <>{children}</>;
}
