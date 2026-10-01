import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Matches,
	Max,
	MaxLength,
	Min,
} from "class-validator";
import { WatchProviderDto } from "../movies/dto/movie.dto";

export class WatchPickerQueryDto {
	@ApiProperty({ minimum: 1, maximum: 1440 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(1440)
	minutes: number;
	@ApiPropertyOptional({ enum: ["both", "movie", "show"] })
	@IsOptional()
	@IsIn(["both", "movie", "show"])
	type?: "both" | "movie" | "show";
	@ApiPropertyOptional({ enum: ["both", "start", "continue"] })
	@IsOptional()
	@IsIn(["both", "start", "continue"])
	progress?: "both" | "start" | "continue";
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(100)
	genre?: string;
	@ApiPropertyOptional({
		description: "Comma-separated service IDs; omitted means unrestricted",
	})
	@IsOptional()
	@Matches(/^[1-9][0-9]{0,8}(,[1-9][0-9]{0,8}){0,49}$/)
	services?: string;
}
export class PickerEpisodeDto {
	@ApiProperty({ type: [Number] }) serviceIds: number[];
	@ApiProperty() seasonNumber: number;
	@ApiProperty() episodeNumber: number;
	@ApiProperty() name: string;
}
export class WatchPickerItemDto {
	@ApiProperty() id: string;
	@ApiProperty({ enum: ["movie", "show"] }) mediaType: "movie" | "show";
	@ApiProperty() mediaId: string;
	@ApiProperty() title: string;
	@ApiPropertyOptional() posterPath?: string;
	@ApiProperty() minutes: number;
	@ApiProperty() estimated: boolean;
	@ApiProperty({ type: [PickerEpisodeDto] }) episodes: PickerEpisodeDto[];
	@ApiProperty({ type: [WatchProviderDto] }) services: WatchProviderDto[];
	@ApiPropertyOptional() watchLink?: string;
}
export class WatchPickerResponseDto {
	@ApiProperty({ type: [WatchPickerItemDto] }) items: WatchPickerItemDto[];
	@ApiProperty({ type: [String] }) genres: string[];
}
