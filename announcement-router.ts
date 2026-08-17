import { z } from "zod";
import { createRouter, publicQuery, adminPermQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { announcements, announcementSettings, type Announcement, type AnnouncementSetting } from "@db/schema";
import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logAudit } from "./lib/activity";
import {
  ANNOUNCEMENT_COLOR_VALUES,
  ANNOUNCEMENT_DISPLAY_MODES,
  ANNOUNCEMENT_DIRECTIONS,
  ANNOUNCEMENT_PAGES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_SPEEDS,
  ANNOUNCEMENT_VISIBILITY,
  DEFAULT_ANNOUNCEMENT_MESSAGE,
  DEFAULT_ANNOUNCEMENT_SETTINGS,
  announcementDisplayStatus,
  isAnnouncementLive,
} from "@contracts/announcements";

const priorityKeys = ANNOUNCEMENT_PRIORITIES.map((p) => p.key) as [string, ...string[]];
const displayModeKeys = ANNOUNCEMENT_DISPLAY_MODES.map((d) => d.key) as [string, ...string[]];
const speedKeys = ANNOUNCEMENT_SPEEDS.map((s) => s.key) as [string, ...string[]];
const directionKeys = ANNOUNCEMENT_DIRECTIONS.map((d) => d.key) as [string, ...string[]];
const visibilityKeys = ANNOUNCEMENT_VISIBILITY.map((v) => v.key) as [string, ...string[]];
const pagePaths: string[] = ANNOUNCEMENT_PAGES.map((p) => p.path);

const themeColor = z
  .string()
  .refine((v) => ANNOUNCEMENT_COLOR_VALUES.includes(v), { message: "Color must be one of the approved theme colors" });

const selectedPagesSchema = z
  .array(z.string())
  .max(pagePaths.length)
  .refine((arr) => arr.every((p) => pagePaths.includes(p)), { message: "Unknown page in selection" });

const announcementInput = z.object({
  title: z.string().max(255).optional().nullable(),
  message: z.string().min(1, "Message is required").max(2000),
  priority: z.enum(priorityKeys).default("normal"),
  action: z.enum(["draft", "publish", "schedule"]),
  startAt: z.date().optional().nullable(),
  endAt: z.date().optional().nullable(),
});

const settingsInput = z.object({
  displayMode: z.enum(displayModeKeys),
  singleAnnouncementId: z.number().optional().nullable(),
  speed: z.enum(speedKeys),
  direction: z.enum(directionKeys),
  pauseOnHover: z.enum(["yes", "no"]),
  autoRepeat: z.enum(["yes", "no"]),
  bgColor: themeColor,
  textColor: themeColor,
  visibility: z.enum(visibilityKeys),
  selectedPages: selectedPagesSchema,
});

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** Ensure the single settings row exists; on first creation also seed the
 *  default announcement so the bar looks exactly like it did before. */
async function ensureSettings(db: ReturnType<typeof getDb>): Promise<AnnouncementSetting> {
  const rows = await db.select().from(announcementSettings).limit(1);
  if (rows.length > 0) return rows[0];

  const [inserted] = await db
    .insert(announcementSettings)
    .values({
      displayMode: DEFAULT_ANNOUNCEMENT_SETTINGS.displayMode,
      speed: DEFAULT_ANNOUNCEMENT_SETTINGS.speed,
      direction: DEFAULT_ANNOUNCEMENT_SETTINGS.direction,
      pauseOnHover: DEFAULT_ANNOUNCEMENT_SETTINGS.pauseOnHover,
      autoRepeat: DEFAULT_ANNOUNCEMENT_SETTINGS.autoRepeat,
      bgColor: DEFAULT_ANNOUNCEMENT_SETTINGS.bgColor,
      textColor: DEFAULT_ANNOUNCEMENT_SETTINGS.textColor,
      visibility: DEFAULT_ANNOUNCEMENT_SETTINGS.visibility,
      selectedPages: JSON.stringify(DEFAULT_ANNOUNCEMENT_SETTINGS.selectedPages),
    })
    .$returningId();

  // First run: keep the website looking identical by publishing the old bar text
  const existing = await db.select().from(announcements).limit(1);
  if (existing.length === 0) {
    await db.insert(announcements).values({
      title: "Social Media Listings",
      message: DEFAULT_ANNOUNCEMENT_MESSAGE,
      priority: "normal",
      status: "active",
      createdByName: "System",
    });
  }

  const created = await db.select().from(announcementSettings).where(eq(announcementSettings.id, inserted.id)).limit(1);
  return created[0];
}

