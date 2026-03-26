// @vitest-environment jsdom

import type { TraktImportStatusJob } from "@opnshelf/api";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TraktImportStatusToast } from "./TraktImportStatusToast";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();

	return {
		...actual,
		useQuery: (...args: unknown[]) => mockUseQuery(...args),
	};
});

vi.mock("@/lib/trakt-import-dismissal", () => ({
	dismissTraktImportJob: vi.fn(() => []),
	loadDismissedTraktImportJobIds: vi.fn(() => []),
}));

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function buildJob(
	overrides: Partial<
		TraktImportStatusJob & { id: string; traktUsername: string }
	> = {},
) {
	return {
		id: "job-1",
		traktUsername: "alice",
		status: "completed",
		currentPage: 1,
		totalPages: 2,
		importedCount: 199,
		skippedCount: 0,
		failedCount: 0,
		lastError: undefined,
		...overrides,
	};
}

describe("TraktImportStatusToast", () => {
	let container: HTMLDivElement | null = null;
	let root: Root | null = null;

	afterEach(() => {
		vi.clearAllMocks();

		if (root) {
			act(() => {
				root?.unmount();
			});
		}

		container?.remove();
		container = null;
		root = null;
		document.body.innerHTML = "";
	});

	function renderToast(job: ReturnType<typeof buildJob> | null) {
		mockUseQuery.mockReturnValue({ data: job });

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<TraktImportStatusToast enabled userDid="did:plc:test" />);
		});
	}

	it("hides cached job data when the toast is disabled", () => {
		renderToast(buildJob());

		act(() => {
			root?.render(
				<TraktImportStatusToast enabled={false} userDid={undefined} />,
			);
		});

		expect(document.body.textContent).not.toContain("Trakt import");
	});

	it("shows the finished copy for completed jobs", () => {
		renderToast(buildJob({ status: "completed", importedCount: 199 }));

		expect(document.body.textContent).toContain("Trakt import");
		expect(document.body.textContent).toContain(
			"Finished. Imported 199, skipped 0, failed 0.",
		);
		expect(document.body.textContent).not.toContain("Import failed");
	});

	it("shows the failure copy only for failed jobs", () => {
		renderToast(
			buildJob({
				status: "failed",
				lastError: "Trakt import failed. Please retry later or use CSV import.",
			}),
		);

		expect(document.body.textContent).toContain(
			"Trakt import failed. Please retry later or use CSV import.",
		);
	});

	it("suppresses the toast for unknown statuses", () => {
		renderToast(
			buildJob({
				status: "mystery_status",
				lastError: "This should not be shown.",
			}),
		);

		expect(document.body.textContent).not.toContain("Trakt import");
		expect(document.body.textContent).not.toContain(
			"This should not be shown.",
		);
	});
});
