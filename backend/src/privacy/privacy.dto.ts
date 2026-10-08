import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	Matches,
} from "class-validator";
import {
	PRIVACY_CATEGORIES,
	type PrivacyCategory,
	type PrivacyVisibility,
} from "./privacy-category";

export class PrivacyChangeDto {
	@ApiProperty({ enum: PRIVACY_CATEGORIES })
	@IsIn(PRIVACY_CATEGORIES)
	category!: PrivacyCategory;
	@ApiProperty({ enum: ["public", "private"] })
	@IsIn(["public", "private"])
	visibility!: PrivacyVisibility;
	@ApiProperty({ required: false })
	@IsOptional()
	@IsString()
	@Matches(/^[a-zA-Z0-9._~:-]{1,512}$/)
	listRkey?: string;
	@ApiProperty({ required: false })
	@IsOptional()
	@IsBoolean()
	publicationConfirmed?: boolean;
}
export class PrivacyDefaultDto {
	@ApiProperty({ enum: ["public", "private"] })
	@IsIn(["public", "private"])
	visibility!: PrivacyVisibility;
}
export class PrivacyMigrationDto {
	@ApiProperty() id!: string;
	@ApiProperty({ enum: ["public", "private"] }) target!: PrivacyVisibility;
	@ApiProperty() status!: string;
	@ApiProperty() copied!: number;
	@ApiProperty({
		type: Number,
		nullable: true,
		description:
			"Distinct records in this migration; null until counted or when unavailable.",
	})
	total!: number | null;
	@ApiProperty({ type: String, nullable: true }) error!: string | null;
}
export class PrivacyScopeDto {
	@ApiProperty({ enum: PRIVACY_CATEGORIES }) category!: PrivacyCategory;
	@ApiProperty({ type: String, nullable: true }) listRkey!: string | null;
	@ApiProperty() label!: string;
	@ApiProperty({ enum: ["public", "private"] }) visibility!: PrivacyVisibility;
	@ApiProperty({ type: PrivacyMigrationDto, nullable: true })
	migration!: PrivacyMigrationDto | null;
}
export class PrivacyStatusDto {
	@ApiProperty({ enum: ["available", "unsupported", "unavailable"] })
	availability!: "available" | "unsupported" | "unavailable";
	@ApiProperty() authorized!: boolean;
	@ApiProperty({ enum: ["public", "private"] })
	listsDefaultVisibility!: PrivacyVisibility;
	@ApiProperty({ type: [PrivacyScopeDto] }) scopes!: PrivacyScopeDto[];
	@ApiProperty() alphaDetails!: string;
}
