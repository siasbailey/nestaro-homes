import { ErrorMessages, type AdminPermissionKey } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { adminHasPermission } from "./lib/admin-session";
import { ensureShadowInvestor } from "./lib/admin-users";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireRole(role: string) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== role) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = authedQuery.use(requireRole("admin"));

// ── Investment Portal guards ────────────────────────────────────
const requireInvestor = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.investor) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, investor: ctx.investor } });
});

// ── Administrator guards (multi-admin RBAC) ─────────────────────
const requireAdmin = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.admin) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, admin: ctx.admin } });
});

const requirePrimaryAdmin = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.admin || ctx.admin.role !== "primary") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This area is restricted to the Primary Administrator",
    });
  }

  return next({ ctx: { ...ctx, admin: ctx.admin } });
});

export function requirePermission(key: AdminPermissionKey) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.admin) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.unauthenticated });
    }
    if (!adminHasPermission(ctx.admin, key)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You don't have permission to access this area (${key})`,
      });
    }

    return next({ ctx: { ...ctx, admin: ctx.admin } });
  });
}

export const adminSessionQuery = t.procedure.use(requireAdmin);
export const primaryAdminQuery = t.procedure.use(requirePrimaryAdmin);
export const adminPermQuery = (key: AdminPermissionKey) => t.procedure.use(requirePermission(key));

// Investment-platform administration is exclusive to the Primary Admin.
// The shadow investor account is attached so existing procedures that read
// ctx.investor (audit attribution, notifications) keep working unchanged.
const requireInvestAdmin = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (ctx.admin && ctx.admin.role === "primary") {
    const investor = ctx.investor?.role === "admin" ? ctx.investor : await ensureShadowInvestor();
    return next({ ctx: { ...ctx, admin: ctx.admin, investor } });
  }
  // Legacy path: an investor account carrying the admin role
  if (ctx.investor && ctx.investor.role === "admin") {
    return next({ ctx: { ...ctx, investor: ctx.investor } });
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "This area is restricted to the Primary Administrator",
  });
});

export const investorQuery = t.procedure.use(requireInvestor);
export const investAdminQuery = t.procedure.use(requireInvestAdmin);
