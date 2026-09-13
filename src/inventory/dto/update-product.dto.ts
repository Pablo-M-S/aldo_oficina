import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

// quantity é somente leitura aqui de propósito: a única forma de alterar
// estoque é via AdjustStockDto, que sempre gera um InventoryMovement
// rastreável. Editar quantity direto no produto apagaria o histórico.
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['quantity'] as const),
) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
