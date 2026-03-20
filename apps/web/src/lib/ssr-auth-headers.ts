type ApiRequestHeaders = {
	headers?: {
		Cookie: string;
	};
};

type StartServerModule = {
	getRequestHeader(name: string): string | undefined;
};

export function buildSsrAuthHeaders(
	cookieHeader: string | null | undefined,
): ApiRequestHeaders {
	if (!cookieHeader) {
		return {};
	}

	return {
		headers: {
			Cookie: cookieHeader,
		},
	};
}

export async function getSsrAuthHeaders(): Promise<ApiRequestHeaders> {
	if (!import.meta.env.SSR) {
		return {};
	}

	const startServerModuleName = "@tanstack/react-start/server";
	const { getRequestHeader } = (await import(
		/* @vite-ignore */ startServerModuleName
	)) as StartServerModule;

	return buildSsrAuthHeaders(getRequestHeader("cookie"));
}
