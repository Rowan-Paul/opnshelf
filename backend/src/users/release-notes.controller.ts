import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Patch,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";
import {
	MarkReleaseNotesReadDto,
	ReleaseNotesReadStateDto,
} from "./dto/release-notes.dto";

@ApiTags("users")
@Controller("users/me/release-notes")
@UseGuards(AuthGuard)
export class ReleaseNotesController {
	constructor(private readonly prisma: PrismaService) {}

	@Get()
	@ApiOperation({ summary: "Get account-wide Release Notes read state" })
	@ApiResponse({ status: 200, type: ReleaseNotesReadStateDto })
	async getReadState(
		@Req() req: AuthenticatedRequest,
	): Promise<ReleaseNotesReadStateDto> {
		const user = await this.prisma.user.findUniqueOrThrow({
			where: { did: req.user.did },
			select: { createdAt: true, releaseNotesReadAt: true },
		});
		return {
			readThrough: new Date(
				Math.max(
					user.createdAt.getTime(),
					user.releaseNotesReadAt?.getTime() ?? 0,
				),
			).toISOString(),
		};
	}

	@Patch()
	@ApiOperation({
		summary: "Advance Release Notes read state after displaying the history",
	})
	@ApiResponse({ status: 200, type: ReleaseNotesReadStateDto })
	async markRead(
		@Req() req: AuthenticatedRequest,
		@Body() body: MarkReleaseNotesReadDto,
	): Promise<ReleaseNotesReadStateDto> {
		const readThrough = new Date(body.readThrough);
		if (
			!Number.isFinite(readThrough.getTime()) ||
			readThrough.getTime() > Date.now()
		) {
			throw new BadRequestException("Read timestamp must not be in the future");
		}
		// Atomic compare-and-set: an older tab or device must never move state backwards.
		await this.prisma.user.updateMany({
			where: {
				did: req.user.did,
				OR: [
					{ releaseNotesReadAt: null },
					{ releaseNotesReadAt: { lt: readThrough } },
				],
			},
			data: { releaseNotesReadAt: readThrough },
		});
		return this.getReadState(req);
	}
}
