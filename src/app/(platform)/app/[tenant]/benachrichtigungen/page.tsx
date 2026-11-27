import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { resolveTenantHref } from "@/modules/core/domain/notifications";
import {
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/core/server/actions/notification-actions";
import { listNotificationPreferences, listNotifications } from "@/modules/core/server/notifications";
import { loadTenantContext } from "@/modules/core/server/tenant-context";
import { NotificationPreferencesForm } from "@/modules/core/ui/admin/notification-preferences-form";

export const metadata: Metadata = { title: "Benachrichtigungen" };

const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

async function Notifications({ params }: Pick<PageProps<"/app/[tenant]/benachrichtigungen">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await loadTenantContext(decodeURIComponent(slug));
  const [notifications, preferences] = await Promise.all([listNotifications(tenant.id), listNotificationPreferences()]);
  const base = tenantBasePath(tenant.slug);
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <>
      <Section title="Eingang" description={unread === 0 ? "Alles gelesen." : `${unread} ungelesen`}>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <Button type="submit" variant="outline" size="sm">
              Alle als gelesen markieren
            </Button>
          </form>
        )}
        {notifications.length === 0 ? (
          <EmptyState title="Keine Benachrichtigungen">
            Hier erscheinen z. B. neue Mitglieder, Rollenänderungen und Teamzuordnungen.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {notifications.map((notification) => {
              const href = resolveTenantHref(base, notification.href);
              return (
                <li key={notification.id} className={cn("flex flex-wrap items-start gap-3 px-3 py-3", !notification.readAt && "bg-brand/5")}>
                  <span
                    aria-hidden
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.readAt ? "bg-transparent" : "bg-brand")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", !notification.readAt && "font-medium")}>
                      {!notification.readAt && <span className="sr-only">Ungelesen: </span>}
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {notification.title}
                        </Link>
                      ) : (
                        notification.title
                      )}
                    </p>
                    {notification.body && <p className="text-sm text-muted-foreground">{notification.body}</p>}
                    <time dateTime={notification.createdAt} className="text-xs text-muted-foreground">
                      {dateTime.format(new Date(notification.createdAt))}
                    </time>
                  </div>
                  <div className="flex gap-1">
                    {!notification.readAt && (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <Button type="submit" variant="ghost" size="sm" aria-label={`„${notification.title}“ als gelesen markieren`}>
                          Gelesen
                        </Button>
                      </form>
                    )}
                    <form action={deleteNotificationAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`„${notification.title}“ löschen`}>
                        Löschen
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Einstellungen" description="Wähle, worüber du informiert werden möchtest. Gilt für alle deine Unternehmen.">
        <NotificationPreferencesForm preferences={preferences} />
      </Section>
    </>
  );
}

export default function NotificationsPage({ params }: PageProps<"/app/[tenant]/benachrichtigungen">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title="Benachrichtigungen" description="Neuigkeiten aus deinem Unternehmen" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Benachrichtigungen werden geladen" />}>
        <Notifications params={params} />
      </Suspense>
    </div>
  );
}