function parsePages(json: string | null): string[] {
  try {
    const parsed = JSON.parse(json ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function sanitizeSettings(s: AnnouncementSetting) {
  return {
    displayMode: s.displayMode,
    singleAnnouncementId: s.singleAnnouncementId,
    speed: s.speed,
    direction: s.direction,
    pauseOnHover: s.pauseOnHover,
    autoRepeat: s.autoRepeat,
    bgColor: s.bgColor,
    textColor: s.textColor,
    visibility: s.visibility,
    selectedPages: parsePages(s.selectedPages),
    updatedAt: s.updatedAt,
  };
}

function sanitizeAnnouncement(a: Announcement) {
  return { ...a, displayStatus: announcementDisplayStatus(a) };
}

function statusFromAction(action: "draft" | "publish" | "schedule", startAt: Date | null | undefined) {
  if (action === "publish") return { status: "active" as const, startAt: null };
  if (action === "schedule") return { status: "scheduled" as const, startAt: startAt ?? null };
  return { status: "draft" as const, startAt: null };
}

function describeChanges(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of Object.keys(after)) {
    const b = before[key];
    const a = after[key];
    const bs = b instanceof Date ? b.toISOString() : String(b ?? "—");
    const as = a instanceof Date ? a.toISOString() : String(a ?? "—");
    if (bs !== as) parts.push(`${key}: "${bs}" → "${as}"`);
  }
  return parts.length > 0 ? parts.join("; ") : "no field changes";
}

export const announcementRouter = createRouter({
  // ── Public: what the website bar renders ──────────────────────────
  publicBar: publicQuery.query(async () => {
    const db = getDb();
    const settings = await ensureSettings(db);
    const now = new Date();

    // Read-time filtering decides what shows; no writes needed here.
    const all = await db.select().from(announcements).orderBy(asc(announcements.createdAt));
    let live = all.filter((a) => isAnnouncementLive(a, now));

    if (settings.displayMode === "single" && settings.singleAnnouncementId != null) {
      const chosen = live.find((a) => a.id === settings.singleAnnouncementId);
      live = chosen ? [chosen] : [];
    }

    live.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2) || b.createdAt.getTime() - a.createdAt.getTime());

    return {
      settings: sanitizeSettings(settings),
      announcements: live.map((a) => ({ id: a.id, title: a.title, message: a.message, priority: a.priority })),
    };
  }),

  // ── Admin: list everything ────────────────────────────────────────
  list: adminPermQuery("announcements").query(async () => {
    const db = getDb();
    const now = new Date();
    const rows = await db.select().from(announcements).orderBy(asc(announcements.createdAt));

    // Lazily mark expired rows so the stored status stays honest
    for (const row of rows) {
      if ((row.status === "active" || row.status === "scheduled") && row.endAt && new Date(row.endAt) <= now) {
        await db.update(announcements).set({ status: "expired" }).where(eq(announcements.id, row.id));
        row.status = "expired";
      }
    }

    return rows.map(sanitizeAnnouncement).reverse(); // newest first
  }),

  getSettings: adminPermQuery("announcements").query(async () => {
    const db = getDb();
    return sanitizeSettings(await ensureSettings(db));
  }),

  // ── Admin: create ─────────────────────────────────────────────────
  create: adminPermQuery("announcements")
    .input(announcementInput)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { status, startAt } = statusFromAction(input.action, input.startAt);
      if (input.action === "schedule" && !startAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A start date is required to schedule an announcement" });
      }

      const [row] = await db
        .insert(announcements)
        .values({
          title: input.title?.trim() || null,
          message: input.message.trim(),
          priority: input.priority as Announcement["priority"],
          status,
          startAt,
          endAt: input.endAt ?? null,
          createdById: ctx.admin.id,
          createdByName: ctx.admin.displayName,
        })
        .$returningId();

      const label = input.title?.trim() || input.message.slice(0, 60);
      const actionWord = input.action === "publish" ? "announcement_published" : input.action === "schedule" ? "announcement_scheduled" : "announcement_created";
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        actionWord,
        `${input.action === "publish" ? "Published" : input.action === "schedule" ? "Scheduled" : "Created draft"} announcement "${label}"${startAt ? ` (starts ${startAt.toISOString()})` : ""}${input.endAt ? ` (ends ${input.endAt.toISOString()})` : ""}`,
        ctx.req.headers
      );

      const created = await db.select().from(announcements).where(eq(announcements.id, row.id)).limit(1);
      return sanitizeAnnouncement(created[0]);
    }),

  // ── Admin: edit ───────────────────────────────────────────────────
  update: adminPermQuery("announcements")
    .input(announcementInput.extend({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(announcements).where(eq(announcements.id, input.id)).limit(1);
      const before = existing[0];
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });

      const { status, startAt } = statusFromAction(input.action, input.startAt);
      if (input.action === "schedule" && !startAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A start date is required to schedule an announcement" });
      }

      const values = {
        title: input.title?.trim() || null,
        message: input.message.trim(),
        priority: input.priority as Announcement["priority"],
        status,
        startAt,
        endAt: input.endAt ?? null,
      };
      await db.update(announcements).set(values).where(eq(announcements.id, input.id));

      const label = values.title || values.message.slice(0, 60);
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "announcement_updated",
        `Updated announcement "${label}" — ${describeChanges(
          { title: before.title, message: before.message, priority: before.priority, status: before.status, startAt: before.startAt, endAt: before.endAt },
          values
        )}`,
        ctx.req.headers
      );

      const updated = await db.select().from(announcements).where(eq(announcements.id, input.id)).limit(1);
      return sanitizeAnnouncement(updated[0]);
    }),

  // ── Admin: quick activate / deactivate ────────────────────────────
  setActive: adminPermQuery("announcements")
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(announcements).where(eq(announcements.id, input.id)).limit(1);
      const before = existing[0];
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });

      const next = input.active ? "active" : "draft";
      await db
        .update(announcements)
        .set({ status: next, ...(input.active ? { startAt: null } : {}) })
        .where(eq(announcements.id, input.id));

      const label = before.title || before.message.slice(0, 60);
      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        input.active ? "announcement_activated" : "announcement_deactivated",
        `${input.active ? "Activated" : "Deactivated"} announcement "${label}" (status: ${before.status} → ${next})`,
        ctx.req.headers
      );
      return { success: true };
    }),

  // ── Admin: delete ─────────────────────────────────────────────────
  delete: adminPermQuery("announcements")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.select().from(announcements).where(eq(announcements.id, input.id)).limit(1);
      const before = existing[0];
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });

      await db.delete(announcements).where(eq(announcements.id, input.id));

      // If the deleted one was the chosen single announcement, clear the pointer
      const settings = await ensureSettings(db);
      if (settings.singleAnnouncementId === input.id) {
        await db.update(announcementSettings).set({ singleAnnouncementId: null }).where(eq(announcementSettings.id, settings.id));
      }

      const label = before.title || before.message.slice(0, 60);
      await logAudit(ctx.admin.id, ctx.admin.displayName, "announcement_deleted", `Deleted announcement "${label}" (was ${before.status})`, ctx.req.headers);
      return { success: true };
    }),

  // ── Admin: bar settings ───────────────────────────────────────────
  updateSettings: adminPermQuery("announcements")
    .input(settingsInput)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const before = await ensureSettings(db);

      if (input.displayMode === "single" && input.singleAnnouncementId != null) {
        const found = await db.select().from(announcements).where(eq(announcements.id, input.singleAnnouncementId)).limit(1);
        if (!found[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected announcement no longer exists" });
      }

      const values = {
        displayMode: input.displayMode as AnnouncementSetting["displayMode"],
        singleAnnouncementId: input.displayMode === "single" ? (input.singleAnnouncementId ?? null) : null,
        speed: input.speed as AnnouncementSetting["speed"],
        direction: input.direction as AnnouncementSetting["direction"],
        pauseOnHover: input.pauseOnHover,
        autoRepeat: input.autoRepeat,
        bgColor: input.bgColor,
        textColor: input.textColor,
        visibility: input.visibility as AnnouncementSetting["visibility"],
        selectedPages: JSON.stringify(input.selectedPages),
      };
      await db.update(announcementSettings).set(values).where(eq(announcementSettings.id, before.id));

      await logAudit(
        ctx.admin.id,
        ctx.admin.displayName,
        "announcement_settings_updated",
        `Updated announcement bar settings — ${describeChanges(sanitizeSettings(before) as unknown as Record<string, unknown>, { ...values, selectedPages: input.selectedPages.join(", ") })}`,
        ctx.req.headers
      );

      const updated = await db.select().from(announcementSettings).where(eq(announcementSettings.id, before.id)).limit(1);
      return sanitizeSettings(updated[0]);
    }),
});
