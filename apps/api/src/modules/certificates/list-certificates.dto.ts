import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { certificateSortFields, type CertificateSortField } from '@training/shared';

// Only canonical positive integers are accepted, rather than JS numeric coercions.
const integer = ({ value }: { value: unknown }) => typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
export class ListCertificatesDto {
  @Transform(integer)
  @IsInt() @Min(1) @Max(1000000)
  page = 1;

  @Transform(integer)
  @IsInt() @Min(1) @Max(100)
  pageSize = 20;

  @IsString() @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  search = '';

  @IsIn(certificateSortFields)
  sortBy: CertificateSortField = 'issuedAt';

  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}
