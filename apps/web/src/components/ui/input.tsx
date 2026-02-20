import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"placeholder:text-gray-500 selection:bg-amber-500 selection:text-white h-9 w-full min-w-0 rounded-md border border-gray-700 bg-gray-900 px-3 py-1 text-base text-gray-50 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-amber-500 focus-visible:ring-amber-500/50 focus-visible:ring-2",
				"aria-invalid:ring-red-500/20 aria-invalid:border-red-500",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
