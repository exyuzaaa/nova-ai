"use client";

import { Fragment } from "react";
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

export type SiteOption = {
  id: string;
  name: string;
  domain: string;
  isDemo: boolean;
  organizationName: string;
};

export function SiteSwitcher({
  sites,
  currentId,
  canAddWebsite,
}: {
  sites: SiteOption[];
  currentId: string;
  canAddWebsite: boolean;
}) {
  const current = sites.find((site) => site.id === currentId);
  const groups = new Map<string, SiteOption[]>();
  for (const site of sites) groups.set(site.organizationName, [...(groups.get(site.organizationName) ?? []), site]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent focus-visible:outline-2"
        aria-label={`Website wechseln, aktuell ${current?.name ?? "unbekannt"}`}
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
        >
          {current?.name.charAt(0).toUpperCase() ?? "?"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{current?.name}</span>
            {current?.isDemo && (
              <Badge variant="outline" className="h-4 px-1 text-[10px] font-medium">
                Demo
              </Badge>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">{current?.domain}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {Array.from(groups, ([organizationName, organizationSites], index) => (
          <Fragment key={organizationName}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">{organizationName}</DropdownMenuLabel>
            {organizationSites.map((site) => (
              <DropdownMenuItem key={site.id} asChild>
                <Link href={`/analytics/${site.id}`} className="flex items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{site.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{site.domain}</span>
                  </span>
                  {site.id === currentId && <Check className="size-4" aria-label="ausgewählt" />}
                </Link>
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
        {canAddWebsite && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding?neu=website" className="flex items-center gap-2">
                <Plus className="size-4" aria-hidden />
                Website hinzufügen
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
