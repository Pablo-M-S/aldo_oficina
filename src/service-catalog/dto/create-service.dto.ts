import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
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

  @ApiPropertyOptional({
    example: false,
    description: 'Se true, o preço acima é só referência — valor final depende de avaliação presencial.',
  })
  @IsOptional()
  @IsBoolean()
  priceIsEstimate?: boolean;

  @ApiPropertyOptional({ example: 'format-paint', description: 'Nome do ícone (MaterialCommunityIcons) exibido no app.' })
  @IsOptional()
  @IsString()
  iconKey?: string;

  @ApiProperty({ example: 30, description: 'Duração estimada em minutos' })
  @IsInt()
  @IsPositive()
  durationMinutes: number;

  @ApiPropertyOptional({ enum: ResourceType, example: ResourceType.LIFT })
  @IsOptional()
  @IsEnum(ResourceType)
  requiredResourceType?: ResourceType;
}
