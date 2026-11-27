import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/modules/core/domain/roles";
import { getInvitationPreview } from "@/modules/core/server/tenants";
import { AcceptInvitationForm } from "@/modules/core/ui/tenancy/accept-invitation-form";
import { getCurrentUser } from "@/modules/auth/server/session";

export const metadata: Metadata = { title: "Einladung", robots: { index: false } };

async function InvitationContent({ params }: Pick<PageProps<"/einladung/[token]">, "params">) {
  const { token } = await params;
  const user = await getCurrentUser();
  const nextPath = `/einladung/${token}`;

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Einladung zu NOVA</h1>
          <p className="text-sm text-muted-foreground">
            Melde dich an oder erstelle ein Konto mit der E-Mail-Adresse, an die die Einladung ging.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link href={`/registrieren?next=${encodeURIComponent(nextPath)}`}>Konto erstellen</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Anmelden</Link>
          </Button>
        </div>
      </div>
    );
  }

  const invitation = await getInvitationPreview(token);
  if (!invitation || invitation.status !== "pending") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Einladung nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          {invitation?.status === "accepted"
            ? "Diese Einladung wurde bereits angenommen."
            : "Diese Einladung ist ungültig oder abgelaufen. Bitte frage nach einer neuen Einladung."}
        </p>
        <Link href="/app" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Zur Übersicht
        </Link>
      </div>
    );
  }

  const emailMatches = invitation.email.toLowerCase() === user.email.toLowerCase();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Einladung zu „{invitation.tenantName}“</h1>
        <p className="text-sm text-muted-foreground">
          Rolle: <span className="font-medium text-foreground">{ROLE_LABELS[invitation.role]}</span> –{" "}
          {ROLE_DESCRIPTIONS[invitation.role]}
        </p>
      </div>
      {emailMatches ? (
        <AcceptInvitationForm token={token} />
      ) : (
        <p role="alert" className="rounded-md border border-negative/30 bg-negative/5 px-3 py-2 text-sm text-negative">
          Diese Einladung gilt für {invitation.email}. Du bist als {user.email} angemeldet. Bitte melde dich mit der
          eingeladenen Adresse an.
        </p>
      )}
    </div>
  );
}

export default function InvitationPage({ params }: PageProps<"/einladung/[token]">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xs">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Einladung wird geladen …</p>}>
          <InvitationContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}
