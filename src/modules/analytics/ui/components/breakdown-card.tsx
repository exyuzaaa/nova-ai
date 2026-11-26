"use client";

import { useId } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BreakdownData } from "../../server/queries/dashboard-types";
import { BreakdownTable } from "./breakdown-table";

export type BreakdownTab = {
  value: string;
  label: string;
  dimensionLabel: string;
  data: BreakdownData;
  mono?: boolean;
};

/** Karte mit einer oder mehreren Aufschlüsselungen (Tabs nur, wenn mehr als eine). */
export function BreakdownCard({
  title,
  tabs,
  header,
}: {
  title: string;
  tabs: BreakdownTab[];
  header?: React.ReactNode;
}) {
  const titleId = useId();
  const single = tabs.length === 1;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <Tabs defaultValue={tabs[0].value} className="gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={titleId} className="text-sm font-medium">
            {title}
          </h2>
          {!single && (
            <TabsList aria-label={`${title}: Ansicht wählen`}>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="px-2 text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
        </header>
        {header}
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <BreakdownTable data={tab.data} dimensionLabel={tab.dimensionLabel} mono={tab.mono} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
