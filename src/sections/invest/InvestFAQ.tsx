import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What is the minimum to start a Home Plan?",
    a: "The Starter plan begins at just $1,000, making it easy to start building toward your tiny home. Growth starts at $5,000 and Premium at $10,000.",
  },
  {
    q: "How are home credits earned?",
    a: "Your plan funds the construction and sale of Nestaro tiny homes — community developments, premium models, and build-to-rent villages. Home credits come from home sales and rental income across these projects.",
  },
  {
    q: "When and how do I get my funds?",
    a: "Home credits accrue over your plan's term and are visible in your dashboard in real time. At plan completion, your balance plus credits are available in your wallet, ready to withdraw to your bank, Zelle, or crypto wallet — or to apply toward a home purchase.",
  },
  {
    q: "Can I withdraw before my plan completes?",
    a: "Plans are committed for the plan term (6–18 months). Starter plan members may request early withdrawal after 90 days, subject to a review and a partial credit adjustment.",
  },
  {
    q: "How does the referral program work?",
    a: "Share your unique referral code. When someone registers with it and their first deposit is approved, you receive a flat $50 bonus, credited directly to your wallet. Referral earnings become withdrawable once you have made a qualifying deposit of $50 or more.",
  },
  {
    q: "Is my personal and financial data secure?",
    a: "Yes. Passwords are encrypted with industry-standard bcrypt hashing, sessions use signed JWT tokens, and all traffic is protected with 256-bit SSL. Withdrawals above $5,000 additionally require identity verification.",
  },
  {
    q: "Are home credits guaranteed?",
    a: "No. Target credits are projections based on project pipelines and historical performance. Housing markets can fluctuate, and you may receive less than projected. Please read our full risk disclosure below.",
  },
  {
    q: "Who can join a Home Plan?",
    a: "Adults 18+ from supported countries can register. Identity verification is required for higher withdrawal limits.",
  },
];

export default function InvestFAQ() {
  return (
    <>
      {/* FAQ */}
      <section id="invest-faq" className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
          <div className="grid grid-cols-12 gap-6 items-end mb-16">
            <div className="col-span-12 lg:col-span-5">
              <p className="nh-label mb-5">Home Plans FAQ</p>
              <h2 className="nh-display text-4xl md:text-5xl">Questions, Answered</h2>
            </div>
            <div className="col-span-12 lg:col-span-6 lg:col-start-7">
              <p className="text-[#3d5045] leading-relaxed">
                Everything customers ask us before getting started.
              </p>
            </div>
          </div>

          <div className="max-w-4xl">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`invest-faq-${i}`} className="border-[#e5e7eb]">
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
        </div>
      </section>

      {/* Risk Disclosure */}
      <section id="risk-disclosure" className="py-24 bg-[#f7f4ee]">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
          <div className="max-w-4xl border-t-2 border-[#26342b] pt-10">
            <p className="nh-label mb-5">Risk Disclosure</p>
            <div className="space-y-4 text-sm text-[#3d5045] leading-relaxed">
              <p>
                Joining a Home Plan involves risk and may result in
                partial or total loss of funds. Target home credits of up to 40%, 55%, and 70%
                represent goals based on project pipelines and historical performance — they are
                projections, not guarantees, and actual credits may be lower or negative.
              </p>
              <p>
                Funds are committed for the duration of the plan term. Housing values,
                rental demand, construction costs, and market conditions can
                all affect project outcomes. Past performance of Nestaro Homes projects is not
                indicative of future results.
              </p>
              <p>
                Nestaro Homes is not a bank, and Home Plan funds are not bank deposits — they are not
                insured by the FDIC or any other government agency. You should only commit money
                you can afford to have committed for the full plan term, and you are
                encouraged to consult a licensed financial advisor before joining a plan.
              </p>
              <p className="font-medium text-[#192420]">
                By creating a customer account, you acknowledge that you have read, understood,
                and accepted these risks.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
