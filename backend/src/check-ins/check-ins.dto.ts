import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

export class StartCheckInDto {
	@ApiProperty()
	@Matches(/^\d+$/)
	mediaId!: string;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Min(0)
	seasonNumber?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsInt()
	@Min(1)
	episodeNumber?: number;

	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	replaceId?: string;
}

export class WatchingCheckInDto {
	@ApiProperty() rkey!: string;
	@ApiProperty() userDid!: string;
	@ApiProperty() handle!: string;
	@ApiProperty() mediaId!: string;
	@ApiProperty() title!: string;
	@ApiProperty({ type: Number, nullable: true }) seasonNumber!: number | null;
	@ApiProperty({ type: Number, nullable: true }) episodeNumber!: number | null;
	@ApiProperty() startedAt!: Date;
	@ApiProperty({ type: Date, nullable: true }) endsAt!: Date | null;
	@ApiProperty() finishing!: boolean;
}

export class CheckInsDto {
	@ApiProperty({ type: [WatchingCheckInDto] })
	items!: WatchingCheckInDto[];
}
