import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @ApiPropertyOptional({
    description: 'Obrigatório quando quem cria é staff (ADMIN/MANAGER/ATTENDANT); ignorado quando é o próprio cliente.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiProperty({ description: 'Recurso escolhido (elevador, box, mecânico) para o horário' })
  @IsUUID()
  resourceId: string;

  @ApiProperty({ example: '2026-09-15T09:00:00-03:00' })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
