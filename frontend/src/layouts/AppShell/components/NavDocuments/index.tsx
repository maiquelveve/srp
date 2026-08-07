import { useState } from 'react';
import { MoreHorizontalIcon, type LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

export interface NavDocumentsItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

function DocumentItem({ to, label, icon: Icon, isActive }: NavDocumentsItem & { isActive: boolean }): JSX.Element {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          isActive && '!bg-primary !text-primary-foreground hover:!bg-primary/90 hover:!text-primary-foreground',
        )}
      >
        <NavLink to={to}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Mirrors the shadcn `dashboard-01` "Documents" group — label + items —
 * used here for placeholder content (some items map to genuine US2–US6
 * sub-features, some are just illustrative). The expandable "Mais..."
 * mechanic lives here (via Radix Collapsible, curtain-style height
 * animation), not in NavMain, so the primary nav stays a plain, real-looking
 * list — research.md #18.
 */
export default function NavDocuments({
  label,
  items,
  moreItems = [],
}: {
  label: string;
  items: NavDocumentsItem[];
  moreItems?: NavDocumentsItem[];
}): JSX.Element {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <DocumentItem key={item.to} {...item} isActive={pathname === item.to} />
        ))}
        {moreItems.length > 0 && (
          <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
            <SidebarMenuItem>
              <CollapsibleContent asChild>
                <ul className="flex flex-col gap-1 overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                  {moreItems.map((item) => (
                    <DocumentItem key={item.to} {...item} isActive={pathname === item.to} />
                  ))}
                </ul>
              </CollapsibleContent>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="cursor-pointer text-sidebar-foreground/70 transition-[font-size] duration-150 hover:bg-transparent hover:text-[15px] hover:text-sidebar-foreground/70 active:bg-transparent active:text-sidebar-foreground/70">
                  <MoreHorizontalIcon className="text-sidebar-foreground/70" />
                  <span>{expanded ? 'Mostrar menos' : 'Mostrar mais'}</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
          </Collapsible>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
