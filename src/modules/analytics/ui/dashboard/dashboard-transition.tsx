"use client";

import { createContext, useContext, useTransition, type TransitionStartFunction } from "react";
import { cn } from "@/lib/utils";

type TransitionState = { isPending: boolean; startTransition: TransitionStartFunction };

const DashboardTransitionContext = createContext<TransitionState | null>(null);

/** Teilt den Ladezustand zwischen Filterleiste und Inhalt („Refetch keeps the frame“). */
export function DashboardTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <DashboardTransitionContext.Provider value={{ isPending, startTransition }}>
      {children}
    </DashboardTransitionContext.Provider>
  );
}

export const useDashboardTransition = (): TransitionState => {
  const context = useContext(DashboardTransitionContext);
  if (!context) throw new Error("useDashboardTransition außerhalb des DashboardTransitionProvider");
  return context;
};

/** Behält die bisherige Darstellung beim Nachladen, gedimmt statt Skeleton-Sprung. */
export function PendingFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isPending } = useDashboardTransition();
  return (
    <div
      aria-busy={isPending}
      className={cn("transition-opacity duration-200", isPending && "pointer-events-none opacity-60", className)}
    >
      {children}
    </div>
  );
}
