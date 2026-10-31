import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class CertificateIdDto {
  // PostgreSQL UUIDs include the demo IDs without RFC version/variant bits.
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  id!: string;
}
export class RevokeCertificateDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 1000)
  reason!: string;
}
