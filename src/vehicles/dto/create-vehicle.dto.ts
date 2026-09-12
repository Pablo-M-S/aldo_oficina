import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: 'Chevrolet' })
  @IsString()
  @MinLength(2)
  brand: string;

  @ApiProperty({ example: 'Onix' })
  @IsString()
  @MinLength(1)
  model: string;

  @ApiProperty({ example: 2022 })
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiProperty({ example: 'ABC1D23', description: 'Placa no padrão Mercosul ou antigo' })
  @IsString()
  @Matches(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, {
    message: 'Placa inválida. Use o formato ABC1D23 ou ABC1234.',
  })
  plate: string;

  @ApiProperty({ example: 45000 })
  @IsInt()
  @IsPositive()
  mileage: number;
}
