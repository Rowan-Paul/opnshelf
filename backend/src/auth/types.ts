import type { Request } from "express";

export interface AuthUser {
	did: string;
	session: unknown;
}

export interface AuthenticatedRequest extends Request {
	user: AuthUser;
}
