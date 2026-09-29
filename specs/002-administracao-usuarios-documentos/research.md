# Phase 0 Research: Administração de Usuários e Documentos

## 1. Revogação de sessão (reset de senha e troca da própria senha)

**Decision**: Extrair a revogação de refresh tokens — hoje feita inline em
`UsersService.deactivate()` (`backend/src/users/users.service.ts:138-142`, um `update()` direto no
`RefreshTokenRepository` setando `revokedAt`) — para um método único e reutilizável em
`TokenService`: `revokeAllForUser(userId: number, exceptTokenHash?: string): Promise<void>`.

- Sem `exceptTokenHash`: revoga todos os refresh tokens do usuário (usado por `deactivate()`,
  reaproveitado sem mudança de comportamento, e pelo reset de senha administrativo, FR-007).
- Com `exceptTokenHash`: revoga todos menos o informado (usado pela troca da própria senha,
  FR-017a — "mantendo válida apenas a sessão atual").

**Rationale**: `deactivate()` já resolve exatamente o mesmo problema (nenhuma sessão deve
sobreviver à ação administrativa, comentário "FR-031" na linha 138) — duplicar a query no
`documents`/`auth` seria o oposto do Princípio IX (Maintainability). Generalizar com o parâmetro
opcional cobre os dois casos (reset = revogar tudo; troca própria = revogar tudo exceto a atual)
sem precisar de dois métodos.

**Como identificar "a sessão atual" na troca de senha**: o endpoint `PATCH
/api/v1/auth/change-password` passa a exigir o `refreshToken` do dispositivo que está fazendo a
troca no corpo da requisição — o mesmo valor que o frontend já guarda para chamar `POST
/api/v1/auth/refresh` (`contracts/auth.md` da feature 001). O backend localiza esse token pelo hash
(mesmo mecanismo de `TokenService`, `backend/src/auth/token.service.ts:107-110`) e o exclui da
revogação.

**Alternatives considered**:
- Manter a query duplicada em cada lugar que precisar revogar sessão → rejeitado (duplicação de
  lógica, Princípio IX).
- Rastrear "sessão atual" por um ID de sessão dedicado (novo campo/claim no JWT) → rejeitado por
  exigir mudança no formato do access token já emitido para todo o sistema (feature 001), fora do
  escopo desta fase; o refresh token já é o identificador de sessão de fato no desenho atual.

## 2. Auditoria das novas mutações

**Decision**: Toda mutação nova (editar/reativar/trocar-lotação/adicionar-lotação/resetar-senha de
usuário; enviar/remover documento) chama `AuditService.record(...)` diretamente do service,
seguindo o padrão manual já usado em `UsersService.deactivate()`
(`backend/src/users/users.service.ts:144-151`, com `@SkipAutoAudit()` no controller,
`backend/src/users/users.controller.ts:57`) e em `MovementsService`
(`backend/src/movements/movements.service.ts:723-736` fora de transação;
`:861-874` dentro de transação via o parâmetro `manager`). Nenhum valor novo é adicionado ao enum
`AuditAction` (`backend/src/audit/entities/audit-log.entity.ts:12-19`) — `UPDATE` cobre editar/
reativar/trocar-lotação/adicionar-lotação/resetar-senha; `INSERT`/`DELETE` cobrem enviar/remover
documento, exatamente como o resto do sistema já faz por tipo de operação SQL, não por nome de
ação de negócio.

**Rationale**: Consistência (Princípio VII) — introduzir um enum de ações granular só para este
módulo quebraria o padrão uniforme já em uso em todo o resto da API.

**Alternatives considered**: Deixar o interceptor de auditoria automático (`audit.interceptor.ts`)
cobrir esses endpoints sem chamada manual → rejeitado para os casos que precisam de `oldData`
detalhado (editar, trocar/adicionar lotação, reset de senha), mesmo motivo pelo qual `deactivate()`
já usa `@SkipAutoAudit()` hoje; endpoints mais simples de documento (enviar/remover) podem usar o
interceptor automático sem `oldData` relevante, se a task de implementação confirmar que o
interceptor cobre `multipart/form-data` sem efeito colateral.

## 3. Verificação de conteúdo real do arquivo (FR-013a)

**Decision**: Implementar um utilitário interno (`backend/src/documents/file-signature.ts`, sem
dependência de terceiros) que lê os primeiros bytes do arquivo recebido e confere a assinatura
contra os 4 formatos aceitos:

| Formato | Assinatura (magic bytes) | Observação |
|---|---|---|
| PDF | `25 50 44 46` (`%PDF`) | |
| DOCX | `50 4B 03 04` (ZIP) + presença do entry `[Content_Types].xml` no índice central do ZIP | DOCX é um ZIP OOXML; só o cabeçalho ZIP não basta para diferenciar de um `.zip` qualquer renomeado. |
| DOC (legado) | `D0 CF 11 E0 A1 B1 1A E1` (Compound File Binary) | Formato binário legado do Word 97-2003. |
| TXT | ausência de qualquer assinatura binária conhecida (das 3 acima ou de executáveis: `4D 5A` MZ/PE, `7F 45 4C 46` ELF, `#!` shebang) **e** o conteúdo decodifica como UTF-8/ASCII válido, sem bytes nulos | TXT não tem assinatura própria; a validação é por exclusão + heurística de texto. |

