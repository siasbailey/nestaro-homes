import { getDb } from "../queries/connection.ts";
import { products, investmentPlans, investmentProjects } from "./schema";

const productsData = [
  {
    name: "The Spruce Studio",
    slug: "compact-solo",
    category: "1br" as const,
    price: "24500.00",
    size: "220 sq ft",
    bedrooms: 1,
    bathrooms: 1,
    images: JSON.stringify(["/images/home-exterior-1.jpg", "/images/interior-1.jpg", "/images/interior-2.jpg", "/images/interior-3.jpg"]),
    specs: JSON.stringify({
      "Model Type": "Studio Tiny Home on Wheels",
      "Bedrooms": "1 (main-level sleeping area)",
      "Bathrooms": "1",
      "Floor Area": "220 sq ft",
      "Foundation": "Steel trailer chassis, road-legal",
      "Insulation": "Closed-cell spray foam, four-season rated",
      "Heating & Cooling": "Mini-split heat pump",
      "Kitchen": "Butcher-block counters, 2-burner cooktop, apartment fridge",
      "Bathroom": "Full shower, standard flush toilet",
      "Certification": "RVIA-certified build",
      "Delivery": "Built to order — delivery in 8–10 weeks",
      "Warranty": "1-year limited structural warranty"
    }),
    features: JSON.stringify(["Four-season insulation", "Mini-split heating & cooling", "Full kitchen with butcher-block counters", "Road-legal trailer chassis", "Large picture windows", "Exterior cedar siding"]),
    delivery: "Built to order — delivery in 8–10 weeks",
    warranty: "1-year limited structural warranty",
    description: "Our most accessible model. The Spruce Studio packs a full kitchen, a four-season mini-split, and a comfortable main-level sleeping area into 220 beautifully finished square feet — the perfect first tiny home, guest house, or backyard studio.",
    mortgageEnabled: "yes" as const,
    minDownPaymentPercent: "30.00",
  },
  {
    name: "The Cascade",
    slug: "urban-nest",
    category: "1br" as const,
    price: "32000.00",
    size: "280 sq ft",
    bedrooms: 1,
    bathrooms: 1,
    images: JSON.stringify(["/images/home-exterior-2.jpg", "/images/interior-4.jpg", "/images/interior-2.jpg", "/images/interior-3.jpg"]),
    specs: JSON.stringify({
      "Model Type": "1-Bedroom Tiny Home on Wheels",
      "Bedrooms": "1 (sleeping loft)",
      "Bathrooms": "1",
      "Floor Area": "280 sq ft",
      "Foundation": "Steel trailer chassis, road-legal",
      "Insulation": "Closed-cell spray foam, four-season rated",
      "Heating & Cooling": "Mini-split heat pump + electric fireplace",
      "Kitchen": "Galley kitchen, 4-burner range, full-height fridge",
      "Bathroom": "Full shower, vanity, standard flush toilet",
      "Certification": "RVIA-certified build",
      "Delivery": "Built to order — delivery in 8–12 weeks",
      "Warranty": "1-year limited structural warranty"
    }),
    features: JSON.stringify(["Spacious sleeping loft", "Galley kitchen with full-height fridge", "Electric fireplace", "Built-in storage stairs", "Cedar & metal exterior", "Optional off-grid solar package"]),
    delivery: "Built to order — delivery in 8–12 weeks",
    warranty: "1-year limited structural warranty",
    description: "The Cascade adds a proper sleeping loft and storage stairs to a 280 sq ft footprint, with a galley kitchen built for real cooking. A warm cedar-and-metal exterior makes it as handsome parked in the pines as it is in the city.",
    mortgageEnabled: "yes" as const,
    minDownPaymentPercent: "30.00",
  },
  {
    name: "The Willamette",
    slug: "studio-deluxe",
    category: "1br" as const,
    price: "45000.00",
    size: "340 sq ft",
    bedrooms: 1,
    bathrooms: 1,
    images: JSON.stringify(["/images/home-exterior-3.jpg", "/images/interior-5.jpg", "/images/interior-1.jpg", "/images/interior-4.jpg"]),
    specs: JSON.stringify({
      "Model Type": "1-Bedroom Premium Tiny Home",
      "Bedrooms": "1 (main-level bedroom)",
      "Bathrooms": "1",
      "Floor Area": "340 sq ft",
      "Foundation": "Steel trailer chassis or permanent foundation",
      "Insulation": "High-R four-season envelope",
      "Heating & Cooling": "Ductless mini-split + heated bathroom floor",
      "Kitchen": "Full kitchen, quartz counters, induction range, dishwasher drawer",
      "Bathroom": "Walk-in shower, heated floor, standard flush toilet",
      "Certification": "RVIA-certified build",
      "Delivery": "Built to order — delivery in 10–12 weeks",
      "Warranty": "1-year limited structural warranty"
    }),
    features: JSON.stringify(["Main-level bedroom — no ladder", "Quartz kitchen counters", "Heated bathroom floor", "Dedicated workspace nook", "Floor-to-ceiling glazing", "Standing-seam metal roof"]),
    delivery: "Built to order — delivery in 10–12 weeks",
    warranty: "1-year limited structural warranty",
    description: "A premium 340 sq ft tiny home with a true main-level bedroom — no loft ladder required. Quartz counters, a heated bathroom floor, and floor-to-ceiling glazing bring full-size comfort to a thoughtfully compact plan.",
    mortgageEnabled: "yes" as const,
    minDownPaymentPercent: "25.00",
  },
  {
    name: "The Mt. Hood",
    slug: "family-starter",
    category: "2br" as const,
    price: "68500.00",
    size: "399 sq ft",
    bedrooms: 2,
    bathrooms: 1,
    images: JSON.stringify(["/images/home-exterior-4.jpg", "/images/interior-2.jpg", "/images/interior-5.jpg", "/images/interior-3.jpg"]),
    specs: JSON.stringify({
      "Model Type": "2-Bedroom Tiny Home on Wheels",
      "Bedrooms": "2 (double loft + main-level flex room)",
      "Bathrooms": "1",
      "Floor Area": "399 sq ft",
      "Foundation": "Steel trailer chassis, road-legal",
      "Insulation": "High-R four-season envelope",
      "Heating & Cooling": "Mini-split heat pump",
      "Kitchen": "Full kitchen, farmhouse sink, induction range, full fridge",
      "Bathroom": "Tub/shower combo, standard flush toilet",
      "Certification": "RVIA-certified build",
      "Delivery": "Built to order — delivery in 10–14 weeks",
      "Warranty": "1-year limited structural warranty"
    }),
    features: JSON.stringify(["Sleeps a family of four", "Double loft + flex room", "Farmhouse kitchen sink", "Tub/shower combo", "Built-in wardrobes", "Optional deck package"]),
    delivery: "Built to order — delivery in 10–14 weeks",
    warranty: "1-year limited structural warranty",
    description: "Our family-ready favorite. The Mt. Hood sleeps four across a double loft and a main-level flex room, with a tub for the kids and a farmhouse kitchen at the heart of 399 cleverly planned square feet.",
    mortgageEnabled: "yes" as const,
    minDownPaymentPercent: "25.00",
  },
  {
    name: "The Columbia",
    slug: "comfort-duo",
    category: "2br" as const,
    price: "89000.00",
    size: "480 sq ft",
    bedrooms: 2,
    bathrooms: 2,
    images: JSON.stringify(["/images/home-exterior-5.jpg", "/images/interior-3.jpg", "/images/interior-4.jpg", "/images/interior-1.jpg"]),
    specs: JSON.stringify({
      "Model Type": "2-Bedroom Park Model Tiny Home",
      "Bedrooms": "2 (main-level bedroom + loft)",
      "Bathrooms": "2",
      "Floor Area": "480 sq ft",
      "Foundation": "Park-model chassis or permanent foundation",
      "Insulation": "High-R four-season envelope",
      "Heating & Cooling": "Ductless mini-split, zoned",
      "Kitchen": "Chef's kitchen, island with seating, pantry, full appliances",
      "Bathroom": "Primary walk-in shower + powder room",
      "Certification": "ANSI A119.5 park-model certified",
      "Delivery": "Built to order — delivery in 12–14 weeks",
      "Warranty": "1-year limited structural warranty"
    }),
    features: JSON.stringify(["Main-level primary bedroom", "Kitchen island with seating", "Two bathrooms", "Full-size appliances", "Vaulted great room", "Optional covered porch"]),
    delivery: "Built to order — delivery in 12–14 weeks",
    warranty: "1-year limited structural warranty",
    description: "A 480 sq ft park model that lives far larger than its footprint: a vaulted great room, a chef's kitchen with island seating, a main-level primary bedroom, and two full bathrooms. The Columbia is made for full-time living.",
    mortgageEnabled: "yes" as const,
    minDownPaymentPercent: "25.00",
  },
  {
    name: "The Pacific Loft",
    slug: "family-haven",
    category: "2br" as const,
    price: "115000.00",
    size: "560 sq ft",
    bedrooms: 2,
    bathrooms: 2,
    images: JSON.stringify(["/images/home-exterior-6.jpg", "/images/interior-5.jpg", "/images/interior-2.jpg", "/images/interior-4.jpg"]),
    specs: JSON.stringify({
      "Model Type": "2-Bedroom Loft Tiny Home",
      "Bedrooms": "2 (main-level suite + loft suite)",
      "Bathrooms": "2",
      "Floor Area": "560 sq ft",
      "Foundation": "Permanent foundation (modular)",
      "Insulation": "High-R four-season envelope",
      "Heating & Cooling": "Ductless mini-split, zoned + heat-recovery ventilator",
      "Kitchen": "Chef's kitchen, quartz island, induction range, walk-in pantry",
      "Bathroom": "Two spa-style bathrooms with walk-in showers",
      "Certification": "Modular construction, state-approved",
      "Delivery": "Built to order — delivery in 12–16 weeks",
      "Warranty": "1-year limited structural warranty"
    }),
    features: JSON.stringify(["Two private suites", "Walk-in pantry", "Heat-recovery ventilation", "Spa-style bathrooms", "Oversized glazing walls", "Standing-seam metal roof"]),
    delivery: "Built to order — delivery in 12–16 weeks",
    warranty: "1-year limited structural warranty",
    description: "A modular 560 sq ft design with two true suites — one on the main level, one in the loft — separated by a light-filled great room. The Pacific Loft brings an architectural, gallery-like calm to compact living.",
    mortgageEnabled: "yes" as const,
    minDownPaymentPercent: "20.00",
  },
  {
    name: "The Deschutes",
    slug: "grand-estate",
    category: "3br" as const,
    price: "149000.00",
    size: "680 sq ft",
    bedrooms: 3,
    bathrooms: 2,
    images: JSON.stringify(["/images/home-exterior-1.jpg", "/images/interior-4.jpg", "/images/interior-5.jpg", "/images/interior-1.jpg"]),
    specs: JSON.stringify({
      "Model Type": "3-Bedroom Modular Tiny Home",
      "Bedrooms": "3 (main-level bedroom + 2 lofts)",
      "Bathrooms": "2",
      "Floor Area": "680 sq ft",
      "Foundation": "Permanent foundation (modular)",
      "Insulation": "High-R four-season envelope",
      "Heating & Cooling": "Ductless mini-split, zoned + radiant bathroom floors",
      "Kitchen": "U-shaped chef's kitchen, quartz counters, full appliances",
      "Bathroom": "Walk-in shower + tub/shower combo",
      "Certification": "Modular construction, state-approved",
      "Delivery": "Built to order — delivery in 14–18 weeks",
      "Warranty": "1-year limited structural warranty"
    }),
    features: JSON.stringify(["Three separate sleeping quarters", "U-shaped chef's kitchen", "Radiant bathroom floors", "Mudroom entry", "Covered deck option", "Smart-home lighting & climate"]),
    delivery: "Built to order — delivery in 14–18 weeks",
    warranty: "1-year limited structural warranty",
    description: "Three separate sleeping quarters in 680 square feet — a main-level bedroom and two generous lofts wrapped around a U-shaped chef's kitchen. The Deschutes proves a family of five can live beautifully in a tiny footprint.",
    mortgageEnabled: "yes" as const,
    minDownPaymentPercent: "20.00",
  },
  {
    name: "The Tillamook Grand",
    slug: "luxury-villa",
    category: "3br" as const,
    price: "189000.00",
    size: "840 sq ft",
    bedrooms: 3,
    bathrooms: 2,
    images: JSON.stringify(["/images/home-exterior-2.jpg", "/images/interior-5.jpg", "/images/interior-3.jpg", "/images/interior-1.jpg"]),
    specs: JSON.stringify({
      "Model Type": "Flagship 3-Bedroom Tiny Home",
      "Bedrooms": "3 (main-level primary suite + 2 loft suites)",
      "Bathrooms": "2",
      "Floor Area": "840 sq ft",
      "Foundation": "Permanent foundation (modular)",
      "Insulation": "Premium high-R four-season envelope",
      "Heating & Cooling": "Zoned mini-splits + radiant floors throughout",
      "Kitchen": "Gourmet kitchen, quartz waterfall island, premium appliances, walk-in pantry",
      "Bathroom": "Primary spa bath + shared bath, both with walk-in showers",
      "Certification": "Modular construction, state-approved",
      "Delivery": "Built to order — delivery in 16–20 weeks",
      "Warranty": "1-year limited structural warranty"
    }),
    features: JSON.stringify(["Flagship 840 sq ft plan", "Gourmet waterfall-island kitchen", "Radiant floors throughout", "Primary spa suite", "Full-height glazing walls", "Premium smart-home package"]),
    delivery: "Built to order — delivery in 16–20 weeks",
    warranty: "1-year limited structural warranty",
    description: "The flagship of the Nestaro collection. At 840 sq ft, The Tillamook Grand pairs a gourmet waterfall-island kitchen and a primary spa suite with radiant floors and walls of glass — the fullest expression of premium tiny-home living we build.",
    mortgageEnabled: "yes" as const,
    minDownPaymentPercent: "20.00",
  },
];

