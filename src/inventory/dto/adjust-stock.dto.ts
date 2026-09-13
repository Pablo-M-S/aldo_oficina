import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ enum: InventoryMovementType, example: InventoryMovementType.ENTRY })
  @IsEnum(InventoryMovementType)
  type: InventoryMovementType;

  @ApiProperty({
    example: 20,
    description:
      'Para ENTRY/EXIT/WORK_ORDER_USAGE: magnitude do movimento (sinal definido pelo type). ' +
      'Para ADJUSTMENT: quantidade final absoluta em estoque após a correção (pode ser 0).',
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ example: 'Reposição do fornecedor X — NF 12345' })
  @IsOptional()
  @IsString()
  reason?: string;
}
