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
    { name: 'Box de Funilaria 1', type: ResourceType.BAY },
    { name: 'Box de Funilaria 2', type: ResourceType.BAY },
    { name: 'Cabine de Pintura', type: ResourceType.EQUIPMENT },
    { name: 'Elevador 1', type: ResourceType.LIFT },
  ];

  // Resource.id é UUID gerado, então upsert por id não se aplica aqui —
  // idempotência é garantida checando por nome antes de criar.
  for (const resource of resources) {
    const exists = await prisma.resource.findFirst({ where: { name: resource.name } });
    if (!exists) {
      await prisma.resource.create({ data: resource });
    }
  }

  // Catálogo alinhado ao negócio real da Aldocar (funilaria e pintura),
  // não mecânica geral — ver fachada da loja.
  const services = [
    {
      name: 'Orçamento de Funilaria e Pintura',
      description: 'Avaliação do veículo para elaborar orçamento de reparo.',
      price: '0.00',
      priceIsEstimate: true,
      iconKey: 'clipboard-text-search-outline',
      durationMinutes: 30,
      requiredResourceType: ResourceType.BAY,
    },
    {
      name: 'Reparo de Amassados (Martelinho de Ouro)',
      description: 'Remoção de amassados sem repintura, quando a chapa não rompeu a tinta.',
      price: '180.00',
      priceIsEstimate: false,
      iconKey: 'hammer-wrench',
      durationMinutes: 60,
      requiredResourceType: ResourceType.BAY,
    },
    {
      name: 'Reparo de Para-lama/Porta (Funilaria)',
      description: 'Desamassamento e reconstituição da lataria em peças avariadas.',
      price: '350.00',
      priceIsEstimate: true,
      iconKey: 'car-door',
      durationMinutes: 180,
      requiredResourceType: ResourceType.BAY,
    },
    {
      name: 'Pintura de Peça Avulsa',
      description: 'Preparação e pintura de uma peça (para-choque, porta, capô, etc.).',
      price: '450.00',
      priceIsEstimate: false,
      iconKey: 'spray',
      durationMinutes: 240,
      requiredResourceType: ResourceType.EQUIPMENT,
    },
    {
      name: 'Pintura Completa do Veículo',
      description: 'Repintura geral da lataria do veículo.',
      price: '2800.00',
      priceIsEstimate: true,
      iconKey: 'format-paint',
      durationMinutes: 480,
      requiredResourceType: ResourceType.EQUIPMENT,
    },
    {
      name: 'Reparo de Riscos e Arranhões',
      description: 'Polimento local ou retoque de pintura em riscos superficiais.',
      price: '120.00',
      priceIsEstimate: false,
      iconKey: 'vector-line',
      durationMinutes: 60,
      requiredResourceType: ResourceType.BAY,
    },
    {
      name: 'Polimento e Cristalização',
      description: 'Polimento técnico da pintura com aplicação de cristalizador de proteção.',
      price: '250.00',
      priceIsEstimate: false,
      iconKey: 'car-wash',
      durationMinutes: 120,
      requiredResourceType: null,
    },
    {
      name: 'Reparo de Para-choque (Plástico)',
      description: 'Solda e reconstrução de para-choque de plástico trincado ou quebrado.',
      price: '280.00',
      priceIsEstimate: true,
      iconKey: 'wrench',
      durationMinutes: 150,
      requiredResourceType: ResourceType.BAY,
    },
  ];

  // upsert manual por nome (id é UUID gerado, não dá pra usar upsert por id):
  // roda de novo com segurança e também ATUALIZA quem já existe de uma seed
  // anterior (ex.: quando um campo novo, como iconKey, é adicionado depois).
  for (const service of services) {
    const existing = await prisma.service.findFirst({ where: { name: service.name } });
    if (existing) {
      await prisma.service.update({ where: { id: existing.id }, data: service });
    } else {
      await prisma.service.create({ data: service });
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
