import {
	listsControllerCreateListMutation,
	listsControllerGetUserListsQueryKey,
} from "@opnshelf/api";
import { usePostHog } from "@posthog/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
import { useId, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { M3Button } from "@/components/ui/m3-button";
import { M3TextField } from "@/components/ui/m3-text-field";

export function CreateListDialog() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
	const queryClient = useQueryClient();
	const id = useId();
	const { seedColor } = useTheme();
	const posthog = usePostHog();

	const createListMutation = useMutation({
		mutationKey: ["lists", "create"],
		...listsControllerCreateListMutation(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			posthog.capture("list_created", {
				list_name: name.trim(),
				has_description: !!description.trim(),
				list_id: (data as { id?: string })?.id,
			});
			setOpen(false);
			setName("");
			setDescription("");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		createListMutation.mutate({
			body: {
				name: name.trim(),
				description: description.trim() || undefined,
			},
		});
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<M3Button variant="filled" className="gap-2 ml-auto">
					<ListPlus className="size-4" />
					Create List
				</M3Button>
			</DialogTrigger>
			<DialogContent
				style={{
					backgroundColor: "var(--md-sys-color-surface-container)",
					borderColor: "var(--md-sys-color-outline)",
					color: "var(--md-sys-color-on-surface)",
				}}
			>
				<DialogHeader>
					<DialogTitle
						className="md-headline-small"
						style={{ color: "var(--md-sys-color-on-surface)" }}
					>
						Create New List
					</DialogTitle>
					<DialogDescription
						className="md-body-medium"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Create a custom list to organize your movies.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<M3TextField
							id={`${id}-name`}
							label="Name"
							placeholder="My Awesome List"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							maxLength={100}
							variant="outlined"
						/>
					</div>
					<div className="space-y-2">
						<div
							className="relative rounded-[var(--md-sys-shape-corner-extra-small)] border bg-transparent transition-all duration-200"
							style={{
								borderColor: isDescriptionFocused
									? "var(--md-sys-color-primary)"
									: "var(--md-sys-color-outline)",
								borderWidth: isDescriptionFocused ? 2 : 1,
							}}
						>
							<label
								htmlFor={`${id}-description`}
								className="absolute left-4 top-0 -translate-y-1/2 px-1 md-label-small pointer-events-none"
								style={{
									backgroundColor: "var(--md-sys-color-surface)",
									color: isDescriptionFocused
										? "var(--md-sys-color-primary)"
										: "var(--md-sys-color-on-surface-variant)",
								}}
							>
								Description (optional)
							</label>
							<textarea
								id={`${id}-description`}
								placeholder="What's this list about?"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								onFocus={() => setIsDescriptionFocused(true)}
								onBlur={() => setIsDescriptionFocused(false)}
								maxLength={500}
								rows={3}
								className="w-full resize-none bg-transparent py-4 px-4 text-[var(--md-sys-color-on-surface)] placeholder:text-[var(--md-sys-color-on-surface-variant)] outline-none md-body-large"
							/>
						</div>
					</div>
					<div className="flex justify-end gap-2">
						<M3Button
							type="button"
							variant="outlined"
							onClick={() => setOpen(false)}
						>
							Cancel
						</M3Button>
						<M3Button
							type="submit"
							variant="filled"
							disabled={!name.trim() || createListMutation.isPending}
							style={{
								backgroundColor: seedColor,
								color: "var(--md-sys-color-on-primary)",
							}}
						>
							{createListMutation.isPending ? "Creating..." : "Create"}
						</M3Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
