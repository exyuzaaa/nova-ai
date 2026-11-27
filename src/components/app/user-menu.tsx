import { LogOut } from "lucide-react";
import { signOutAction } from "@/modules/auth/server/actions";

/** Angemeldete Person und Abmelden (Server Action, kein Client-JavaScript nötig). */
export function UserMenu({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-1">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium uppercase"
      >
        {email.charAt(0)}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
        {email}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Abmelden"
          title="Abmelden"
        >
          <LogOut className="size-3.5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
