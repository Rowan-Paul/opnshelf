import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "#/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { cn } from "#/lib/utils";

function getTimeZones(): string[] {
	try {
		return Intl.supportedValuesOf("timeZone");
	} catch {
		return [
			"UTC",
			"America/New_York",
			"America/Chicago",
			"America/Denver",
			"America/Los_Angeles",
			"America/Anchorage",
			"America/Honolulu",
			"Europe/London",
			"Europe/Paris",
			"Europe/Berlin",
			"Europe/Moscow",
			"Asia/Tokyo",
			"Asia/Shanghai",
			"Asia/Dubai",
			"Asia/Kolkata",
			"Asia/Singapore",
			"Australia/Sydney",
			"Pacific/Auckland",
			"Pacific/Honolulu",
		];
	}
}

function getTimezoneOffsetLabel(tz: string): string {
	try {
		const now = new Date();
		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			timeZoneName: "shortOffset",
		});
		const parts = formatter.formatToParts(now);
		const offsetPart = parts.find((p) => p.type === "timeZoneName");
		return offsetPart?.value ?? "";
	} catch {
		return "";
	}
}

function getTimezoneOffsetMinutes(tz: string): number {
	try {
		const now = new Date();
		const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
		const tzDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
		return (tzDate.getTime() - utcDate.getTime()) / 60000;
	} catch {
		return 0;
	}
}

interface TimezoneGroup {
	label: string;
	zones: { value: string; label: string }[];
}

function buildTimezoneGroups(): TimezoneGroup[] {
	const zones = getTimeZones();
	const map = new Map<number, { value: string; label: string }[]>();

	for (const zone of zones) {
		const offsetMins = getTimezoneOffsetMinutes(zone);

		if (!map.has(offsetMins)) {
			map.set(offsetMins, []);
		}
		map.get(offsetMins)?.push({ value: zone, label: zone });
	}

	const sortedEntries = Array.from(map.entries()).sort((a, b) => b[0] - a[0]);

	return sortedEntries.map(([offsetMins, zoneList]) => {
		const sampleZone = zoneList[0].value;
		const offsetLabel = getTimezoneOffsetLabel(sampleZone);
		const hours = Math.floor(Math.abs(offsetMins) / 60);
		const mins = Math.abs(offsetMins) % 60;
		const sign = offsetMins >= 0 ? "+" : "-";
		const numeric = `UTC${sign}${hours}${mins > 0 ? `:${mins.toString().padStart(2, "0")}` : ""}`;
		return {
			label: `${offsetLabel || numeric} — ${numeric}`,
			zones: zoneList.sort((a, b) => a.label.localeCompare(b.label)),
		};
	});
}

interface TimezoneSelectorProps {
	value?: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}

export default function TimezoneSelector({
	value,
	onChange,
	disabled,
}: TimezoneSelectorProps) {
	const [open, setOpen] = useState(false);
	const groups = useMemo(() => buildTimezoneGroups(), []);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					aria-expanded={open}
					aria-label="Select timezone"
					className={cn(
						"input flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left font-normal text-sm shadow-none transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
						!value && "text-muted-foreground",
					)}
				>
					<span className="truncate">{value ?? "Select timezone"}</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-[320px] p-0" align="start">
				<Command>
					<CommandInput placeholder="Search timezone…" />
					<CommandList>
						<CommandEmpty>No timezone found.</CommandEmpty>
						{groups.map((group) => (
							<CommandGroup key={group.label} heading={group.label}>
								{group.zones.map((zone) => (
									<CommandItem
										key={zone.value}
										value={zone.value}
										onSelect={() => {
											onChange(zone.value);
											setOpen(false);
										}}
									>
										<span className="truncate">{zone.label}</span>
										<Check
											className={cn(
												"ml-auto h-4 w-4",
												value === zone.value ? "opacity-100" : "opacity-0",
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
