import {
	listsControllerCreateListMutation,
	listsControllerGetUserListsQueryKey,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateListDialog() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const queryClient = useQueryClient();
	const id = useId();

	const createListMutation = useMutation({
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
				<Button className="gap-2">
					<ListPlus className="size-4" />
					Create List
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New List</DialogTitle>
					<DialogDescription>
						Create a custom list to organize your movies.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={`${id}-name`}>Name</Label>
						<Input
							id={`${id}-name`}
							placeholder="My Awesome List"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							maxLength={100}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${id}-description`}>Description (optional)</Label>
						<Textarea
							id={`${id}-description`}
							placeholder="What's this list about?"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={500}
							rows={3}
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!name.trim() || createListMutation.isPending}
						>
							{createListMutation.isPending ? "Creating..." : "Create"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
