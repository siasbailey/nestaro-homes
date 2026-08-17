import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import Footer from "@/sections/Footer";
import WhatsAppChat from "@/components/WhatsAppChat";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqCategories = [
  {
    title: "Buying & Payment",
    faqs: [
      {
        q: "How do I buy a tiny home?",
        a: "Browse our homes, add your chosen model to the cart, and proceed to checkout — or explore financing on eligible models. Once your purchase request is submitted, you receive a reference number you can use to follow every stage on the Track Purchase page.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept bank transfer, Zelle, and cryptocurrency (BTC, ETH, USDT) for outright purchases. Financing purchases start with a deposit, with the balance spread in monthly or yearly installments. All transactions are secured with 256-bit SSL encryption.",
      },
      {
        q: "Can I see a home before buying?",
        a: "Absolutely. We encourage viewings — book an appointment with our consultants at any time. A final inspection is always scheduled before delivery so you can walk through your home with our team.",
      },
      {
        q: "What is your refund policy?",
        a: "Purchase requests can be cancelled for a full refund within 14 days of placement, before legal documentation begins. After documentation starts, the deposit becomes non-refundable. See our Terms & Conditions for full details.",
      },
    ],
  },
  {
    title: "Documentation & Delivery",
    faqs: [
      {
        q: "How does the purchase process work?",
        a: "Every purchase moves through transparent stages — from purchase request and payment verification, through agreement, documentation and build scheduling, to final inspection and delivery. You are notified by email at every stage and can follow everything on the Track Purchase page.",
      },
      {
        q: "How long does the process take?",
        a: "Our homes are built to order, with typical build times of 8–20 weeks depending on the model. Documentation and delivery coordination are handled by our team throughout.",
      },
      {
        q: "Is documentation included?",
        a: "Yes. Every home ships with complete certification and purchase documentation. Agreements, documents, and receipts are also available in your customer dashboard.",
      },
      {
        q: "I live outside Oregon — can I still buy?",
        a: "Yes. Customers across the United States and Europe purchase with us remotely. Our team supports virtual viewings, couriered document signing, and coordinated delivery.",
      },
    ],
  },
  {
    title: "Our Homes",
    faqs: [
      {
        q: "Are your homes certified?",
        a: "Yes — every Nestaro Homes model is built to rigorous standards, with RVIA or ANSI A119.5 certification on applicable models. Each listing details its exact certification.",
      },
      {
        q: "Where do you deliver?",
        a: "We deliver across the United States and Europe. Delivery is coordinated by our team, and pricing depends on your location — contact us for a delivery quote.",
      },
      {
        q: "Do the homes have smart features?",
        a: "Yes. Depending on the model, features range from smart lighting and climate control to full home automation and intelligent energy management. Each listing details its exact specification.",
      },
      {
        q: "Can I buy with financing?",
        a: "Yes — financing is available on eligible models. Pay a deposit, choose a monthly or yearly plan, and spread the balance over time. See the Financing page for plans and the calculator.",
      },
    ],
  },
  {
    title: "Home Plans",
    faqs: [
      {
        q: "How do Nestaro Home Plans work?",
        a: "Our Home Plans portal lets you set aside funds toward your tiny home from as little as $1,000. Choose a plan, fund your wallet, and your balance earns home credits that build toward your purchase.",
      },
      {
        q: "How do I withdraw my earnings?",
        a: "When a plan completes, your balance plus earned credits are available in your wallet. You can request a withdrawal to your bank, Zelle, or crypto wallet at any time from your customer dashboard.",
      },
      {
        q: "Are home credits guaranteed?",
        a: "Home credit projections are estimates based on plan performance and are not guaranteed. Please read the full details on the Home Plans page before joining a plan.",
      },
    ],
  },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <AnnouncementBar />
      <main className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
          <div className="grid grid-cols-12 gap-6 items-end mb-20">
            <div className="col-span-12 lg:col-span-6">
              <p className="nh-label mb-5">FAQ</p>
              <h1 className="nh-display text-4xl md:text-6xl">Frequently Asked Questions</h1>
            </div>
            <div className="col-span-12 lg:col-span-5 lg:col-start-8">
              <p className="text-[#3d5045] text-lg leading-relaxed">
                Everything you need to know about Nestaro Homes, the purchase process, and home plans.
              </p>
            </div>
          </div>

          <div className="max-w-4xl space-y-16">
            {faqCategories.map((category) => (
              <div key={category.title}>
                <p className="nh-label mb-2">{category.title}</p>
                <Accordion type="single" collapsible className="w-full">
                  {category.faqs.map((faq, i) => (
                    <AccordionItem key={i} value={`${category.title}-${i}`} className="border-[#e5e7eb]">
                      <AccordionTrigger className="text-left font-serif text-xl text-[#192420] hover:text-[#c47a45] hover:no-underline py-6">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-[#3d5045] leading-relaxed pb-6">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>

          <div className="mt-20 max-w-4xl bg-[#192420] p-10 lg:p-14 text-white">
            <p className="nh-label mb-5">Still Have Questions?</p>
            <h2 className="nh-display text-3xl md:text-4xl !text-white mb-4">Talk to Our Team</h2>
            <p className="text-white/60 mb-8 max-w-md">
              Our team is available 7 days a week to help you find your perfect home.
            </p>
            <a
              href="/#contact"
              className="inline-flex items-center gap-3 bg-[#c47a45] text-white px-8 py-4 text-[13px] font-medium uppercase tracking-[0.14em] hover:bg-[#a6632f] transition-colors"
            >
              Request Information
            </a>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppChat />
    </div>
  );
}
