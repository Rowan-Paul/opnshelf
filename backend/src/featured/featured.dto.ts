import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDateString,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateIf,
} from "class-validator";
import { PageQueryDto, PaginationMetaDto } from "../common/pagination";

export class PublishFeaturedDto {
	@ApiPropertyOptional({ default: true })
	@ValidateIf((_, value) => value !== undefined)
	@IsBoolean()
	published?: boolean;

	@ApiProperty({ enum: ["movie", "show", "season"] })
	@IsIn(["movie", "show", "season"])
	mediaType: "movie" | "show" | "season";
	@ApiProperty()
	@IsInt()
	@Min(1)
	@Max(2147483647)
	mediaId: number;
	@ApiPropertyOptional({ type: Number, nullable: true })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(10000)
	seasonNumber?: number | null;
	@ApiProperty({ maxLength: 280 })
	@Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@MinLength(1)
	@MaxLength(280)
	message: string;
	@ApiPropertyOptional({ type: String, nullable: true })
	@IsOptional()
	@IsUrl({ protocols: ["https"], require_protocol: true, disallow_auth: true })
	@MaxLength(2048)
	sourceUrl?: string | null;
	@ApiPropertyOptional({
		enum: ["Watch trailer", "Read announcement"],
		nullable: true,
	})
	@IsOptional()
	@IsIn(["Watch trailer", "Read announcement"])
	sourceLabel?: "Watch trailer" | "Read announcement" | null;
	@ApiProperty({ format: "date-time" })
	@IsDateString({ strict: true })
	expiresAt: string;
}
export class FeaturedDto {
	@ApiProperty() id: string;
	@ApiProperty({ enum: ["movie", "show", "season"] }) mediaType:
		| "movie"
		| "show"
		| "season";
	@ApiProperty() mediaId: number;
	@ApiProperty({ type: Number, nullable: true }) seasonNumber: number | null;
	@ApiProperty() title: string;
	@ApiProperty({ type: String, nullable: true }) posterPath: string | null;
	@ApiProperty() message: string;
	@ApiProperty({ type: String, nullable: true }) sourceUrl: string | null;
	@ApiProperty({ type: String, nullable: true }) sourceLabel: string | null;
	@ApiProperty({ format: "date-time" }) expiresAt: string;
	@ApiProperty() active: boolean;
}
export class FeaturedSelectionDto {
	@ApiProperty({ type: [FeaturedDto] }) items: FeaturedDto[];
}
export class FeaturedPageDto extends PaginationMetaDto {
	@ApiProperty({ type: [FeaturedDto] }) items: FeaturedDto[];
}
export class FeaturedQueryDto extends PageQueryDto {
	@ApiPropertyOptional({ enum: ["active", "inactive"], default: "active" })
	@IsOptional()
	@IsIn(["active", "inactive"])
	status?: "active" | "inactive";
}
export class ReorderFeaturedDto {
	@ApiProperty({ type: [String], maxItems: 5 })
	@IsArray()
	@ArrayMaxSize(5)
	@ArrayUnique()
	@IsString({ each: true })
	ids: string[];
}
export class FeaturedAccessDto {
	@ApiProperty() canEdit: boolean;
}
