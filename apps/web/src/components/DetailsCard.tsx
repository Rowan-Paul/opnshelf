interface DetailItem {
	label: string;
	value: React.ReactNode;
}

interface DetailsCardProps {
	title?: string;
	items: DetailItem[];
}

export default function DetailsCard({
	title = "Details",
	items,
}: DetailsCardProps) {
	return (
		<section className="card p-5">
			<h3 className="font-display font-semibold mb-4">{title}</h3>
			<div className="space-y-3 text-sm">
				{items.map((item) => (
					<div key={item.label} className="flex justify-between">
						<span className="text-[var(--foreground-muted)]">{item.label}</span>
						<span className="font-medium text-right">{item.value}</span>
					</div>
				))}
			</div>
		</section>
	);
}
