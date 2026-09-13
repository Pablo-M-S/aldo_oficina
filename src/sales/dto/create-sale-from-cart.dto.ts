import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { SaleItemInputDto } from './sale-item-input.dto';

export class CreateSaleFromCartDto {
  @ApiPropertyOptional({
    description: 'Obrigatório quando quem cria é staff; ignorado quando é o próprio cliente.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ type: [SaleItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items: SaleItemInputDto[];
}
