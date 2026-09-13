import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWorkOrderDto {
  @ApiPropertyOptional({
    description: 'Obrigatório quando quem cria é staff; ignorado quando é o próprio cliente.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  vehicleId: string;

  @ApiPropertyOptional({ description: 'Vincula a OS a um agendamento existente' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mechanicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
