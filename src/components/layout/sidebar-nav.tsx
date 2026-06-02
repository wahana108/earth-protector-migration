'use client';

import {
  Home,
  Compass,
  FolderOpen,
  Award,
  PlusCircle,
  LayoutDashboard,
  RefreshCcw,
  ArrowLeftRight,
  SlidersHorizontal,
  ShieldAlert,
  CheckSquare,
  Layers,
  ShoppingBag,
  ClipboardCheck,
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

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/validate', label: 'Validate', icon: CheckSquare },
  { href: '/pool', label: 'Pool', icon: Layers },
  { href: '/create', label: 'Create', icon: PlusCircle },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/buyback', label: 'Buyback', icon: RefreshCcw },
  { href: '/buyback-requests', label: 'Permintaan Buyback', icon: ShoppingBag },
  { href: '/purchase-confirmations', label: 'Konfirmasi Penjualan', icon: ClipboardCheck },
  { href: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { href: '/top-developers', label: 'Developer Ranking', icon: Award },
  { href: '/parameters', label: 'Parameters', icon: SlidersHorizontal },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { isModerator } = useAuth();

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
          {isModerator && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith('/admin')}
                tooltip={{ children: 'Admin Tools' }}
              >
                <Link href="/admin">
                  <ShieldAlert />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
