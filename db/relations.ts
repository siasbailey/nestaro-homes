import { relations } from "drizzle-orm";
import { users, products, customers, orders, orderItems, trackingHistory, investors, investmentPlans, investmentProjects, investments, deposits, withdrawals, investmentTransactions, referrals, investorNotifications, investorTokens, profitPayments, investorActivityLogs, liquidationRequests } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ many }) => ({
  orderItems: many(orderItems),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  tracking: many(trackingHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const trackingHistoryRelations = relations(trackingHistory, ({ one }) => ({
  order: one(orders, {
    fields: [trackingHistory.orderId],
    references: [orders.id],
  }),
}));

// ── Investment Portal Relations ─────────────────────────────────
export const investorsRelations = relations(investors, ({ one, many }) => ({
  referrer: one(investors, {
    fields: [investors.referredById],
    references: [investors.id],
    relationName: "referrals",
  }),
  investments: many(investments),
  deposits: many(deposits),
  withdrawals: many(withdrawals),
  transactions: many(investmentTransactions),
  notifications: many(investorNotifications),
}));

export const investmentsRelations = relations(investments, ({ one }) => ({
  investor: one(investors, {
    fields: [investments.investorId],
    references: [investors.id],
  }),
  plan: one(investmentPlans, {
    fields: [investments.planId],
    references: [investmentPlans.id],
  }),
  project: one(investmentProjects, {
    fields: [investments.projectId],
    references: [investmentProjects.id],
  }),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  investor: one(investors, {
    fields: [deposits.investorId],
    references: [investors.id],
  }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  investor: one(investors, {
    fields: [withdrawals.investorId],
    references: [investors.id],
  }),
}));

export const investmentTransactionsRelations = relations(investmentTransactions, ({ one }) => ({
  investor: one(investors, {
    fields: [investmentTransactions.investorId],
    references: [investors.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(investors, {
    fields: [referrals.referrerId],
    references: [investors.id],
    relationName: "referralEarners",
  }),
  referred: one(investors, {
    fields: [referrals.referredId],
    references: [investors.id],
    relationName: "referredUsers",
  }),
}));

export const investorNotificationsRelations = relations(investorNotifications, ({ one }) => ({
  investor: one(investors, {
    fields: [investorNotifications.investorId],
    references: [investors.id],
  }),
}));

export const investorTokensRelations = relations(investorTokens, ({ one }) => ({
  investor: one(investors, {
    fields: [investorTokens.investorId],
    references: [investors.id],
  }),
}));

export const profitPaymentsRelations = relations(profitPayments, ({ one }) => ({
  investment: one(investments, {
    fields: [profitPayments.investmentId],
    references: [investments.id],
  }),
  investor: one(investors, {
    fields: [profitPayments.investorId],
    references: [investors.id],
  }),
}));

export const investorActivityLogsRelations = relations(investorActivityLogs, ({ one }) => ({
  investor: one(investors, {
    fields: [investorActivityLogs.investorId],
    references: [investors.id],
  }),
}));

export const liquidationRequestsRelations = relations(liquidationRequests, ({ one }) => ({
  investor: one(investors, {
    fields: [liquidationRequests.investorId],
    references: [investors.id],
  }),
  investment: one(investments, {
    fields: [liquidationRequests.investmentId],
    references: [investments.id],
  }),
}));
