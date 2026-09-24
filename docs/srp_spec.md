# SRP - Sistema de Rotinas Penitenciárias

## Visão Geral

O SGRP é um sistema digital para gestão das rotinas operacionais do sistema prisional do Rio Grande do Sul, substituindo o controle atual baseado em folhas impressas por um registro eletrônico estruturado e auditável. O objetivo é aumentar a segurança, a rastreabilidade das movimentações de presos e a eficiência do trabalho dos policiais penais, supervisores e chefia/diretoria.

O sistema será composto por um backend em Node.js com NestJS, um front-end web em React com Vite e um aplicativo móvel em React Native, todos integrados a um banco de dados PostgreSQL.

## Perfis de Usuário e Permissões

### Policial Penal

- Registrar movimentações de presos (saída, retorno, motivo, local).
- Consultar lista de presos por cela/galeria e seu status atual.
- Visualizar rotinas programadas para o turno.
- Não pode criar, alterar ou excluir rotinas.
- Não pode alterar horários de rotina.
- Não pode alterar escalas de efetivo.

### Supervisor

- Ajustar horários das rotinas existentes.
- Ativar/desativar rotinas em dias específicos (ex: dia de visita).
- Controlar escalas de efetivo (quem está trabalhando em cada turno/setor).
- Visualizar relatórios de movimentações, inconsistências e efetivo.
- Não pode criar novos tipos de rotina.
- Não pode alterar estrutura de permissões.

### Chefia / Diretor

- Criar novas rotinas (nome, tipo, horários, unidades/galerias onde se aplica).
- Definir quais rotinas são padrão em todos os estabelecimentos e quais são específicas de cada unidade.
- Alterar quaisquer configurações de rotinas e escalas.
- Acessar todos os relatórios e auditorias do sistema.

## Módulos do Sistema

### 1. Cadastro e Mapa da Unidade

- Cadastro de presos: identificação, foto, dados pessoais básicos, regime, unidade, galeria, cela atual, status (ativo, liberdade, tornozeleira, transferido, etc.).
- Cadastro de celas e galerias: código, capacidade, ocupação atual, tipo (masculino/feminino, coletivo/individual).
- Cadastro de unidades prisionais: identificação da unidade, dados administrativos básicos.

### 2. Rotinas

Cada rotina possui:

- Nome (ex: Ligar água, Corre, Faxina, Pátio, Conferência, Atendimento médico interno, Atendimento médico externo).
- Tipo (diária, por dia da semana, específica para dia de visita, finais de semana, feriados).
- Horários (um ou mais horários por dia).
- Escopo (quais unidades, galerias ou celas a rotina atinge).
- Status (ativa/inativa).

Supervisores podem ajustar horários e ativação por dia; chefia/diretor pode criar novas rotinas e definir padrões por unidade.

### 3. Movimentações

As movimentações registram o deslocamento do preso em relação à sua cela/galeria, tanto temporárias quanto definitivas.

Campos principais:

- Preso.
- Tipo de movimentação (temporária ou definitiva).
- Categoria (pátio, corre, faxina, atendimento médico interno, atendimento médico externo, visita, transferência, liberdade, tornozeleira, etc.).
- Motivo/descrição.
- Local de destino (setor interno, unidade externa, fórum, hospital, etc.).
- Data e horário de saída.
- Data e horário de retorno (para movimentações temporárias).
- Usuário/agente responsável.
- Observações.

O sistema deve mostrar em tempo real o status de cada preso (na cela, em rotina, em atendimento, em visita, em situação definitiva), com possibilidade de filtragem por unidade, galeria e cela.

### 4. Situações Definitivas

Situações nas quais o preso sai da galeria/cela e não retorna mais àquele local:

- Liberdade: registro de data, número de alvará, unidade judiciária, agente responsável.
- Tornozeleira eletrônica: registro de data de início, número do dispositivo, empresa responsável, restrições.
- Transferência: unidade de destino, data, escolta, referência documental.
- Troca de cela definitiva: cela antiga, cela nova, data/hora e motivo.

Essas movimentações atualizam o status do preso e geram histórico completo de localização (linha do tempo de celas, unidades e regimes).

### 5. Controle de Efetivo

- Cadastro de policiais penais: identificação, matrícula, cargo, unidade.
- Escala de serviço: turnos (manhã, tarde, noite), datas, setores (galeria A, B, portaria, etc.).
- Registro de presença e faltas.
- Relatórios de efetivo mínimo por turno e setor.

### 6. Relatórios e Auditoria

- Movimentações por preso (últimos X dias).
- Presos com maior tempo fora da cela.
- Inconsistências: movimentações sem retorno registrado, preso marcado fora da cela sem motivo, rotinas não executadas.
- Execução de rotinas por turno e unidade (cumprimento, atrasos, não execução).
- Efetivo por turno versus movimentações realizadas.
- Histórico de ocupação de celas e galerias.

Todos os eventos relevantes devem gerar logs de auditoria (quem fez, quando, o que foi alterado).

## Arquitetura Técnica

### Backend

- Node.js com NestJS.
- Organização em módulos (Users, Auth, Presos, Unidades, Celas, Rotinas, Movimentações, Efetivo, Relatórios).
- ORM sugerido: TypeORM ou Prisma, integrado ao PostgreSQL.
- API REST (ou GraphQL) para servir o front-end web e o app móvel.

### Front-end Web

- React com Vite.
- Interface para supervisores e chefia/diretoria.
- Painéis de controle, configuração de rotinas, escalas e relatórios.

### Aplicativo Móvel

- React Native.
- Interface otimizada para uso em plantão pelos policiais penais.
- Registro rápido de movimentações, consulta de presos por cela/galeria e visualização de rotinas do turno.

### Banco de Dados

- PostgreSQL.
- Modelagem relacional com tabelas para usuários, perfis, presos, unidades, galerias, celas, rotinas, horários de rotina, movimentações, tipos de movimentação, escalas de efetivo e logs de auditoria.

