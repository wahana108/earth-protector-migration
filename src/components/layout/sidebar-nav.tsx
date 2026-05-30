'use client';

import {
  Home,
  Compass,
  FolderOpen,
  Award,
  Sparkles,
  Settings,
  HelpCircle,
  PlusCircle,
  LayoutDashboard,
  ShieldCheck,
  RefreshCcw,
  ArrowLeftRight,
  BadgeCheck,
  SlidersHorizontal,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { useAuth } from '@/hooks/use-auth';

const ADMIN_EMAIL = 'ramawan@live.com';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/parameters', label: 'Parameters', icon: SlidersHorizontal },
  { href: '/validated', label: 'Validated', icon: BadgeCheck },
  { href: '/create', label: 'Create', icon: PlusCircle },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/validation', label: 'Validation', icon: ShieldCheck },
  { href: '/buyback', label: 'Buyback', icon: RefreshCcw },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/top-developers', label: 'Developer Ranking', icon: Award },
  { href: '/recommendations', label: 'For You', icon: Sparkles },
];

const bottomNavItems = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={{ children: item.label }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/admin')}
                tooltip={{ children: 'Admin: Laporan' }}
              >
                <Link href="/admin/reports">
                  <ShieldAlert />
                  <span>Admin Reports</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <SidebarSeparator />
        <SidebarMenu>
          {bottomNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={{ children: item.label }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
