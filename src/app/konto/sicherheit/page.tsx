import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { getMfaStatus, listMySessions } from "@/modules/auth/server/security";
import { requireUser } from "@/modules/auth/server/session";
import { EnrollTotpForm, RemoveFactorButton, RevokeSessionButton, SignOutOthersButton } from "@/modules/auth/ui/security-forms";

export const metadata: Metadata = { title: "Sicherheit" };

const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

async function Security() {
  const user = await requireUser("/konto/sicherheit");
  const [mfa, sessions] = await Promise.all([getMfaStatus(), listMySessions()]);
  const verified = mfa.factors.filter((factor) => factor.verified);
  const others = sessions.filter((session) => !session.isCurrent);

  return (
    <>
      <Section
        title="Zwei-Faktor-Anmeldung"
        description="Zusätzlich zum Passwort fragt NOVA beim Anmelden nach einem Code aus einer Authenticator-App. Ein gestohlenes Passwort allein reicht dann nicht."
      >
        {verified.length > 0 ? (
          <>
            <p className="flex items-center gap-2 text-sm">
              <Badge className="h-5 text-[11px]">Aktiv</Badge>
              Deine Anmeldung ist mit einem zweiten Faktor geschützt.
            </p>
            <ul className="flex flex-col divide-y rounded-lg border">
              {verified.map((factor) => (
                <li key={factor.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    {factor.name}
                    <span className="block text-xs text-muted-foreground">
                      eingerichtet am {dateTime.format(new Date(factor.createdAt))}
                    </span>
                  </span>
                  <RemoveFactorButton factorId={factor.id} name={factor.name} />
                </li>
              ))}
            </ul>
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">Ersatzgerät hinzufügen</summary>
              <p className="mt-2 mb-3 text-sm text-muted-foreground">
                Es gibt keine Wiederherstellungscodes. Richte ein zweites Gerät oder eine zweite App ein, damit du dich
                auch bei Verlust deines Telefons anmelden kannst.
              </p>
              <EnrollTotpForm />
            </details>
          </>
        ) : (
          <EnrollTotpForm />
        )}
      </Section>

      <Section title="Angemeldete Geräte" description="Hier bist du gerade angemeldet. Unbekannte Geräte kannst du sofort abmelden.">
        <ul className="flex flex-col divide-y rounded-lg border">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {session.device}
                  {session.isCurrent && (
                    <Badge variant="outline" className="h-5 text-[11px]">
                      Dieses Gerät
                    </Badge>
                  )}
                  {session.withSecondFactor && (
                    <Badge variant="outline" className="h-5 text-[11px]">
                      Mit zweitem Faktor
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.ip ? `IP ${session.ip} · ` : ""}zuletzt aktiv {dateTime.format(new Date(session.lastSeenAt))} · angemeldet seit{" "}
                  {dateTime.format(new Date(session.createdAt))}
                </p>
              </div>
              {!session.isCurrent && <RevokeSessionButton sessionId={session.id} label={session.device} />}
            </li>
          ))}
        </ul>
        {others.length > 0 && <SignOutOthersButton />}
      </Section>

      <Section title="Passwort" description={`Angemeldet als ${user.email}`}>
        <div>
          <Link href="/passwort-neu" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            Passwort ändern
          </Link>
        </div>
      </Section>
    </>
  );
}

export default function SecurityPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title="Sicherheit" description="Zwei-Faktor-Anmeldung, Geräte und Passwort" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Sicherheit wird geladen" />}>
        <Security />
      </Suspense>
    </div>
  );
}
