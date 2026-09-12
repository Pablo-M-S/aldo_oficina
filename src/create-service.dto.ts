import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreateServiceDto {
  @ApiProperty({ example: 'Troca de óleo' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Troca de óleo e filtro' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ example: 30, description: 'Duração estimada em minutos' })
  @IsInt()
  @IsPositive()
  durationMinutes: number;

  @ApiPropertyOptional({ enum: ResourceType, example: ResourceType.LIFT })
  @IsOptional()
  @IsEnum(ResourceType)
  requiredResourceType?: ResourceType;
}
