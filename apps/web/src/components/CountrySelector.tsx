import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "#/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { SORTED_COUNTRIES } from "#/lib/countries";
import { cn } from "#/lib/utils";

interface CountrySelectorProps {
	value?: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}

export default function CountrySelector({
	value,
	onChange,
	disabled,
}: CountrySelectorProps) {
	const [open, setOpen] = useState(false);

	const selectedName = SORTED_COUNTRIES.find(([code]) => code === value)?.[1];

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					aria-expanded={open}
					aria-label="Select country"
					className={cn(
						"input flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left font-normal text-sm shadow-none transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
						!value && "text-muted-foreground",
					)}
				>
					<span className="truncate">
						{selectedName ?? value ?? "Select country"}
					</span>
					<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-[280px] p-0" align="start">
				<Command>
					<CommandInput placeholder="Search country…" />
					<CommandList>
						<CommandEmpty>No country found.</CommandEmpty>
						{SORTED_COUNTRIES.map(([code, name]) => (
							<CommandItem
								key={code}
								value={name}
								onSelect={() => {
									onChange(code);
									setOpen(false);
								}}
							>
								<span>{name}</span>
								<Check
									className={cn(
										"ml-auto",
										value === code ? "opacity-100" : "opacity-0",
									)}
								/>
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
