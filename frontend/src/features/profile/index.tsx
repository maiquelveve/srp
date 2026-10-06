import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRightIcon,
  BriefcaseIcon,
  Building2Icon,
  CalendarClockIcon,
  CheckIcon,
  FingerprintIcon,
  LayoutGridIcon,
  MailIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SignpostIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { structureApi } from '@/features/structure/api';
import type { RoleName } from '@/features/structure/types';
import { useAuth } from '@/hooks/useAuth';
import ChangePasswordDialog from './components/ChangePasswordDialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<RoleName, string> = {
  PRISON_OFFICER: 'Policial Penal',
  SUPERVISOR: 'Supervisor',
  WARDEN: 'Chefia/Diretor',
};

/** Módulos já em uso e quem acessa cada um (a API continua sendo quem autoriza de fato). */
const MODULES: { label: string; description: string; icon: LucideIcon; roles?: RoleName[] }[] = [
  {
    label: 'Movimentações',
    description: 'Mapa da unidade e movimentação de presos',
    icon: ArrowLeftRightIcon,
  },
  { label: 'Rotinas', description: 'Rotinas operacionais por galeria', icon: CalendarClockIcon },
  {
    label: 'Efetivo',
    description: 'Escalas, presença e efetivo por posto',
    icon: UsersIcon,
    roles: ['SUPERVISOR', 'WARDEN'],
  },
  {
    label: 'Postos de Serviço',
    description: 'Cadastro dos postos da unidade',
    icon: SignpostIcon,
    roles: ['WARDEN'],
  },
  {
    label: 'Efetivo Mínimo',
    description: 'Configuração do mínimo por posto e turno',
    icon: SettingsIcon,
    roles: ['WARDEN'],
  },
];

type Section = 'overview' | 'units' | 'access';

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutGridIcon },
  { id: 'units', label: 'Lotação', icon: Building2Icon },
  { id: 'access', label: 'Acessos', icon: ShieldCheckIcon },
];

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

/** Rótulo pequeno em maiúsculas com fonte monoespaçada, usado como "sobretítulo". */
function Eyebrow({ children }: { children: string }): JSX.Element {
  return (
    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="grid gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-md border border-border bg-muted/50 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="grid gap-1">
          <Eyebrow>{label}</Eyebrow>
          <span className="text-base font-semibold">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function UnitsList({ names, loading }: { names: string[]; loading: boolean }): JSX.Element {
  if (loading) return <Skeleton className="h-8 w-64" />;
  if (names.length === 0) {
    return <span className="text-sm text-muted-foreground">Não informado</span>;
  }
  return (
    <ul className="grid">
      {names.map((name) => (
        <li
          key={name}
          className="flex items-center gap-3 border-b border-border py-3 text-sm first:pt-0 last:border-b-0 last:pb-0"
        >
          <Building2Icon className="size-4 shrink-0 text-primary" />
          {name}
        </li>
      ))}
    </ul>
  );
}

/**
 * Perfil do usuário logado, somente leitura (mesmos dados da `ProfileScreen` do mobile).
 * Coluna lateral com identidade e seções (Visão geral, Lotação, Acessos) e conteúdo ao lado.
 * A engrenagem abre `ChangePasswordDialog` (FR-016/FR-017) — único ponto de edição
 * disponível aqui por ora; os demais dados continuam somente leitura.
 */
export default function ProfilePage(): JSX.Element {
  const { user } = useAuth();
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const [section, setSection] = useState<Section>('overview');

  if (!user) return <></>;

  const unitNames = (unitsQuery.data?.data ?? [])
    .filter((unit) => user.units.includes(unit.id))
    .map((unit) => unit.name);
  const modules = MODULES.filter((module) => !module.roles || module.roles.includes(user.role));
  const current = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  return (
    <div className="grid flex-1 md:grid-cols-[280px_1fr]">
      <aside className="grid content-start gap-5 border-b border-border p-6 md:border-b-0 md:border-r">
        <span className="flex items-center gap-2 text-primary">
          <UserRoundIcon className="size-4" />
          <Eyebrow>Perfil</Eyebrow>
        </span>

        <Avatar className="mx-auto size-20 rounded-full ring-2 ring-primary ring-offset-4 ring-offset-background">
          <AvatarFallback className="rounded-full bg-accent text-2xl font-bold text-primary">
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>

        <div className="grid justify-items-center gap-2 text-center">
          <h1 className="text-xl font-semibold leading-tight">{user.name}</h1>
          <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <MailIcon className="size-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </span>
        </div>

        <Badge className="mx-auto w-fit bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary">
          {user.jobTitle ?? ROLE_LABEL[user.role]}
        </Badge>

        <Separator />

        <nav className="grid gap-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-left text-sm transition-colors',
                section === id
                  ? 'border-primary bg-accent font-medium text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="grid content-start gap-6 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-3">
            <Eyebrow>{current.label}</Eyebrow>
            <h2 className="text-3xl font-light">
              {section === 'overview' && 'Dados do perfil'}
              {section === 'units' && 'Unidades de atuação'}
              {section === 'access' && 'O que o seu perfil acessa'}
            </h2>
          </div>
          <ChangePasswordDialog />
        </div>

        {section === 'overview' && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoCard
                icon={FingerprintIcon}
                label="Matrícula"
                value={user.badgeNumber ?? 'Não informado'}
              />
              <InfoCard
                icon={BriefcaseIcon}
                label="Cargo"
                value={user.jobTitle ?? 'Não informado'}
              />
              <InfoCard icon={ShieldCheckIcon} label="Permissão" value={ROLE_LABEL[user.role]} />
            </div>
            <Card>
              <CardContent className="grid gap-4 p-5">
                <span className="flex items-center gap-2">
                  <Building2Icon className="size-4 text-primary" />
                  <Eyebrow>Lotação</Eyebrow>
                </span>
                <UnitsList names={unitNames} loading={unitsQuery.isLoading} />
              </CardContent>
            </Card>
          </>
        )}

        {section === 'units' && (
          <Card>
            <CardContent className="p-5">
              <UnitsList names={unitNames} loading={unitsQuery.isLoading} />
            </CardContent>
          </Card>
        )}

        {section === 'access' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map(({ label, description, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <span className="font-semibold">{label}</span>
                    <span className="text-sm text-muted-foreground">{description}</span>
                  </div>
                  <CheckIcon className="size-4 shrink-0 text-success" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
