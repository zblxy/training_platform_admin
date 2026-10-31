import { IsUUID } from 'class-validator';
export class BulkIssuanceDto {
  @IsUUID()
  courseId!: string;
}
