import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"placeholder:text-gray-500 selection:bg-purple-500 selection:text-white min-h-[60px] w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-base text-gray-50 shadow-xs transition-[color,box-shadow] outline-none resize-none md:text-sm",
				"focus-visible:border-purple-500 focus-visible:ring-purple-500/50 focus-visible:ring-2",
				"aria-invalid:ring-red-500/20 aria-invalid:border-red-500",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
