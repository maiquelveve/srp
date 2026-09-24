import type { LucideIcon } from 'lucide-react';
import {
  BedDoubleIcon,
  CalendarClockIcon,
  DoorOpenIcon,
  SearchXIcon,
  UserRoundSearchIcon,
  UsersIcon,
} from 'lucide-react';

export interface ReportHelp {
  icon: LucideIcon;
  /** Nome da aba, usado no título do modal. */
  title: string;
  /** Uma frase: para que serve o relatório. */
  summary: string;
  /** Uma linha por coluna ou bloco que aparece na tela. */
  shows: { label: string; text: string }[];
  /** Como o relatório é calculado e como usar os filtros. */
  howItWorks: string[];
  /** Aviso opcional sobre um limite do relatório. */
  note?: string;
}

export const REPORT_HELP = {
  longestOut: {
    icon: DoorOpenIcon,
    title: 'Fora da cela',
    summary: 'Ranking dos presos que mais tempo passaram fora da cela no período.',
    shows: [
      { label: 'Preso', text: 'Nome de quem saiu da cela.' },
      {
        label: 'Tempo fora da cela',
        text: 'Soma de todas as saídas temporárias do preso no período.',
      },
      {
        label: 'Situação',
        text: '"Fora da cela agora" se há uma saída sem retorno, ou "Retornou".',
      },
    ],
    howItWorks: [
      'Conta só saídas temporárias, como atendimento médico e visita.',
      'Uma saída sem retorno conta o tempo até este momento.',
      'A lista começa por quem ficou mais tempo fora.',
      'Use o filtro Período para escolher quantos dias voltar.',
    ],
  },
  inconsistencies: {
    icon: SearchXIcon,
    title: 'Inconsistências',
    summary: 'Situações que precisam de atenção: saídas que não voltaram e saídas sem motivo.',
    shows: [
      {
        label: 'Saídas sem retorno',
        text: 'Presos que saíram e não voltaram dentro do prazo escolhido.',
      },
      {
        label: 'Fora da cela sem motivo',
        text: 'Presos com saída em aberto e sem o motivo preenchido.',
      },
    ],
    howItWorks: [
      'Escolha o prazo esperado de retorno, de 1 a 72 horas.',
      'Só entram saídas que ainda estão em aberto.',
      'Cada lista tem a sua própria paginação.',
    ],
    note: 'Rotinas não executadas não aparecem aqui. O sistema não registra quando uma rotina acontece.',
  },
  byInmate: {
    icon: UserRoundSearchIcon,
    title: 'Por preso',
    summary: 'Todas as movimentações de um preso no período.',
    shows: [
      { label: 'Saída', text: 'Data e hora em que o preso saiu.' },
      { label: 'Tipo e destino', text: 'O que foi a movimentação e para onde o preso foi.' },
      { label: 'Motivo', text: 'Motivo informado por quem registrou.' },
      { label: 'Retorno', text: 'Quando voltou. "Sem retorno" indica saída temporária em aberto.' },
      { label: 'Registrado por', text: 'Usuário que fez o registro.' },
    ],
    howItWorks: [
      'Escolha a galeria e depois o preso.',
      'As movimentações aparecem da mais recente para a mais antiga.',
      'Movimentações definitivas, como troca de cela, não têm retorno.',
    ],
  },
  routines: {
    icon: CalendarClockIcon,
    title: 'Rotinas',
    summary: 'Quantas vezes cada rotina estava programada no período.',
    shows: [
      { label: 'Rotina e galeria', text: 'Nome da rotina e a galeria onde ela se aplica.' },
      { label: 'Ocorrências programadas', text: 'Total de horários que valeram no período.' },
      {
        label: 'Desativadas por data',
        text: 'Horários que foram desligados para uma data específica.',
      },
    ],
    howItWorks: [
      'Cada horário da rotina conta uma ocorrência por dia em que ele vale.',
      'Uma rotina desativada para um dia deixa de contar como programada nesse dia.',
      'Use o filtro Período para escolher de 7 a 90 dias.',
    ],
    note: 'O sistema não registra quando uma rotina de fato acontece. Por isso não há cumprimento nem atraso.',
  },
  staff: {
    icon: UsersIcon,
    title: 'Efetivo',
    summary: 'Compara os policiais escalados com as movimentações registradas em cada turno.',
    shows: [
      { label: 'Escalados', text: 'Policiais escalados no turno.' },
      { label: 'Presentes e faltas', text: 'Quantos estavam presentes e quantos faltaram.' },
      { label: 'Movimentações', text: 'Saídas registradas dentro do turno.' },
      {
        label: 'Por policial presente',
        text: 'Movimentações divididas pelos policiais presentes.',
      },
    ],
    howItWorks: [
      'O turno diurno vai das 07h às 19h e o noturno das 19h às 07h do dia seguinte.',
      'Presença ainda não registrada conta como presente.',
      'Sem policiais presentes, a última coluna fica vazia.',
    ],
  },
  occupancy: {
    icon: BedDoubleIcon,
    title: 'Celas',
    summary: 'Histórico de quem já ocupou uma cela.',
    shows: [
      { label: 'Preso', text: 'Nome de quem ocupou a cela.' },
      {
        label: 'Entrada e saída',
        text: 'Quando o preso entrou e quando saiu. "Ocupa agora" indica que ainda está lá.',
      },
      { label: 'Motivo da saída', text: 'Troca, permuta, liberdade, transferência e outros.' },
    ],
    howItWorks: [
      'Escolha a galeria e depois a cela.',
      'As ocupações aparecem da mais recente para a mais antiga.',
    ],
  },
} satisfies Record<string, ReportHelp>;
