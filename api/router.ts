import { authRouter } from "./auth-router";
import { productsRouter } from "./products-router";
import { ordersRouter } from "./orders-router";
import { contactRouter } from "./contact-router";
import { adminRouter } from "./admin-router";
import { investorAuthRouter } from "./investor-auth-router";
import { investorRouter } from "./investor-router";
import { investAdminRouter } from "./invest-admin-router";
import { adminManagementRouter } from "./admin-management-router";
import { mortgageRouter } from "./mortgage-router";
import { adminMortgageRouter } from "./admin-mortgage-router";
import { announcementRouter } from "./announcement-router";
import { kycRouter } from "./kyc-router";
import { documentRouter } from "./document-router";
import { crmRouter } from "./crm-router";
import { appointmentRouter } from "./appointment-router";
import { messageRouter } from "./message-router";
import { activityRouter } from "./activity-router";
import { testimonialRouter } from "./testimonial-router";
import { notificationRouter } from "./notification-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  products: productsRouter,
  orders: ordersRouter,
  contact: contactRouter,
  admin: adminRouter,
  investorAuth: investorAuthRouter,
  investor: investorRouter,
  investAdmin: investAdminRouter,
  adminMgmt: adminManagementRouter,
  mortgage: mortgageRouter,
  adminMortgage: adminMortgageRouter,
  announcement: announcementRouter,
  kyc: kycRouter,
  document: documentRouter,
  crm: crmRouter,
  appointment: appointmentRouter,
  message: messageRouter,
  activity: activityRouter,
  testimonial: testimonialRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
