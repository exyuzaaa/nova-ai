"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TenantOption = { slug: string; name: string; roleLabel: string; suspended: boolean };

export function TenantSwitcher({ tenants, currentSlug }: { tenants: TenantOption[]; currentSlug: string }) {
  const current = tenants.find((tenant) => tenant.slug === currentSlug);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent focus-visible:outline-2"
        aria-label={`Unternehmen wechseln, aktuell ${current?.name ?? "unbekannt"}`}
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
        >
          {current?.name.charAt(0).toUpperCase() ?? "?"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{current?.name}</span>
          <span className="truncate text-xs text-muted-foreground">{current?.roleLabel}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Deine Unternehmen</DropdownMenuLabel>
        {tenants.map((tenant) => (
          <DropdownMenuItem key={tenant.slug} asChild>
            <Link href={`/app/${encodeURIComponent(tenant.slug)}`} className="flex items-center gap-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{tenant.name}</span>
                  {tenant.suspended && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      Gesperrt
                    </Badge>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{tenant.roleLabel}</span>
              </span>
              {tenant.slug === currentSlug && <Check className="size-4" aria-label="ausgewählt" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?neu=unternehmen" className="flex items-center gap-2">
            <Plus className="size-4" aria-hidden />
            Unternehmen anlegen
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
