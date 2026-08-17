import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { products, teamMembers } from "@db/schema";
import { eq, asc } from "drizzle-orm";

export const productsRouter = createRouter({
  list: publicQuery
    .input(z.object({
      category: z.enum(["all", "1br", "2br", "3br", "4br"]).optional().default("all"),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.category && input.category !== "all") {
        return db.select().from(products).where(eq(products.category, input.category));
      }
      return db.select().from(products);
    }),

  getBySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db.select().from(products).where(eq(products.slug, input.slug));
      return result[0] ?? null;
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db.select().from(products).where(eq(products.id, input.id));
      return result[0] ?? null;
    }),

  // Public team roster for the About / Team section (active members only)
  teamMembers: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        role: teamMembers.role,
        bio: teamMembers.bio,
        photo: teamMembers.photo,
        sortOrder: teamMembers.sortOrder,
      })
      .from(teamMembers)
      .where(eq(teamMembers.isActive, "yes"))
      .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.id));
  }),
});
