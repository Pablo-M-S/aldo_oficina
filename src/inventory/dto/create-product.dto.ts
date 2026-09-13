import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'OL-5W30-1L' })
  @IsString()
  @MinLength(2)
  sku: string;

  @ApiProperty({ example: 'Óleo sintético 5W30 1L' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Óleo sintético para motores flex' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 28.9 })
  @IsNumber()
  @IsPositive()
  cost: number;

  @ApiProperty({ example: 45.0 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ example: 50, description: 'Quantidade inicial em estoque' })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 10, description: 'Estoque mínimo antes de gerar alerta' })
  @IsInt()
  @Min(0)
  minimumStock: number;
}
