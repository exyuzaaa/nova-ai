import { CalendarClock, CheckCircle2, Circle, Mail, MessageSquareText, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACTIVITY_KIND_LABELS, type ActivityKind } from "../domain/crm";
import { completeActivityAction, deleteActivityAction } from "../server/actions/customer-actions";
import type { Activity } from "../server/customers";

const ICONS = { note: MessageSquareText, call: Phone, meeting: Users, email: Mail, task: CalendarClock } as const;

/** Verlauf mit Notizen, Anrufen, Terminen, E-Mails und Aufgaben (offene Aufgaben zuerst). */
export function ActivityFeed({
  tenantId,
  activities,
  memberNames,
  currentUserId,
  canEdit,
  canManage,
  timeZone,
}: {
  tenantId: string;
  activities: Activity[];
  memberNames: Map<string, string>;
  currentUserId: string;
  canEdit: boolean;
  canManage: boolean;
  timeZone: string;
}) {
  const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone });
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>;
  }
  return (
    <ol className="flex flex-col divide-y">
      {activities.map((activity) => {
        const kind = (activity.kind in ICONS ? activity.kind : "note") as ActivityKind;
        const Icon = ICONS[kind];
        const isTask = kind === "task";
        const overdue = activity.overdue;
        return (
          <li key={activity.id} className="flex gap-3 py-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", isTask && activity.doneAt && "text-muted-foreground line-through")}>
                <span className="sr-only">{ACTIVITY_KIND_LABELS[kind]}: </span>
                {activity.subject}
              </p>
              {activity.body && <p className="text-sm whitespace-pre-line text-muted-foreground">{activity.body}</p>}
              <p className="text-xs text-muted-foreground">
                {ACTIVITY_KIND_LABELS[kind]} · {dateTime.format(new Date(activity.createdAt))}
                {isTask && activity.dueAt && (
                  <span className={cn(overdue && "font-medium text-negative")}>
                    {" "}
                    · fällig {dateTime.format(new Date(activity.dueAt))}
                    {overdue && " (überfällig)"}
                  </span>
                )}
                {isTask && activity.assignedMemberId && <> · {memberNames.get(activity.assignedMemberId) ?? "Mitglied"}</>}
                {activity.doneAt && <> · erledigt</>}
              </p>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              {isTask && canEdit && (
                <form action={completeActivityAction}>
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="activityId" value={activity.id} />
                  {activity.doneAt && <input type="hidden" name="reopen" value="1" />}
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={activity.doneAt ? `„${activity.subject}“ wieder öffnen` : `„${activity.subject}“ als erledigt markieren`}
                  >
                    {activity.doneAt ? <CheckCircle2 className="size-4 text-positive" aria-hidden /> : <Circle className="size-4" aria-hidden />}
                  </Button>
                </form>
              )}
              {(canManage || (canEdit && activity.createdBy === currentUserId)) && (
                <form action={deleteActivityAction}>
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="activityId" value={activity.id} />
                  <Button type="submit" variant="ghost" size="sm" aria-label={`„${activity.subject}“ löschen`}>
                    Löschen
                  </Button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
