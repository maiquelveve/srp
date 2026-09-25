import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  FileClock,
  FileText,
  HelpCircle,
  HomeIcon,
  ListChecks,
  Settings,
  ShieldAlert,
  Signpost,
  Users,
} from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import type { RoleName } from '@/features/structure/types';
import { useAuth } from '@/hooks/useAuth';
import logoPpRs from '@/assets/logo-pp-rs.png';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import NavDocuments, { type NavDocumentsItem } from './components/NavDocuments';
import NavMain, { type NavMainItem } from './components/NavMain';
import NavSecondary, { type NavSecondaryItem } from './components/NavSecondary';
import NavUser from './components/NavUser';
import SiteHeader from './components/SiteHeader';

// US2–US6 (spec.md). Placeholder routes fall through to the App.tsx catch-all
// (NotFoundPage, tasks.md T034j-404page) until each story lands with a real
// page — research.md #18.
const NAV_ITEMS: NavMainItem[] = [
  { to: '/inicio', label: 'Início', icon: HomeIcon },
  { to: '/mapa-da-unidade', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/rotinas', label: 'Rotinas', icon: CalendarClock },
  { to: '/situacoes-definitivas', label: 'Situações definitivas', icon: FileClock, roles: ['WARDEN'] },
  { to: '/efetivo', label: 'Efetivo', icon: Users, roles: ['SUPERVISOR', 'WARDEN'] },
  { to: '/efetivo/postos', label: 'Postos de Serviço', icon: Signpost, roles: ['WARDEN'] },
];

// Illustrative — mirrors the shadcn "Documents" group; not all of these map
// to a documented user story (some are just placeholders, per user request).
const DOCUMENT_ITEMS: NavDocumentsItem[] = [
  { to: '/modelos-de-documento', label: 'Modelos de Documento', icon: FileText },
  { to: '/manuais-e-pops', label: 'Manuais e POPs', icon: BookOpen },
  { to: '/formularios', label: 'Formulários', icon: ListChecks },
];

const DOCUMENT_MORE_ITEMS: NavDocumentsItem[] = [
  {
    to: '/efetivo/configuracao-minima',
    label: 'Efetivo Mínimo',
    icon: Settings,
    roles: ['WARDEN'],
  },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['SUPERVISOR', 'WARDEN'] },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldAlert, roles: ['SUPERVISOR', 'WARDEN'] },
];

const SECONDARY_ITEMS: NavSecondaryItem[] = [
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/ajuda', label: 'Ajuda', icon: HelpCircle },
];

/**
 * Shared chrome for every authenticated screen — sidebar nav + top bar with
 * profile menu, built on the shadcn/ui Sidebar primitive (research.md #18).
 * Pages only render their own content via <Outlet />.
 */
export default function AppShell(): JSX.Element {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const visibleTo = <Item extends { roles?: RoleName[] }>(items: Item[]): Item[] =>
    items.filter((item) => !item.roles || (user !== null && item.roles.includes(user.role)));
  const pageTitle =
    pathname === '/perfil'
      ? 'Perfil'
      : ([...NAV_ITEMS, ...DOCUMENT_ITEMS, ...DOCUMENT_MORE_ITEMS, ...SECONDARY_ITEMS].find(
          (item) => item.to === pathname,
        )?.label ?? 'SRP');

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="!h-auto items-center justify-center gap-3 py-3"
              >
                <img src={logoPpRs} alt="Polícia Penal RS" className="h-12 w-auto shrink-0" />
                <span className="!whitespace-normal text-center text-base font-semibold leading-tight">
                  Sistema de Rotinas Penitenciárias
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={visibleTo(NAV_ITEMS)} />
          <NavDocuments
            label="Extras"
            items={visibleTo(DOCUMENT_ITEMS)}
            moreItems={visibleTo(DOCUMENT_MORE_ITEMS)}
          />
          <NavSecondary items={SECONDARY_ITEMS} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <SiteHeader title={pageTitle} />
        <main className="flex flex-1 flex-col overflow-y-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
