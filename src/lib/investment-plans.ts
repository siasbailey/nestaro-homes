// Fallback plan data used when the API is unreachable (e.g. offline preview).
// The live source of truth is the investmentPlans table via trpc.investor.plans.
export interface PlanDisplay {
  id: number;
  name: string;
  slug: string;
  minAmount: string;
  targetReturn: number;
  durationMonths: number;
  featured: "yes" | "no";
  description: string | null;
  features: unknown;
  isActive: "yes" | "no";
  sortOrder: number;
}

export const fallbackPlans: PlanDisplay[] = [
  {
    id: 1,
    name: "Starter",
    slug: "starter",
    minAmount: "1000.00",
    targetReturn: 40,
    durationMonths: 6,
    featured: "no",
    description:
      "Perfect for first-time planners. Start building toward your tiny home with a low minimum and a short 6-month term.",
    features: JSON.stringify([
      "Minimum plan $1,000",
      "Target home credit up to 40%",
      "6-month plan term",
      "Quarterly credit reports",
      "Email support",
      "Early withdrawal after 90 days",
    ]),
    isActive: "yes",
    sortOrder: 1,
  },
  {
    id: 2,
    name: "Growth",
    slug: "growth",
    minAmount: "5000.00",
    targetReturn: 55,
    durationMonths: 12,
    featured: "no",
    description:
      "Our most balanced plan. A full 12-month term across diversified tiny-home projects with higher target home credits.",
    features: JSON.stringify([
      "Minimum plan $5,000",
      "Target home credit up to 55%",
      "12-month plan term",
      "Monthly credit reports",
      "Priority support",
      "Diversified project allocation",
      "Compound credit option",
    ]),
    isActive: "yes",
    sortOrder: 2,
  },
  {
    id: 3,
    name: "Premium",
    slug: "premium",
    minAmount: "10000.00",
    targetReturn: 70,
    durationMonths: 18,
    featured: "yes",
    description:
      "Maximum growth potential. An 18-month term across our flagship tiny-home projects with the highest target home credits.",
    features: JSON.stringify([
      "Minimum plan $10,000",
      "Target home credit up to 70%",
      "18-month plan term",
      "Weekly credit reports",
      "Dedicated account manager",
      "Priority project access",
      "Compound credit option",
      "Exclusive customer events",
    ]),
    isActive: "yes",
    sortOrder: 3,
  },
];

export function parsePlanFeatures(features: unknown): string[] {
  if (Array.isArray(features)) return features.map(String);
  if (typeof features === "string") {
    try {
      const parsed = JSON.parse(features);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}
