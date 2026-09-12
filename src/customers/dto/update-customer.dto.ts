import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: '+55 41 99999-0000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '000.000.000-00' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiPropertyOptional({ example: 'Rua das Flores, 123 - Curitiba/PR' })
  @IsOptional()
  @IsString()
  address?: string;
}
