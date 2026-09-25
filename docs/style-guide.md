# Guia de Estilo — SRP (Web + Mobile)

Este guia documenta os padrões visuais e de componentes **já em uso** no projeto,
extraídos do código real em `frontend/` e `mobile/`. O objetivo é que toda tela
nova siga essas convenções em vez de introduzir paleta, tipografia ou estrutura
próprias — consistência entre telas é a prioridade, não identidade visual por
tela (ver decisão em `research.md #16`).

## 1. Design tokens (cor)

Fonte única: `frontend/src/index.css` (variáveis HSL) e espelhado manualmente
em `mobile/src/theme/colors.ts` — os dois **não** se atualizam automaticamente
um a partir do outro; ao mudar uma cor, edite os dois arquivos.

- **Tema escuro é o padrão** (identidade Polícia Penal RS — preto + dourado).
  O light só existe como fallback/toggle opcional no web; o mobile é
  dark-only, sem alternância.
- Paleta semântica fixa, sempre usada por **papel**, nunca por valor bruto:
  `primary` (dourado), `secondary`, `muted`, `accent`, `destructive`,
  `success`, `warning`, `info`, `border`/`input`/`ring`.
- Cada cor tem seu par `-foreground` (ex.: `success` / `success-foreground`)
  para garantir contraste — sempre usar o par junto.
- **Nunca hardcode hex/rgb em componentes.** Use as classes Tailwind
  (`bg-primary`, `text-muted-foreground`, `border-input`) no web, e
  `colors.primary` etc. no mobile — nunca strings de cor soltas.
- Mapeamento de estados de domínio para cor (não é livre escolha por tela):
  - verde/`success` → preso ativo, sincronizado
  - vermelho/`destructive` → erro, exclusão, inconsistência de auditoria
  - âmbar/`warning` → efetivo mínimo, pendência
  - azul/`info` → informativo neutro

## 2. Tipografia e espaçamento

- Sem famílias de fonte customizadas por tela — usa a stack padrão do
  Tailwind/sistema. Não introduzir Google Fonts ou fontes de exibição.
- Escala de texto padrão do Tailwind (`text-sm`, `text-base`, `font-medium`,
  `font-semibold`) — não criar escala própria.
- Espaçamento em grid de 4px via utilitários Tailwind padrão
  (`gap-1.5`, `gap-4`, `p-6`, `space-y-6`). Formulários usam
  `<div className="grid gap-1.5">` por campo (label + input) e
  `<div className="grid gap-4">` para agrupar os campos.
- `--radius: 0.5rem` é o raio padrão de toda a UI (`rounded-md` deriva dele) —
  não usar `rounded-full`/`rounded-xl` fora dos componentes shadcn que já
  definem isso (ex.: `Badge` é `rounded-full` por padrão do próprio componente).

## 3. Web — shadcn/ui

- `components.json`: style `default`, baseColor `slate`, `cssVariables: true`.
- Componentes instalados ficam em `frontend/src/components/ui/*` — **não
  editar a lógica interna deles**; para variantes novas, estender o objeto
  `cva` do próprio arquivo (é assim que `success`/`warning` foram adicionados
  a `Badge`, que não existem no shadcn padrão).
