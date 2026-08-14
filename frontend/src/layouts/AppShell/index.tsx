import {
  ArrowLeftRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  HomeIcon,
  LayoutGrid,
  ListChecks,
  MapPin,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
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
  { to: '/mapa-da-unidade', label: 'Mapa da Unidade', icon: LayoutGrid },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/situacoes-definitivas', label: 'Situações Definitivas', icon: CheckCircle2 },
  { to: '/rotinas', label: 'Rotinas', icon: CalendarClock },
  { to: '/efetivo', label: 'Efetivo', icon: Users },
  { to: '/relatorios-e-auditoria', label: 'Relatórios e Auditoria', icon: ClipboardList },
];

// Illustrative — mirrors the shadcn "Documents" group; not all of these map
// to a documented user story (some are just placeholders, per user request).
const DOCUMENT_ITEMS: NavDocumentsItem[] = [
  { to: '/modelos-de-documento', label: 'Modelos de Documento', icon: FileText },
  { to: '/manuais-e-pops', label: 'Manuais e POPs', icon: BookOpen },
  { to: '/formularios', label: 'Formulários', icon: ListChecks },
];

const DOCUMENT_MORE_ITEMS: NavDocumentsItem[] = [
  { to: '/efetivo/configuracao-minima', label: 'Efetivo Mínimo', icon: Settings },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldAlert },
  { to: '/historico-localizacao', label: 'Histórico de Localização', icon: MapPin },
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
  const pageTitle =
    [...NAV_ITEMS, ...DOCUMENT_ITEMS, ...DOCUMENT_MORE_ITEMS, ...SECONDARY_ITEMS].find(
      (item) => item.to === pathname,
    )?.label ?? 'SRP';

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="!h-auto items-center justify-center gap-3 py-3">
                <img src={logoPpRs} alt="Polícia Penal RS" className="h-12 w-auto shrink-0" />
                <span className="!whitespace-normal text-center text-base font-semibold leading-tight">
                  Sistema de Rotinas Penitenciárias
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={NAV_ITEMS} />
          <NavDocuments label="Documentos" items={DOCUMENT_ITEMS} moreItems={DOCUMENT_MORE_ITEMS} />
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
