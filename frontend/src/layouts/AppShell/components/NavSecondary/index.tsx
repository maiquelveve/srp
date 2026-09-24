import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export interface NavSecondaryItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Pinned to the bottom of the sidebar content (via `mt-auto` on the group)
 * — utility items (Settings, Help).
 */
export default function NavSecondary({
  items,
  className,
}: {
  items: NavSecondaryItem[];
  className?: string;
}): JSX.Element {
  const { pathname } = useLocation();

  return (
    <SidebarGroup className={className}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ to, label, icon: Icon }) => {
            const isActive = pathname === to;
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
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