const plansData = [
  {
    name: "Starter",
    slug: "starter",
    minAmount: "1000.00",
    targetReturn: 40,
    durationMonths: 6,
    featured: "no" as const,
    description:
      "Perfect for first-time savers. Start building toward your tiny home with a low minimum and a short 6-month term.",
    features: JSON.stringify([
      "Minimum amount $1,000",
      "Home credit up to 40%",
      "6-month plan term",
      "Monthly credit payouts",
      "Email support",
      "Early exit after 90 days",
    ]),
    isActive: "yes" as const,
    sortOrder: 1,
  },
  {
    name: "Growth",
    slug: "growth",
    minAmount: "5000.00",
    targetReturn: 55,
    durationMonths: 12,
    featured: "no" as const,
    description:
      "Our most balanced plan. A full 12-month term across our tiny-home community projects with higher home-credit targets.",
    features: JSON.stringify([
      "Minimum amount $5,000",
      "Home credit up to 55%",
      "12-month plan term",
      "Monthly credit payouts",
      "Priority support",
      "Diversified project allocation",
      "Compound earnings option",
    ]),
    isActive: "yes" as const,
    sortOrder: 2,
  },
  {
    name: "Premium",
    slug: "premium",
    minAmount: "10000.00",
    targetReturn: 70,
    durationMonths: 18,
    featured: "yes" as const,
    description:
      "Maximum growth potential. An 18-month term across our flagship tiny-home communities with the highest home-credit targets.",
    features: JSON.stringify([
      "Minimum amount $10,000",
      "Home credit up to 70%",
      "18-month plan term",
      "Monthly credit payouts",
      "Dedicated account manager",
      "Priority project access",
      "Compound earnings option",
      "Exclusive member events",
    ]),
    isActive: "yes" as const,
    sortOrder: 3,
  },
];

