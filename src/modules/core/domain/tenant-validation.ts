import { z } from "zod";
import { MEMBER_ROLES } from "./roles";

/** URL-taugliches Kürzel aus einem Namen ("Müller & Söhne GmbH" → "mueller-soehne-gmbh"). */
export const slugify = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : `org-${slug || "neu"}`;
};

export const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Bitte gib einen ${label} ein.` })
    .max(120, { error: `Der ${label} darf höchstens 120 Zeichen lang sein.` });

export const tenantSchema = z.object({ name: requiredName("Namen") });

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Bitte gib eine gültige E-Mail-Adresse ein." })),
  role: z.enum(MEMBER_ROLES).refine((role) => role !== "owner", { error: "Owner können nicht eingeladen werden." }),
});

export const uuidSchema = z.uuid();

/** Einladungstoken: 24 zufällige Bytes als Hex. */
export const isInvitationToken = (token: string): boolean => /^[a-f0-9]{48}$/.test(token);
