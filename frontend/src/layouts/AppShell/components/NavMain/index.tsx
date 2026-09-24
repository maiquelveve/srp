import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import type { RoleName } from '@/features/structure/types';
import { cn } from '@/lib/utils';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export interface NavMainItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Perfis que veem o item; omitido = todos. A API continua sendo quem autoriza de fato. */
  roles?: RoleName[];
}

/**
 * Active item is derived from the current URL (useLocation), not passed in
 * by the page rendering inside <Outlet /> — research.md #18.
 */
export default function NavMain({ items }: { items: NavMainItem[] }): JSX.Element {
  const { pathname } = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map(({ to, label, icon: Icon }) => {
            const isActive = pathname === to;
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={label}
                  className={cn(
                    isActive &&
                      '!bg-primary !text-primary-foreground hover:!bg-primary/90 hover:!text-primary-foreground',
                  )}
                >
                  <NavLink to={to}>
                    <Icon />
                    <span>{label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