const projectsData = [
  {
    name: "Pine Ridge Tiny Home Community",
    location: "Bend, Oregon",
    category: "Residential",
    description:
      "A 24-home tiny-home community in the high desert outside Bend, with shared green spaces, trail access, and mountain views — designed for full-time tiny living.",
    image: null as string | null,
    targetAmount: "250000.00",
    expectedReturn: 40,
    durationMonths: 6,
    status: "funding" as const,
  },
  {
    name: "Lakeshore Eco Tiny Village",
    location: "Truckee, California",
    category: "Eco Living",
    description:
      "A lakeside collection of 40 solar-equipped tiny homes with shared gardens, a community lodge, and smart energy management near Lake Tahoe.",
    image: null as string | null,
    targetAmount: "500000.00",
    expectedReturn: 55,
    durationMonths: 12,
    status: "funding" as const,
  },
  {
    name: "Riverbend Tiny Home Park",
    location: "Austin, Texas",
    category: "Mixed Use",
    description:
      "Flagship tiny-home park combining premium home sites with a community workshop, co-working barn, and weekend market stalls minutes from downtown Austin.",
    image: null as string | null,
    targetAmount: "1000000.00",
    expectedReturn: 70,
    durationMonths: 18,
    status: "funding" as const,
  },
];

async function seed() {
  const db = getDb();

  console.log("Seeding products...");

  for (const product of productsData) {
    // Check if product already exists
    const existing = await db.select().from(products).where(eq(products.slug, product.slug));
    if (existing.length === 0) {
      await db.insert(products).values(product);
      console.log(`  Created: ${product.name}`);
    } else {
      console.log(`  Exists: ${product.name}`);
    }
  }

  console.log("Seeding investment plans...");

  for (const plan of plansData) {
    const existing = await db.select().from(investmentPlans).where(eq(investmentPlans.slug, plan.slug));
    if (existing.length === 0) {
      await db.insert(investmentPlans).values(plan);
      console.log(`  Created: ${plan.name} Plan`);
    } else {
      console.log(`  Exists: ${plan.name} Plan`);
    }
  }

  console.log("Seeding investment projects...");

  for (const project of projectsData) {
    const existing = await db
      .select()
      .from(investmentProjects)
      .where(eq(investmentProjects.name, project.name));
    if (existing.length === 0) {
      await db.insert(investmentProjects).values(project);
      console.log(`  Created: ${project.name}`);
    } else {
      console.log(`  Exists: ${project.name}`);
    }
  }

  console.log("Seed complete!");
}

// Need to import eq
import { eq } from "drizzle-orm";

seed().catch(console.error);




