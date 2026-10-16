import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	Param,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { FeaturedAdminGuard } from "./featured-admin.guard";
import {
	FeaturedAccessDto,
	FeaturedDto,
	FeaturedPageDto,
	FeaturedQueryDto,
	FeaturedSelectionDto,
	PublishFeaturedDto,
	ReorderFeaturedDto,
} from "./featured.dto";
import { FeaturedService } from "./featured.service";

@ApiTags("featured")
@Controller("featured")
export class FeaturedController {
	constructor(
		private readonly featured: FeaturedService,
		private readonly admin: FeaturedAdminGuard,
	) {}
	@Get()
	@Header("Cache-Control", "no-store")
	@ApiResponse({ status: 200, type: FeaturedSelectionDto })
	selection() {
		return this.featured.selection();
	}
	@Get("access")
	@UseGuards(AuthGuard)
	@Header("Cache-Control", "private, no-store")
	@ApiResponse({ status: 200, type: FeaturedAccessDto })
	access(@Req() req: AuthenticatedRequest) {
		return { canEdit: this.admin.canEdit(req.user.did) };
	}
	@Get("manage")
	@UseGuards(AuthGuard, FeaturedAdminGuard)
	@Header("Cache-Control", "private, no-store")
	@ApiResponse({ status: 200, type: FeaturedPageDto })
	list(@Query() query: FeaturedQueryDto) {
		return this.featured.list(query);
	}
	@Post("manage")
	@UseGuards(AuthGuard, FeaturedAdminGuard)
	@ApiResponse({ status: 201, type: FeaturedDto })
	publish(@Body() body: PublishFeaturedDto) {
		return this.featured.publish(body);
	}
	@Put("manage/order")
	@UseGuards(AuthGuard, FeaturedAdminGuard)
	@HttpCode(204)
	@ApiResponse({ status: 204 })
	reorder(@Body() body: ReorderFeaturedDto) {
		return this.featured.reorder(body.ids);
	}
	@Put("manage/:id")
	@UseGuards(AuthGuard, FeaturedAdminGuard)
	@ApiResponse({ status: 200, type: FeaturedDto })
	update(@Param("id") id: string, @Body() body: PublishFeaturedDto) {
		return this.featured.publish(body, id);
	}
	@Delete("manage/:id")
	@UseGuards(AuthGuard, FeaturedAdminGuard)
	@HttpCode(204)
	@ApiResponse({ status: 204 })
	remove(@Param("id") id: string) {
		return this.featured.remove(id);
	}
}
