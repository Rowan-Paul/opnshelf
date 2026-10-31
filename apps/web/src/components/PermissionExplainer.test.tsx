import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePermissionExplainer } from "./PermissionExplainer";

const AUTHORIZATION_URL =
	"https://bsky.social/oauth/authorize?request_uri=urn%3Aexample";

function Harness({
	start,
	onResult,
}: {
	start: () => Promise<string>;
	onResult: (result: string | null | Error) => void;
}) {
	const explainer = usePermissionExplainer();
	return (
		<>
			<button
				type="button"
				onClick={() =>
					explainer
						.request({ integration: "bluesky", action: "connect", start })
						.then(onResult, onResult)
				}
			>
				Connect
			</button>
			{explainer.dialog}
		</>
	);
}

describe("usePermissionExplainer", () => {
	it("explains the change and names the Account Host before leaving", async () => {
		const onResult = vi.fn();
		let finish!: (url: string) => void;
		const start = () =>
			new Promise<string>((resolve) => {
				finish = resolve;
			});
		render(<Harness start={start} onResult={onResult} />);

		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
		// Nothing opens until the authorization request exists.
		expect(screen.queryByRole("dialog")).toBeNull();

		await act(async () => finish(AUTHORIZATION_URL));

		const dialog = screen.getByRole("dialog");
		expect(dialog.textContent).toContain("Let Opnshelf post to Bluesky");
		expect(dialog.textContent).toContain("bsky.social hosts your account");
		expect(dialog.textContent).toContain("Delete your Bluesky posts");
		expect(dialog.textContent).toContain(
			"Your other Devices will need to sign in again",
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Continue to bsky.social" }),
		);
		await act(async () => {});
		expect(onResult).toHaveBeenCalledWith(AUTHORIZATION_URL);
	});

	it("leaves nothing to open when the User backs out", async () => {
		const onResult = vi.fn();
		render(
			<Harness
				start={() => Promise.resolve(AUTHORIZATION_URL)}
				onResult={onResult}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
		await act(async () => {});
		fireEvent.click(screen.getByRole("button", { name: "Not now" }));
		await act(async () => {});

		expect(onResult).toHaveBeenCalledWith(null);
	});

	it("opens nothing and reports when the request can't be made", async () => {
		const onResult = vi.fn();
		const failure = new Error("A public Bluesky profile is required");
		render(
			<Harness start={() => Promise.reject(failure)} onResult={onResult} />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
		await act(async () => {});

		expect(onResult).toHaveBeenCalledWith(failure);
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
