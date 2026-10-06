import {
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  FileClock,
  HelpCircle,
  LibraryBig,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Signpost,
  UserCircle2,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ModuleInfo {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Omitido = qualquer perfil autenticado vê o módulo. */
  restrictedTo?: string;
}

interface RoleInfo {
  icon: LucideIcon;
  label: string;
  description: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

// Espelha os itens/roles de `AppShell` (NAV_ITEMS/DOCUMENT_ITEMS/DOCUMENT_MORE_ITEMS)
// — Formulários/Modelos de Documentos/Manuais viram um card só aqui, já que
// são a mesma feature (Biblioteca de Documentos) em três categorias fixas.
const MODULES: ModuleInfo[] = [
  {
    icon: ArrowLeftRight,
    title: 'Movimentações',
    description:
      'Mapa da unidade: entrada, saída, transferência de cela e troca de galeria dos presos.',
  },
  {
    icon: CalendarClock,
    title: 'Rotinas',
    description: 'Agenda e controla a execução das rotinas periódicas da unidade.',
  },
  {
    icon: FileClock,
    title: 'Situações Definitivas',
    description: 'Registra situações que encerram definitivamente a permanência de um preso.',
    restrictedTo: 'Chefia/Diretor',
  },
  {
    icon: Users,
    title: 'Efetivo',
    description: 'Acompanha a escala e a presença do efetivo nos postos de serviço.',
    restrictedTo: 'Supervisor e Chefia/Diretor',
  },
  {
    icon: Signpost,
    title: 'Postos de Serviço',
    description: 'Cadastro dos postos de serviço da unidade.',
    restrictedTo: 'Chefia/Diretor',
  },
  {
    icon: Settings,
    title: 'Efetivo Mínimo',
    description: 'Configura a lotação mínima exigida em cada posto de serviço.',
    restrictedTo: 'Chefia/Diretor',
  },
  {
    icon: LibraryBig,
    title: 'Biblioteca de Documentos',
    description:
      'Formulários, Modelos de Documentos e Manuais da unidade, cada um em sua própria tela, com busca e paginação. Qualquer perfil consulta e baixa.',
    restrictedTo: 'Envio e remoção: Supervisor e Chefia/Diretor',
  },
  {
    icon: UserCog,
    title: 'Administração de Usuários',
    description: 'Cadastro, edição, desativação/reativação e reset de senha de usuários.',
    restrictedTo: 'Chefia/Diretor',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    description: 'Relatórios operacionais da unidade.',
    restrictedTo: 'Supervisor e Chefia/Diretor',
  },
  {
    icon: ShieldAlert,
    title: 'Auditoria',
    description: 'Histórico de alterações registradas no sistema, para rastreabilidade.',
    restrictedTo: 'Supervisor e Chefia/Diretor',
  },
  {
    icon: UserCircle2,
    title: 'Perfil',
    description: 'Dados da própria conta e troca da própria senha.',
  },
  {
    icon: Settings,
    title: 'Configurações',
    description: 'Cadastro de Unidades, Galerias e Celas da estrutura física.',
    restrictedTo: 'Chefia/Diretor',
  },
];

// Labels idênticos a `features/users/labels.ts` (ROLE_LABEL) — o que cada
// perfil acessa vem direto de `AppShell` (roles por item de menu) e das
// regras de escrita já documentadas nos contracts da feature 002.
const ROLES: RoleInfo[] = [
  {
    icon: ShieldCheck,
    label: 'Policial Penal',
    description:
      'Acesso operacional do dia a dia: Início, Movimentações, Rotinas, consulta e download na Biblioteca de Documentos, e o próprio Perfil.',
  },
  {
    icon: ShieldCheck,
    label: 'Supervisor',
    description:
      'Tudo que o Policial Penal acessa, mais: Efetivo, Relatórios e Auditoria. Também pode enviar e remover documentos da Biblioteca.',
  },
  {
    icon: ShieldCheck,
    label: 'Chefia/Diretor',
    description:
      'Acesso completo: além de tudo acima, Situações Definitivas, Postos de Serviço, Efetivo Mínimo, Administração de Usuários e Configurações (Unidades/Galerias/Celas).',
  },
];

const FAQ: FaqItem[] = [
  {
    question: 'Esqueci minha senha, o que eu faço?',
    answer:
      'Fale com a Chefia/Diretor da sua unidade. Em Administração de Usuários existe a opção "Resetar senha", que gera uma senha temporária e envia por e-mail.',
  },
  {
    question: 'Como eu troco minha própria senha?',
    answer: 'Na tela Perfil, clique no ícone de engrenagem ao lado do seu nome.',
  },
  {
    question: 'Por que não vejo alguns itens no menu?',
    answer:
      'O menu muda conforme o seu perfil. Veja a seção "Perfis de usuário" acima para saber o que cada um acessa.',
  },
  {
    question: 'Quais formatos de arquivo posso enviar na Biblioteca de Documentos?',
    answer: 'PDF, DOCX, DOC ou TXT, até 10 MB por arquivo.',
  },
  {
    question: 'Quem pode enviar ou remover documentos da Biblioteca?',
    answer: 'Somente Supervisor e Chefia/Diretor. Qualquer perfil autenticado consulta e baixa.',
  },
  {
    question: 'Um documento foi removido da Biblioteca, dá para recuperar?',
    answer: 'Não — a remoção é definitiva. Confirme com atenção antes de remover.',
  },
];

function ModuleCard({ icon: Icon, title, description, restrictedTo }: ModuleInfo): JSX.Element {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base leading-tight">{title}</CardTitle>
          {restrictedTo && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {restrictedTo}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function RoleCard({ icon: Icon, label, description }: RoleInfo): JSX.Element {
  return (
    <Card className="h-full border-primary/30">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/50 bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

/**
 * "/ajuda" — tela estática de referência (pedido do usuário: explicar o que o
 * sistema faz, os módulos, os perfis de usuário e dúvidas frequentes, em
 * cards). Não tem dados de API nem estado — por isso mora em `pages/` (igual
 * HomePage/NotFoundPage), não em `features/`. Todo o conteúdo (módulos,
 * restrições por perfil, respostas do FAQ) foi conferido contra `AppShell`
 * (roles por item de menu) e as telas reais — nada inventado.
 */
export default function HelpPage(): JSX.Element {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Central de Ajuda</h1>
        <p className="text-sm text-muted-foreground">
          Um guia rápido de tudo que o Sistema de Rotinas Penitenciárias faz.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 pt-6">
          <HelpCircle className="size-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            O SRP centraliza o controle diário de uma unidade prisional: movimentação de presos,
            rotinas, efetivo, postos de serviço, documentos institucionais e os relatórios e
            registros de auditoria que apoiam a gestão. O que aparece no menu lateral muda
            conforme o seu perfil de acesso.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Módulos do sistema</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => (
            <ModuleCard key={module.title} {...module} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Perfis de usuário</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ROLES.map((role) => (
            <RoleCard key={role.label} {...role} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Perguntas frequentes</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FAQ.map((item) => (
            <Card key={item.question}>
              <CardHeader>
                <CardTitle className="text-sm">{item.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.answer}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
