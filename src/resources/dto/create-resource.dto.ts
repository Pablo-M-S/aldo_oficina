import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreateResourceDto {
  @ApiProperty({ example: 'Elevador 1' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: ResourceType, example: ResourceType.LIFT })
  @IsEnum(ResourceType)
  type: ResourceType;
}
