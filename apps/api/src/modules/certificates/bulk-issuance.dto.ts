import { IsString, Length, Matches } from 'class-validator';
export class BulkIssuanceDto {
  // Existing demo IDs are stored as PostgreSQL UUIDs without RFC version/variant bits.
  @IsString()
  @Length(36, 36)
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  courseId!: string;
}
