import { ApiProperty } from "@nestjs/swagger";

export class ActorSuggestionDto {
	@ApiProperty({ description: "The actor's DID" })
	did: string;

	@ApiProperty({ description: "The actor's handle" })
	handle: string;

	@ApiProperty({
		description: "The actor's display name, if set",
		nullable: true,
		type: String,
	})
	displayName: string | null;

	@ApiProperty({
		description: "URL of the actor's avatar, if set",
		nullable: true,
		type: String,
	})
	avatar: string | null;
}
