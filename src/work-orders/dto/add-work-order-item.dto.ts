import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsUUID, ValidateIf } from 'class-validator';

export class AddWorkOrderItemDto {
  @ApiPropertyOptional({ description: 'Informe serviceId OU productId, nunca os dois.' })
  @ValidateIf((dto: AddWorkOrderItemDto) => !dto.productId)
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: AddWorkOrderItemDto) => !dto.serviceId)
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Sobrescreve o preço do catálogo, se necessário (ex.: desconto pontual)',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  unitPriceOverride?: number;
}
