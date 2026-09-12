import { PrismaClient, ResourceType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('TrocarEssaSenha123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@nxl-oficina.com' },
    update: {},
    create: {
      name: 'Administrador NXL',
      email: 'admin@nxl-oficina.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const resources = [
    { name: 'Elevador 1', type: ResourceType.LIFT },
    { name: 'Elevador 2', type: ResourceType.LIFT },
    { name: 'Box de Alinhamento', type: ResourceType.BAY },
  ];

  // Resource.id é UUID gerado, então upsert por id não se aplica aqui —
  // idempotência é garantida checando por nome antes de criar.
  for (const resource of resources) {
    const exists = await prisma.resource.findFirst({ where: { name: resource.name } });
    if (!exists) {
      await prisma.resource.create({ data: resource });
    }
  }

  console.log('Seed concluído: admin@nxl-oficina.com / TrocarEssaSenha123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
