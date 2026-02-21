import {
	listsControllerCreateListMutation,
	listsControllerGetUserListsQueryKey,
} from "@opnshelf/api";
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
import { Label } from "@/components/ui/label";
import { M3Button } from "@/components/ui/m3-button";
import { M3TextField } from "@/components/ui/m3-text-field";
import { Textarea } from "@/components/ui/textarea";

export function CreateListDialog() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const queryClient = useQueryClient();
	const id = useId();
	const { seedColor } = useTheme();

	const createListMutation = useMutation({
		mutationKey: ["lists", "create"],
		...listsControllerCreateListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
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
						<Label
							htmlFor={`${id}-name`}
							className="md-label-large"
							style={{ color: "var(--md-sys-color-on-surface)" }}
						>
							Name
						</Label>
						<M3TextField
							id={`${id}-name`}
							placeholder="My Awesome List"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							maxLength={100}
							variant="outlined"
						/>
					</div>
					<div className="space-y-2">
						<Label
							htmlFor={`${id}-description`}
							className="md-label-large"
							style={{ color: "var(--md-sys-color-on-surface)" }}
						>
							Description (optional)
						</Label>
						<Textarea
							id={`${id}-description`}
							placeholder="What's this list about?"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={500}
							rows={3}
							className="bg-(--md-sys-color-surface-container-highest) border-(--md-sys-color-outline) text-(--md-sys-color-on-surface) placeholder:text-(--md-sys-color-on-surface-variant)"
						/>
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