Um arquivo recusado se: (a) a extensão declarada não corresponde à assinatura detectada, ou (b) a
assinatura não corresponde a nenhum dos 4 formatos.

**Rationale**: Evita a brecha óbvia de renomear um executável para `.pdf`/`.docx` (o próprio motivo
da pergunta na clarificação — FR-013a). Implementação própria em vez de biblioteca (`file-type`)
porque as versões atuais de `file-type` (≥17) são ESM-only, o que cria atrito de bundling num
projeto NestJS CommonJS (`backend/tsconfig.json` não usa `"module": "esnext"`); o conjunto de 4
formatos é pequeno e estável o suficiente para não justificar uma dependência externa (Princípio
IX — Maintainability: menos superfície de dependência para manter atualizada).

**Alternatives considered**: `file-type@16.5.4` (última versão CJS) → rejeitado por fixar uma
versão desatualizada de uma dependência de segurança; `file-type-cjs` (fork da comunidade) →
rejeitado por não ser mantido pela mesma equipe do pacote original; scanner de antivírus
(ClamAV) → fora de escopo desta fase (nenhuma infraestrutura de antivírus existe hoje no projeto;
não foi pedido pelo usuário além de "impedir que arquivo não permitido ou script malicioso
entre" — a checagem de assinatura já fecha esse vetor específico).

## 4. Tamanho máximo de arquivo

**Decision**: 10 MB por arquivo, configurável via `DOCUMENTS_MAX_FILE_SIZE_MB` (novo em
`backend/.env.example`, seguindo o padrão `SCREAMING_SNAKE_CASE` já usado ali), aplicado via
`limits.fileSize` do `FileInterceptor` (Multer, já disponível via `@nestjs/platform-express`, sem
dependência nova).

**Rationale**: Formulários/modelos/manuais em DOCX/DOC/TXT/PDF tipicamente ficam na casa de poucos
MB; 10 MB dá margem confortável para um manual com imagens embutidas sem abrir espaço para abuso
de armazenamento (`docs/srp_spec.md` não define isso; é uma decisão técnica conforme já registrado
em `spec.md` → Assumptions).

**Alternatives considered**: Sem limite explícito → rejeitado, viola diretamente FR-014;
limite maior (ex.: 50 MB) → rejeitado por não haver caso de uso descrito que precise disso.

## 5. Estrutura do módulo `documents/`

**Decision**: Copiar a estrutura de `backend/src/routines/` (módulo mais simples e comparável em
tamanho): `documents.module.ts` + `documents.controller.ts` + `documents.service.ts` na raiz do
módulo, `entities/document.entity.ts` + `entities/document-type.entity.ts`,
`dto/create-document.dto.ts` + `dto/document-response.dto.ts`.

**Rationale**: Mesmo padrão usado em todos os módulos de negócio do projeto (Princípio V/VII);
`routines/` foi escolhido como referência por ter, como `documents/`, duas entities relacionadas
(routine + routine-schedule ≈ document + document-type) sem a complexidade extra de sub-recursos
múltiplos que `movements/` tem.

## 6. Envio de e-mail (senha inicial e reset)

**Decision**: Novo módulo `backend/src/email/` com `EmailService` usando `nodemailer` (SMTP),
configurado por `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
(novas variáveis em `backend/.env.example`, mesmo padrão de bloco comentado com referência a este
research.md usado para `JWT_*`/`INVITE_TOKEN_EXPIRES_IN`). Método único inicial:
`sendPasswordEmail(to: string, temporaryPassword: string, kind: 'created' | 'reset')`.
`UsersService.create()` passa a chamar esse método em vez de só logar o token
(`backend/src/users/users.service.ts:187`, hoje marcado com o comentário
`// TODO(US-later): deliver via a real notification/email service instead of a log line.` — esta
fase resolve esse débito). `UsersService` ganha um novo método `resetPassword()` que reusa o mesmo
`EmailService`.

**Falha de envio (FR-002a/FR-007a)**: `EmailService.sendPasswordEmail()` nunca lança exceção para
o chamador em caso de falha de envio — captura o erro, loga, e retorna um booleano de sucesso. O
service de usuários usa esse retorno para decidir a resposta ao frontend (`emailDelivered: boolean`
no `UserResponseDto`), permitindo ao painel web mostrar o aviso e o botão "reenviar" (FR-002a/
FR-007a) sem desfazer a criação/reset já persistidos.

**Reenvio**: novo endpoint `POST /api/v1/users/:id/resend-password-email` (WARDEN) — reenvia o
e-mail mais recente pendente (senha inicial ainda não trocada, ou senha temporária de reset ainda
não trocada); responde `409` se o usuário já trocou a senha desde então (nada para reenviar).

