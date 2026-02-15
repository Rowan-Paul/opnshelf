import type { VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadingButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	isLoading?: boolean;
}

function LoadingButton({
	isLoading = false,
	children,
	disabled,
	className,
	variant,
	size,
	...props
}: LoadingButtonProps) {
	return (
		<Button
			disabled={disabled || isLoading}
			className={cn(buttonVariants({ variant, size, className }))}
			variant={variant}
			size={size}
			{...props}
		>
			{isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
			{isLoading ? "Loading" : children}
		</Button>
	);
}

export { LoadingButton,  };
