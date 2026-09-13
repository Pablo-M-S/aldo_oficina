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
- **Estoque só muda via `InventoryMovement`.** `Product.quantity` nunca é
  editado diretamente — toda alteração (entrada, saída, ajuste, uso em OS)
  passa por `InventoryService.adjustStock`/`consumeForWorkOrder`, que grava o
  movimento na mesma transação. Isso garante que o saldo do produto sempre
  seja reconstruível a partir do histórico.
- **Baixa de estoque e criação de item da OS são atômicas.** Ao lançar uma
  peça em uma ordem de serviço (`WorkOrdersService.addItem`), a baixa de
  estoque e a criação do `WorkOrderItem` acontecem na mesma transação: ou as
  duas ou nenhuma. Sem isso, uma falha no meio do processo criaria um item
  "fantasma" sem estoque correspondente baixado (ou vice-versa).
- **Status da OS como máquina de estados explícita** (`ALLOWED_TRANSITIONS`
  em `WorkOrdersService`), não um enum solto que qualquer papel altera
  livremente. Pular etapas (ex.: `OPEN` → `COMPLETED` direto) é rejeitado.
- **Venda a partir de OS não duplica baixa de estoque.** As peças já foram
  descontadas quando os itens foram lançados na OS; `SalesService.createFromWorkOrder`
  só consolida o valor (mão de obra + itens) em um registro cobrável.
  A venda avulsa pelo carrinho (`createFromCart`) é quem de fato decrementa
  estoque, via `InventoryService.consumeForSale`.
- **Pagamento nunca ultrapassa o saldo em aberto.** `SalesService.registerPayment`
  calcula o saldo restante a partir da soma dos pagamentos já registrados e
  rejeita qualquer valor acima disso — evita saldo negativo por erro de
  digitação no caixa.

## Roadmap (próximas fases)

1. ~~Ordens de serviço (`WorkOrder`/`WorkOrderItem`)~~ — feito.
2. ~~Produtos, estoque e movimentações (`Product`/`InventoryMovement`)~~ — feito.
3. ~~Vendas e pagamentos (`Sale`/`SaleItem`/`Payment`)~~ — feito.
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
