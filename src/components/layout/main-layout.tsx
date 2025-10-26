'use client';
import React from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppHeader } from './header';
import { SidebarNav } from './sidebar-nav';
import { useIsMobile } from '@/hooks/use-mobile';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    if (isMobile) {
      setOpen(false);
    } else {
        // A real app might read this from cookies
        setOpen(true);
    }
  }, [isMobile]);

  return (
    <SidebarProvider defaultOpen={true} open={open} onOpenChange={setOpen}>
      <div className="min-h-screen">
        <Sidebar>
          <SidebarNav />
        </Sidebar>
        <SidebarInset>
          <AppHeader />
          <main className="min-h-[calc(100vh-var(--header-height))] p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