**Rationale**: Isola a dependência de infraestrutura de e-mail atrás de uma interface própria
(Princípio V — Clean Architecture), do mesmo jeito que `AuditService`/`TokenService` isolam suas
responsabilidades; `nodemailer` é a biblioteca padrão de fato do ecossistema Node/NestJS para SMTP,
mantida ativamente, e não exige nenhum provedor de e-mail específico (funciona com qualquer
servidor SMTP que a unidade já tenha ou venha a contratar).

**Alternatives considered**: Provedor de e-mail transacional específico (SendGrid, SES, Mailgun) →
rejeitado por acoplar o projeto a um fornecedor externo sem esse requisito ter sido pedido; o
projeto roda num ambiente estadual que provavelmente já tem (ou vai prover) um servidor SMTP
próprio — `nodemailer` sobre SMTP genérico é a opção mais neutra.

## 7. Política de senha (nova senha em criação, reset e troca)

**Decision**: Reaproveitar exatamente a regra já usada em `SetInitialPasswordDto`
(`backend/src/auth/dto/set-initial-password.dto.ts:8-10`: `@IsString()` + `@MinLength(8)`, sem
exigência adicional de maiúscula/número/símbolo) para o novo `ChangePasswordDto.newPassword` e para
a senha temporária gerada pelo backend em `resetPassword()`.

**Rationale**: Consistência (Princípio VII) e o que já foi registrado em `spec.md` → Assumptions
("a política de complexidade da nova senha é a mesma já aplicada hoje na definição da senha
inicial"). Não existe hoje nenhum DTO de troca/reset de senha no projeto — este é o primeiro
lugar que precisa da regra fora da senha inicial.

## 8. Armazenamento do arquivo de documento

**Decision**: Disco local do servidor backend, diretório configurável via `DOCUMENTS_STORAGE_PATH`
(novo em `backend/.env.example`, default `./storage/documents`, fora do controle de versão — a
adicionar em `.gitignore`). No disco, cada arquivo é salvo com um nome gerado (`uuid` + extensão
original — `uuid` já é dependência do backend, `backend/package.json`), nunca com o nome de
exibição escolhido pelo usuário, evitando colisão de nome de arquivo e path traversal. O nome de
exibição (`Document.name`) e a categoria (`Document.documentTypeId`) vivem só no banco.

**Rationale**: Nenhuma infraestrutura de storage externo (S3 ou similar) existe hoje no projeto
(research anterior confirmou ausência de `aws-sdk`/`multer`/qualquer storage); introduzir uma
dependência de nuvem para uma biblioteca de dezenas de arquivos pequenos seria complexidade não
justificada (Princípio IX). Nome gerado no disco + nome de exibição no banco é o padrão comum para
evitar que caracteres do nome original (acentos, barras, `..`) virem um problema de sistema de
arquivos ou um vetor de path traversal.

**Alternatives considered**: Guardar o arquivo como `bytea` no PostgreSQL → rejeitado, não é um
padrão usado em nenhum outro lugar do projeto e infla o banco sem necessidade; storage em nuvem
(S3-compatible) → adiado, sem requisito de multi-servidor ou alta disponibilidade declarado para
esta fase; se o backend vier a rodar em múltiplas instâncias sem storage compartilhado, isso se
torna uma migração futura, não um bloqueio desta fase.

## 9. Unicidade do nome de documento por categoria (FR-010a)

**Decision**: Constraint única de banco em `(document_type_id, name)` na tabela `documents`
(migration TypeORM), não apenas checagem em memória no service. Como a remoção é definitiva
(hard delete — ver research.md #10), a constraint simples é suficiente; não há necessidade de
índice parcial para "documento ativo" porque um documento removido deixa de existir na tabela.

**Rationale**: Data Integrity (Princípio IV) — uma corrida entre dois uploads simultâneos do mesmo
nome só é resolvida de forma confiável no banco, não só na aplicação (mesmo padrão já usado para
e-mail/matrícula de usuário único, `contracts/structure.md` da feature 001, linha 29).

## 10. Remoção de documento

**Decision**: Remoção definitiva (hard delete) da linha em `documents` e do arquivo correspondente
em disco, junto com uma entrada de auditoria (`AuditAction.DELETE`, `oldData` com o snapshot
completo do documento removido) — o registro de auditoria, não a linha da tabela, é o que preserva
o histórico (Princípio III já garante que logs de auditoria nunca são apagados).

**Rationale**: `spec.md` → Assumptions já define que esta fase não exige versionamento; manter o
arquivo órfão em disco depois de removido do banco não tem uso e desperdiça espaço sem propósito.

**Alternatives considered**: Soft delete (`deletedAt`) → rejeitado por não ter sido pedido e por
não haver tela de "documentos removidos" no escopo desta fase; se um requisito de recuperação
surgir depois, o log de auditoria já guarda o suficiente para reconstruir o documento manualmente.
