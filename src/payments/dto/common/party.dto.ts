import { IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class PartyDto {
  @ValidateIf((o: PartyDto) => !o.externalId)
  @IsString()
  @IsNotEmpty()
  id?: string;

  @ValidateIf((o: PartyDto) => !o.id)
  @IsString()
  @IsNotEmpty()
  externalId?: string;
}
