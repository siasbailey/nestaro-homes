const benefits = [
  {
    title: "Asset-Backed Security",
    text: "Every dollar is deployed into real tiny-home developments — tangible assets you can see, not abstract instruments.",
  },
  {
    title: "High Target Home Credits",
    text: "Earn up to 70% over 18 months as our communities sell and rent into America's fast-growing tiny-home market.",
  },
  {
    title: "Bank-Grade Protection",
    text: "Encrypted accounts, JWT-secured sessions, and verified withdrawal controls keep your capital safe at every step.",
  },
  {
    title: "Short Lock-In Periods",
    text: "Terms from just 6 months mean your money is never tied up for years. Roll into a new plan or withdraw at completion — your choice.",
  },
  {
    title: "Full Transparency",
    text: "Track project progress, credit accrual, and every transaction in real time from your customer dashboard.",
  },
  {
    title: "Referral Rewards",
    text: "Earn a flat $50 bonus for every customer you refer whose first deposit is approved — credited straight to your wallet.",
  },
];

const steps = [
  {
    step: "01",
    title: "Create Your Account",
    text: "Register in under two minutes with your name and email. Verify your account to unlock full access.",
  },
  {
    step: "02",
    title: "Fund Your Wallet",
    text: "Deposit by bank transfer, Zelle, or crypto. Funds are credited to your wallet after a quick review.",
  },
  {
    step: "03",
    title: "Choose a Plan",
    text: "Pick Starter, Growth, or Premium and allocate your funds to curated tiny-home projects.",
  },
  {
    step: "04",
    title: "Track & Withdraw",
    text: "Watch your home credits accrue with live progress updates, then withdraw your balance and credits at completion.",
  },
];

export default function InvestBenefits() {
  return (
    <>
      {/* Benefits */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
          <div className="grid grid-cols-12 gap-6 items-end mb-16">
            <div className="col-span-12 lg:col-span-5">
              <p className="nh-label mb-5">Why Nestaro Plans</p>
              <h2 className="nh-display text-4xl md:text-5xl">Built for Customer Confidence</h2>
            </div>
            <div className="col-span-12 lg:col-span-6 lg:col-start-7">
              <p className="text-[#3d5045] leading-relaxed">
                We develop the properties ourselves — so your plan is backed by real
                homes, real margins, and real demand.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-[#e5e7eb]">
            {benefits.map((benefit, i) => (
              <div key={benefit.title} className="border-b border-r border-[#e5e7eb] p-8 lg:p-10">
                <p className="font-serif text-sm text-[#c47a45] mb-6">0{i + 1}</p>
                <h3 className="font-serif text-2xl text-[#192420] mb-3">{benefit.title}</h3>
                <p className="text-sm text-[#3d5045] leading-relaxed">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 md:py-32 bg-[#192420]">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
          <div className="grid grid-cols-12 gap-6 items-end mb-16">
            <div className="col-span-12 lg:col-span-5">
              <p className="nh-label mb-5">Getting Started</p>
              <h2 className="nh-display text-4xl md:text-5xl !text-white">How It Works</h2>
            </div>
            <div className="col-span-12 lg:col-span-6 lg:col-start-7">
              <p className="text-white/60 leading-relaxed">
                From sign-up to payout in four simple steps.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/15">
            {steps.map((item) => (
              <div key={item.step} className="border-b border-r border-white/15 p-8 lg:p-10">
                <p className="font-serif text-sm text-[#c47a45] mb-6">{item.step}</p>
                <h3 className="font-serif text-xl text-white mb-3">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
