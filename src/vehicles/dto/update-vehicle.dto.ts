import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVehicleDto } from './create-vehicle.dto';

// A placa não é atualizável por este endpoint — troca de placa é uma
// operação sensível (transferência de veículo) tratada separadamente.
export class UpdateVehicleDto extends PartialType(
  OmitType(CreateVehicleDto, ['plate'] as const),
) {}
