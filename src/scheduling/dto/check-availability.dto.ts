import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CheckAvailabilityDto {
  @ApiProperty()
  @IsUUID()
  resourceId: string;

  @ApiProperty({ example: '2026-09-15' })
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsUUID()
  serviceId: string;
}
