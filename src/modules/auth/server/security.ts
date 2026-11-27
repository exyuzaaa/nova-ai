import "server-only";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { parseUserAgent } from "@/modules/analytics/domain/user-agent";

export type SecondFactor = { id: string; name: string; verified: boolean; createdAt: string };

export type MfaStatus = {
  factors: SecondFactor[];
  currentLevel: string | null;
  nextLevel: string | null;
};

/** Eingerichtete Faktoren (nur TOTP) und Sicherheitsstufe der aktuellen Sitzung. */
export const getMfaStatus = async (): Promise<MfaStatus> => {
  const supabase = await createSupabaseServerClient();
  const [factors, level] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (factors.error) throw factors.error;
  return {
    factors: (factors.data?.all ?? [])
      .filter((factor) => factor.factor_type === "totp")
      .map((factor) => ({
        id: factor.id,
        name: factor.friendly_name ?? "Authenticator-App",
        verified: factor.status === "verified",
        createdAt: factor.created_at,
      })),
    currentLevel: level.data?.currentLevel ?? null,
    nextLevel: level.data?.nextLevel ?? null,
  };
};

export type DeviceSession = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  device: string;
  ip: string | null;
  withSecondFactor: boolean;
  isCurrent: boolean;
};

const DEVICE_LABELS = { desktop: "Computer", mobile: "Smartphone", tablet: "Tablet", other: "Gerät" } as const;

/** Angemeldete Geräte der Person (aus auth.sessions, nur eigene). */
export const listMySessions = async (): Promise<DeviceSession[]> => {
  const { data, error } = await coreSchema(await createSupabaseServerClient()).rpc("my_sessions");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const agent = parseUserAgent(row.user_agent ?? "");
    const parts = [agent.browser, agent.os].filter((part) => part && part !== "Sonstige");
    return {
      id: row.id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      device: `${DEVICE_LABELS[agent.deviceType]}${parts.length > 0 ? ` · ${parts.join(" auf ")}` : ""}`,
      ip: row.ip,
      withSecondFactor: row.aal === "aal2",
      isCurrent: row.is_current,
    };
  });
};
