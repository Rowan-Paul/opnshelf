import { expect, it } from "vitest";
import { pdsRequestError } from "./pds-request-error";

it.each([429, 503])("finds status %s through OAuth error causes", (status) => {
	const error = new Error("unsafe details", {
		cause: {
			response: new Response(null, {
				status,
				headers: { "retry-after": "900" },
			}),
		},
	});
	expect(pdsRequestError(error)).toMatchObject({
		upstreamStatus: status,
		retrySeconds: 900,
	});
	expect(pdsRequestError(error)?.getStatus()).toBe(503);
});
it("ignores invalid credentials and cyclic causes", () => {
	expect(pdsRequestError({ status: 401 })).toBeUndefined();
	const error = new Error("cycle");
	error.cause = error;
	expect(pdsRequestError(error)).toBeUndefined();
});
