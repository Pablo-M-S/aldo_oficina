import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class SaleItemInputDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({
    description: 'Somente para staff — sobrescreve o preço do catálogo (ex.: desconto pontual).',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  unitPriceOverride?: number;
}
