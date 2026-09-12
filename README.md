# NXL Oficina

Sistema de gestão para oficinas mecânicas — agendamento por recurso, ordens de
serviço, estoque e painel administrativo. Projeto sob a holding NXL.

## Stack

TypeScript · Node.js + NestJS · PostgreSQL + Prisma · Redis · JWT + RBAC ·
Docker · GitHub Actions · Jest.

## Rodando localmente

```bash
git pull --no-rebase
cp .env.example .env
npm install
docker compose up -d db redis
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

A API sobe em `http://localhost:3000`, com documentação Swagger em
`http://localhost:3000/docs` (desabilitada em produção).

Login do usuário de seed: `admin@nxl-oficina.com` / `TrocarEssaSenha123!`
(troque a senha assim que possível — está aqui só para o primeiro acesso local).

## Rodando tudo via Docker

```bash
docker compose up --build
```

## Testes

```bash
npm run test
```

O ponto mais sensível do sistema — o motor de conflito de agendamento por
recurso (`src/scheduling/interval.utils.ts`) — tem cobertura dedicada em
`interval.utils.spec.ts`, testando sobreposição parcial, total, intervalos
que apenas se tocam (não é conflito) e separação total.

## Decisões de arquitetura

- **RBAC via enum `Role` no `User`**, não tabelas `Role`/`Permission`
  separadas. Cobre os 5 perfis do escopo atual (admin, gerente, mecânico,
  atendente, cliente) sem a complexidade de um RBAC tabelado, que pode ser
  introduzido depois sem quebrar a API pública.
- **Disponibilidade calculada por recurso, não por horário global.** Cada
  `Appointment` referencia um `Resource` (elevador, box, mecânico). A
  checagem de conflito filtra por `resourceId` antes de comparar intervalos.
- **Conflito de horário verificado dentro de transação `Serializable`**
  (`SchedulingService.createAppointment`), não só em código. Isso evita a
  condição de corrida de duas requisições simultâneas reservando o mesmo
  horário — uma checagem em JS sozinha, sem isolamento de transação, não é
  suficiente sob concorrência real.
- **Guards globais em cascata**: `ThrottlerGuard` → `JwtAuthGuard` →
  `RolesGuard`. Rotas públicas usam `@Public()` para escapar do
  `JwtAuthGuard`; nenhuma rota escapa do `RolesGuard` sem `@Roles(...)`
  explícito ou ausência de metadata (tratado como liberado por padrão do
  Nest, mas todos os controllers deste projeto declaram `@Roles` de forma
  explícita).
- **Revalidação do usuário a cada request** na `JwtStrategy` (busca no banco,
  não confia apenas no payload do token) — revoga acesso imediatamente se o
  usuário for desativado, mesmo com um token ainda válido.

## Roadmap (próximas fases)

1. Ordens de serviço (`WorkOrder`/`WorkOrderItem`) — schema já modelado, faltam
   service/controller.
2. Produtos, estoque e movimentações (`Product`/`InventoryMovement`).
3. Vendas e pagamentos (`Sale`/`SaleItem`/`Payment`).
4. Painel administrativo (frontend Next.js consumindo esta API).
5. Notificações (agendamento, andamento, conclusão).
6. MFA para perfis administrativos.
7. Deploy AWS + observabilidade.

## Sobre a checagem de sintaxe deste projeto

Este ambiente de desenvolvimento não tem acesso à internet, então não foi
possível rodar `npm install` de fato contra o registry do npm para compilar
o projeto com os pacotes reais do NestJS/Prisma. Em vez disso:

- O motor de agendamento (`interval.utils.ts`) — a lógica de negócio mais
  crítica — foi executado de verdade via `tsx`, com 13 casos de teste, todos
  passando.
- Todo o restante do código foi checado com `tsc` real contra stubs de tipo
  das dependências (reproduzindo as assinaturas públicas usadas), o que
  pega erros de sintaxe, importação e uso incorreto de decorators/tipos.
  Isso não substitui rodar `npm install && npm run build` com os pacotes
  reais — faça isso como primeiro passo ao clonar o repositório, e me avise
  se algo não compilar.