- Inventário atual: `alert`, `alert-dialog`, `avatar`, `badge`, `button`,
  `calendar`, `card`, `checkbox`, `collapsible`, `command`, `dialog`,
  `dropdown-menu`, `input`, `label`, `popover`, `select`, `separator`,
  `sheet`, `sidebar`, `skeleton`, `sonner`, `table`, `tabs`, `tooltip`.
  `command` é a base do combobox com busca (`Popover` + `Command`/cmdk) —
  usar em vez de `Select` puro sempre que a lista de opções puder crescer o
  bastante pra valer a pena filtrar digitando, em vez de rolar (ex.: escolher
  um preso entre os ocupantes de uma cela). `calendar` (`react-day-picker`)
  é a base de um seletor de data — usar `Popover` + `Calendar` (ver
  `frontend/src/features/routines/components/DatePicker/`) em vez de
  `<input type="date">` nativo: o popup nativo do navegador não aceita ser
  tingido com as cores do sistema de forma confiável entre navegadores
  (`color-scheme`/`accent-color` funcionam parcial ou nada dependendo do
  navegador — research.md #44), enquanto `Calendar` é DOM/CSS normal e usa
  `bg-primary`/`text-primary-foreground` do próprio tema. Sempre passar
  `locale={ptBR}` (de `react-day-picker/locale`) — sem isso o calendário
  renderiza em inglês. Ao precisar de um componente novo, primeiro rodar
  `npx shadcn@latest add <componente>` em vez de escrever do zero.
- **Button** (`buttonVariants`): `default | destructive | outline |
  secondary | ghost | link`, tamanhos `default | sm | lg | icon`. Ação
  primária de tela = `default`; ações secundárias/neutras = `outline`;
  destrutiva sempre = `destructive`, nunca `default` com cor manual.
- **Badge**: `default | secondary | destructive | success | warning |
  outline` — usado para status de domínio (ex. `StatusBadge` mapeando
  `ACTIVE → success`, outros → `secondary`).
- **Notificações**: sempre via `notify()` (`frontend/src/lib/notify.tsx`),
  nunca texto de erro/sucesso inline construído à mão. Assinatura:
  `notify({ message, title?, type: 'success'|'error'|'info'|'warning', size?, position?, duration? })`.
  Título é fixo por `type` (Sucesso/Erro/Atenção/Informação); `title` só
  complementa (`"Erro - Credenciais incorretas"`).

## 4. Padrão de tela (web)

Estrutura típica de uma feature (ver `frontend/src/features/structure/`):

```
features/<nome>/
  index.tsx          # página, monta filtros + conteúdo, busca dados via useQuery
  api.ts              # chamadas HTTP da feature
  types.ts            # tipos da feature
  components/
    <Componente>/index.tsx
```

- Página raiz: `<div className="space-y-6 p-6">` envolvendo filtros e conteúdo.
- Toda tela autenticada roda dentro do `AppShell` (`frontend/src/layouts/AppShell`)
  — sidebar shadcn (`Sidebar`/`SidebarProvider`) + `SiteHeader`; a página em si
  só renderiza o conteúdo via `<Outlet />`, nunca reimplementa navegação/topo.
- **Filtros de busca**: bloco `<div className="flex flex-wrap items-end gap-4
  rounded-lg border border-border bg-card p-4">` com um `grid gap-1.5` por
  campo (label + Select/Dropdown) e um botão "Pesquisar" alinhado à direita
  (label `invisible` no botão pra alinhar com os campos ao lado).
- **Dados carregados**: sempre `@tanstack/react-query` (`useQuery`/`useMutation`),
  nunca `fetch`/`useEffect` manual para dados de API.

## 5. Formulários e diálogos (web)

Padrão fixo, visto em `InmateDialog` e `EntityDialog`:

- Criar e editar usam **o mesmo componente/formulário** — a diferença é só
  se uma entidade existente foi passada como prop (`isEdit = entity !== undefined`)
  e qual mutation dispara.
- Estrutura: `Dialog` → `DialogTrigger asChild` (o gatilho vem de fora, via
  `children`) → `DialogContent` → `DialogHeader`/`DialogTitle` → campos em
  `grid gap-4` → `DialogFooter` com um único `Button` de submit.
- Estado do form em `useState` simples por campo (o projeto **não** usa
  `react-hook-form`/`zod` nos formulários de dialog atuais, apesar de estarem
  no `package.json` — não introduzir sem necessidade nova).
- Reset dos campos ao reabrir: feito em `handleOpenChange`, não em `useEffect`.
- Botão de submit: `disabled={!campoObrigatório || mutation.isPending}`,
  texto muda para `"Salvando..."` durante o pending — nunca um spinner à parte.
- `onSuccess`: chama `notify({ type: 'success' })`, invalida as `queryKey`s
  afetadas via `queryClient.invalidateQueries`, fecha o dialog (`setOpen(false)`).
- `onError`: `notify({ type: 'error', title: '...', message: '...' })` genérico
  — não expõe erro cru da API.
- Campo travado/somente-leitura (ex. cela do preso): `<div
  className="rounded-md border border-input bg-muted px-3 py-2 text-sm
  text-muted-foreground">`, não um `Input disabled`.
- **Título de modal que age sobre um preso** (`MovementDialog`,
  `FinalSituationDialog`, `CellTransferDialog`, `ReversalDialog`,
  `ReasonDialog`): `DialogTitle` leva só a ação ("Permuta de galeria",
  "Registrar saída"), nunca a ação e o nome concatenados com travessão. Logo
  abaixo do `DialogHeader` vai o cartão de destaque `InmateHeaderCard`
  (`frontend/src/features/movements/components/InmateHeaderCard/`), no mesmo
  padrão do `RoutineHeaderCard`/`DateHighlight`: borda `border-primary`, ícone
  `User` num quadrado `bg-accent`/`text-primary`, rótulo "PRESO" em
  uppercase/`text-primary` e o nome do preso em negrito e maiúsculo, com a
  matrícula em texto pequeno embaixo. Não usar mais `DialogDescription` com
  ícone e texto solto para o nome. Se o corpo do formulário já tinha um campo
  somente-leitura repetindo esse mesmo nome, remover — fica redundante com o
  cartão.
- **Texto livre longo em tabela** (ex.: motivo de uma situação definitiva):
  nunca deixar a célula crescer nem quebrar em várias linhas, senão a tabela
  perde o alinhamento. Mostrar uma linha só, com largura fixa e `truncate`
  ("..." no fim), e um botão só-ícone (`ghost`, `size="icon"`) ao lado que abre
  um modal com o texto completo (`whitespace-pre-wrap`, rolagem vertical) —
  ver `ReasonDialog` em `frontend/src/features/definitive-situations/`.
- **Título de modal que edita uma Rotina existente** (`ScheduleDialog`,
  `ActivationDialog` em `frontend/src/features/routines/`): exceção ao padrão
  acima de `DialogDescription` em texto simples — usa um cartão de destaque
  logo abaixo do `DialogHeader`, `RoutineHeaderCard`
  (`frontend/src/features/routines/components/RoutineHeaderCard/`): borda
  `border-primary`, ícone à esquerda num quadrado `bg-accent`/`text-primary`
  (mesmo ícone `CalendarClock` do item "Rotinas" do menu lateral), rótulo
  "ROTINA" em uppercase/`text-primary` acima do nome em negrito — o nome da
  rotina sem esse destaque passava despercebido (feedback do usuário).
- **Nome de preso é sempre exibido em maiúsculo** — em toda tela/dialog/
  toast que mostra `inmate.name` ou o nome de outro preso (ex. o candidato de
  permuta). Prefira a classe utilitária `uppercase` (CSS puro, não altera o
  dado) sempre que o texto está num elemento JSX próprio; use
  `.toUpperCase()` no JavaScript só quando não há elemento pra estilizar —
  mensagens de `notify()`/toast, ou o valor exibido no *trigger* fechado de
  um combobox `cmdk` (que espelha o texto do item selecionado, não o
  className dele).
- **`Select` vs. combobox com busca**: use `Select` (`@/components/ui/select`)
  pra listas curtas/fixas (tipo de movimentação, situação). Para uma lista
  que pode crescer o bastante pra valer a pena filtrar digitando em vez de
  rolar (ex. escolher um preso entre os ocupantes de uma cela), use o
  combobox `Popover` + `Command`/cmdk (`@/components/ui/popover` +
  `@/components/ui/command`) — ver `CellTransferDialog` ("Preso de
  destino"). **Sempre passe `shouldFilter={false}` no `Command` e filtre a
  lista você mesmo por substring** (`nome.toLowerCase().includes(busca)`) —
  o filtro fuzzy padrão do cmdk casa letras fora de ordem/posição (digitar
  "vini" batendo em "Otavio Teixeira Martins") e não é o que o usuário espera
  de uma busca por nome.

## 6. Mobile — react-native-reusables + NativeWind

- Base: `nativewind` (Tailwind para RN) + `@rn-primitives/*` +
  `class-variance-authority`, mesmo padrão shadcn portado pro React Native
  (biblioteca "react-native-reusables"). Componentes em
  `mobile/src/components/ui/*`: `alert`, `avatar`, `badge`, `button`, `card`,
  `icon`, `input`, `label`, `text`.
- Mesmas variantes de `Button`/`Badge` do web (`default | destructive |
  outline | secondary | ghost | link`), adaptadas com `Platform.select`
  para diferenciar `hover:` (web) de `active:` (nativo) na mesma definição
  `cva` — não duplicar o componente por plataforma.
- Cores vêm de `mobile/src/theme/colors.ts`, meramente os mesmos HSL do bloco
  `.dark` do web — tema único, sem light mode no mobile.
- Toast: `mobile/src/lib/toast.ts` — equivalente mobile do `notify()` web,
  mesma ideia de único ponto de entrada para feedback ao usuário.

## 7. Padrão de tela (mobile)

Estrutura típica (ver `mobile/src/features/structure/screens/CellsScreen/`):

```
features/<nome>/screens/<Tela>/
  index.tsx           # só JSX — recebe tudo pronto do viewmodel
  viewmodel.ts         # hook use<Tela>ViewModel(navigation, route) com toda a lógica/estado
  components/
    <Componente>/index.tsx
```

- Separação estrita **view / viewmodel**: `index.tsx` não chama `useQuery`
  nem guarda estado diretamente — só desestrutura o retorno do
  `useXScreenViewModel(...)` e renderiza.
- Toda tela: `SafeAreaView` com `style={{ backgroundColor: colors.background }}`
  e `className="flex-1"`, `edges` explícito (`['top','left','right']` quando
  há tab bar/bottom sheet cobrindo o fundo).
- Cabeçalho de tela sempre via `<ScreenHeader title={...} />`
  (`mobile/src/components/ScreenHeader`) — nunca um header custom por tela.
- Loading: `ActivityIndicator color={colors.primary}` centralizado
  (`flex-1 items-center justify-center`) — não skeleton no mobile (o `Skeleton`
  shadcn é só do web).
- Listas: `FlatList` com `contentContainerClassName="gap-5 px-4 pb-4"` e
  `ListEmptyComponent` sempre tratado (texto `variant="muted"` centralizado,
  nunca lista vazia sem feedback).

## 8. O que evitar

- Não criar paleta, tipografia ou raio de borda novos por tela — tudo vem
  dos tokens da seção 1.
- Não escrever CSS/estilo inline para cor — sempre a classe/token semântico.
- Não construir alert/toast de erro "na mão" — sempre `notify()` (web) /
  `toast` (mobile).
- Não duplicar um componente shadcn/rnr já instalado; estender via `cva` no
  próprio arquivo em `components/ui`.
- Não introduzir uma biblioteca de UI ou animação nova sem necessidade —
  o efeito "cada tela com uma cara" é o oposto do que este projeto quer
  (ver decisão contra a skill `frontend-design`).
