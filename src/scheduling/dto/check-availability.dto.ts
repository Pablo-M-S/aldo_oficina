import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CheckAvailabilityDto {
  @ApiPropertyOptional({
    description: 'Omitido: agrega a disponibilidade de todos os recursos compatíveis com o serviço.',
  })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiProperty({ example: '2026-09-15' })
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsUUID()
  serviceId: string;
}
