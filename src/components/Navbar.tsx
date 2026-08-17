import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ShoppingCart, Menu, X, Home, Building2, Phone, User, Shield, HelpCircle, TrendingUp,
  ChevronDown, PieChart, LogIn, UserPlus, Calculator, LayoutDashboard, Briefcase, Coins,
  ArrowDownToLine, ArrowUpFromLine, Receipt, Bell, Settings, LogOut,
  Landmark, FileText, Wallet, ClipboardList,
} from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useInvestor } from "@/hooks/use-investor";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CartDrawer from "./CartDrawer";
import InvestorAvatar from "@/components/invest/InvestorAvatar";

type MenuItem = { href: string; label: string; icon: typeof PieChart };

const guestInvestItems: MenuItem[] = [
  { href: "/invest#invest-plans", label: "Home Plans", icon: PieChart },
  { href: "/invest/login", label: "Customer Login", icon: LogIn },
  { href: "/invest/register", label: "Create Account", icon: UserPlus },
  { href: "/invest#invest-calculator", label: "Plan Calculator", icon: Calculator },
  { href: "/invest#invest-faq", label: "Home Plans FAQ", icon: HelpCircle },
];

const guestMortgageItems: MenuItem[] = [
  { href: "/mortgage#info", label: "Financing Information", icon: Landmark },
  { href: "/mortgage#plans", label: "Available Financing Plans", icon: ClipboardList },
  { href: "/mortgage#calculator", label: "Financing Calculator", icon: Calculator },
  { href: "/mortgage#properties", label: "Apply for Financing", icon: FileText },
  { href: "/mortgage#faq", label: "Financing FAQ", icon: HelpCircle },
];

const authMortgageItems: MenuItem[] = [
  { href: "/invest/dashboard?tab=mortgages", label: "My Financing", icon: Landmark },
  { href: "/invest/dashboard?tab=mortgages&sub=applications", label: "Financing Applications", icon: FileText },
  { href: "/invest/dashboard?tab=mortgages&sub=history", label: "Payment History", icon: Receipt },
  { href: "/invest/dashboard?tab=mortgages&sub=history", label: "Financing Statements", icon: ClipboardList },
  { href: "/invest/dashboard?tab=mortgages", label: "Continue Financing Payments", icon: Wallet },
];

const authInvestItems: MenuItem[] = [
  { href: "/invest/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invest/dashboard?tab=portfolio", label: "My Plans", icon: Briefcase },
  { href: "/invest/dashboard?tab=portfolio", label: "My Home Plans", icon: TrendingUp },
  { href: "/invest/dashboard?tab=profits", label: "Credits", icon: Coins },
  { href: "/invest/dashboard?tab=deposit", label: "Deposit Funds", icon: ArrowDownToLine },
  { href: "/invest/dashboard?tab=withdraw", label: "Withdraw Funds", icon: ArrowUpFromLine },
  { href: "/invest/dashboard?tab=transactions", label: "Wallet Activity", icon: Receipt },
  { href: "/invest/dashboard?tab=notifications", label: "Notifications", icon: Bell },
  { href: "/invest/dashboard?tab=settings", label: "Settings", icon: Settings },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [investOpen, setInvestOpen] = useState(false);
  const [investMobileOpen, setInvestMobileOpen] = useState(false);
  const [mortgageOpen, setMortgageOpen] = useState(false);
  const [mortgageMobileOpen, setMortgageMobileOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesMobileOpen, setPropertiesMobileOpen] = useState(false);
  const { totalItems } = useCart();
  const { isAuthenticated, investor, logout } = useInvestor();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menus whenever the route changes
  useEffect(() => {
    setInvestOpen(false);
    setMobileMenuOpen(false);
    setInvestMobileOpen(false);
    setMortgageOpen(false);
    setMortgageMobileOpen(false);
    setPropertiesOpen(false);
    setPropertiesMobileOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/about", label: "About", icon: User },
    { href: "/faq", label: "FAQ", icon: HelpCircle },
    { href: "/#contact", label: "Contact", icon: Phone },
  ];

  // Properties dropdown — catalog browsing + purchase tracking
  const propertiesItems: MenuItem[] = [
    { href: "/#catalog", label: "Check Properties", icon: Building2 },
    { href: "/track-order", label: "Track Purchase", icon: Shield },
  ];

  const investItems = isAuthenticated ? authInvestItems : guestInvestItems;
  const mortgageItems = isAuthenticated ? authMortgageItems : guestMortgageItems;

  const scrollToSection = (href: string) => {
    setMobileMenuOpen(false);
    setInvestMobileOpen(false);
    setPropertiesOpen(false);
    setPropertiesMobileOpen(false);
    if (href.startsWith("/#")) {
      const id = href.replace("/#", "");
      const el = document.getElementById(id);
      if (el && location.pathname === "/") {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    navigate(href);
  };

  const goToInvestItem = (href: string) => {
    setInvestOpen(false);
    setMobileMenuOpen(false);
    setInvestMobileOpen(false);
    setMortgageOpen(false);
    setMortgageMobileOpen(false);
    const [path, hash] = href.split("#");
    if (hash && location.pathname === path) {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      navigate(href, { replace: true });
      return;
    }
    navigate(href);
  };

  const handleLogout = () => {
    setInvestOpen(false);
    setMobileMenuOpen(false);
    setInvestMobileOpen(false);
    setPropertiesOpen(false);
    setPropertiesMobileOpen(false);
    logout();
    navigate("/");
  };

  const renderNavButton = (link: (typeof navLinks)[number]) => (
    <button
      key={link.href}
      onClick={() => scrollToSection(link.href)}
      className="text-[#3d5045] hover:text-[#26342b] font-medium text-[13px] uppercase tracking-[0.14em] relative group"
    >
      {link.label}
      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#c47a45] transition-all group-hover:w-full" />
    </button>
  );

  return (
    <nav
      className={`fixed w-full z-50 transition-colors duration-300 border-b ${
        scrolled ? "bg-white border-[#e5e7eb]" : "bg-white/95 border-transparent"
      }`}
    >
      <div className="max-w-none px-6 lg:px-10">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 border border-[#26342b] flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-[#26342b]" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="whitespace-nowrap">
              <h1 className="text-base leading-none text-[#26342b] font-serif tracking-[0.08em] uppercase whitespace-nowrap">Nestaro Homes</h1>
              <p className="hidden sm:block text-[9px] leading-none text-[#9ca3af] tracking-[0.2em] uppercase mt-1 whitespace-nowrap">Premium Tiny Homes</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-5 xl:gap-7">
            {/* Home */}
            {navLinks.slice(0, 1).map((link) => renderNavButton(link))}

            {/* Properties dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setPropertiesOpen(true)}
              onMouseLeave={() => setPropertiesOpen(false)}
            >
              <button
                onClick={() => setPropertiesOpen((v) => !v)}
                className="text-[#3d5045] hover:text-[#26342b] font-medium text-[13px] uppercase tracking-[0.14em] relative group flex items-center gap-1"
              >
                Properties
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${propertiesOpen ? "rotate-180" : ""}`}
                />
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#c47a45] transition-all group-hover:w-full" />
              </button>

              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-200 ${
                  propertiesOpen
                    ? "opacity-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 translate-y-2 pointer-events-none"
                }`}
              >
                <div className="w-64 bg-white border border-[#e5e7eb] py-2 overflow-hidden">
                  {propertiesItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => scrollToSection(item.href)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#f7f4ee] hover:text-[#26342b] transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-[#c47a45]" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Investment dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setInvestOpen(true)}
              onMouseLeave={() => setInvestOpen(false)}
            >
              <button
                onClick={() => setInvestOpen((v) => !v)}
                className="text-[#3d5045] hover:text-[#26342b] font-medium text-[13px] uppercase tracking-[0.14em] relative group flex items-center gap-1"
              >
                Investment
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${investOpen ? "rotate-180" : ""}`}
                />
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#c47a45] transition-all group-hover:w-full" />
              </button>

              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-200 ${
                  investOpen
                    ? "opacity-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 translate-y-2 pointer-events-none"
                }`}
              >
                <div className="w-72 bg-white border border-[#e5e7eb] py-2 overflow-hidden">
                  {isAuthenticated && investor && (
                    <div className="px-4 py-2.5 border-b border-gray-100 mb-1 flex items-center gap-3">
                      <InvestorAvatar name={investor.name} avatar={investor.avatar} size="sm" />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wider text-gray-400">Signed in as</p>
                        <p className="text-sm font-semibold text-[#26342b] truncate">{investor.name}</p>
                      </div>
                    </div>
                  )}
                  {investItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => goToInvestItem(item.href)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#f7f4ee] hover:text-[#26342b] transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-[#c47a45]" />
                      {item.label}
                    </button>
                  ))}
                  {isAuthenticated && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Mortgage dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setMortgageOpen(true)}
              onMouseLeave={() => setMortgageOpen(false)}
            >
              <button
                onClick={() => setMortgageOpen((v) => !v)}
                className="text-[#3d5045] hover:text-[#26342b] font-medium text-[13px] uppercase tracking-[0.14em] relative group flex items-center gap-1"
              >
                Mortgage
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${mortgageOpen ? "rotate-180" : ""}`}
                />
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#c47a45] transition-all group-hover:w-full" />
              </button>

              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-200 ${
                  mortgageOpen
                    ? "opacity-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 translate-y-2 pointer-events-none"
                }`}
              >
                <div className="w-72 bg-white border border-[#e5e7eb] py-2 overflow-hidden">
                  {isAuthenticated && investor && (
                    <div className="px-4 py-2.5 border-b border-gray-100 mb-1 flex items-center gap-3">
                      <InvestorAvatar name={investor.name} avatar={investor.avatar} size="sm" />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wider text-gray-400">Signed in as</p>
                        <p className="text-sm font-semibold text-[#26342b] truncate">{investor.name}</p>
                      </div>
                    </div>
                  )}
                  {mortgageItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => goToInvestItem(item.href)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#f7f4ee] hover:text-[#26342b] transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-[#c47a45]" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Remaining links */}
            {navLinks.slice(1).map((link) => renderNavButton(link))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Investor action buttons (desktop) */}
            {!isAuthenticated ? (
              <div className="hidden lg:flex items-center gap-2">
                <Link
                  to="/invest/login"
                  className="px-4 py-2 border border-[#26342b] text-[#26342b] text-[13px] uppercase tracking-[0.12em] font-medium hover:bg-[#26342b] hover:text-white transition flex items-center gap-2 whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </Link>
                <Link
                  to="/invest/register"
                  className="px-4 py-2 bg-[#26342b] text-white text-[13px] uppercase tracking-[0.12em] font-medium hover:bg-[#192420] transition whitespace-nowrap"
                >
                  Create Account
                </Link>
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium hover:border-red-300 hover:text-red-600 transition flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}

            {/* Cart */}
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <button className="relative p-2 text-gray-600 hover:text-[#26342b] transition">
                  <ShoppingCart className="w-6 h-6" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#c47a45] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                      {totalItems}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>Your Cart</SheetTitle>
                </SheetHeader>
                <CartDrawer onClose={() => setCartOpen(false)} />
              </SheetContent>
            </Sheet>

            {/* Admin link */}
            <Link
              to="/admin"
              className="hidden xl:flex items-center gap-2 border border-[#26342b]/30 text-[#26342b] px-4 py-2 hover:bg-[#26342b] hover:text-white transition text-sm font-medium whitespace-nowrap"
            >
              <Shield className="w-4 h-4" />
              Admin
            </Link>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden text-gray-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-[#e5e7eb] max-h-[calc(100vh-5rem)] overflow-y-auto">
          <div className="px-4 py-4 space-y-2">
            {/* Home */}
            {navLinks.slice(0, 1).map((link) => (
              <button
                key={link.href}
                onClick={() => scrollToSection(link.href)}
                className="flex items-center gap-3 w-full text-gray-700 hover:text-[#26342b] font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition"
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </button>
            ))}

            {/* Properties expandable group */}
            <button
              onClick={() => setPropertiesMobileOpen((v) => !v)}
              className="flex items-center justify-between w-full text-gray-700 hover:text-[#26342b] font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition"
            >
              <span className="flex items-center gap-3">
                <Building2 className="w-5 h-5" />
                Properties
              </span>
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-200 ${propertiesMobileOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                propertiesMobileOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-4 pl-4 border-l-2 border-[#c47a45]/30 space-y-1">
                {propertiesItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => scrollToSection(item.href)}
                    className="flex items-center gap-3 w-full text-gray-600 hover:text-[#26342b] text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition"
                  >
                    <item.icon className="w-4 h-4 text-[#c47a45]" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Investment expandable group */}
            <button
              onClick={() => setInvestMobileOpen((v) => !v)}
              className="flex items-center justify-between w-full text-gray-700 hover:text-[#26342b] font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition"
            >
              <span className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5" />
                Investment
              </span>
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-200 ${investMobileOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                investMobileOpen ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-4 pl-4 border-l-2 border-[#c47a45]/30 space-y-1">
                {isAuthenticated && investor && (
                  <div className="px-4 py-2 flex items-center gap-2.5">
                    <InvestorAvatar name={investor.name} avatar={investor.avatar} size="xs" />
                    <p className="text-xs uppercase tracking-wider text-gray-400">
                      Signed in as <span className="font-semibold text-[#26342b]">{investor.name}</span>
                    </p>
                  </div>
                )}
                {investItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => goToInvestItem(item.href)}
                    className="flex items-center gap-3 w-full text-gray-600 hover:text-[#26342b] text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition"
                  >
                    <item.icon className="w-4 h-4 text-[#c47a45]" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mortgage expandable group */}
            <button
              onClick={() => setMortgageMobileOpen((v) => !v)}
              className="flex items-center justify-between w-full text-gray-700 hover:text-[#26342b] font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition"
            >
              <span className="flex items-center gap-3">
                <Landmark className="w-5 h-5" />
                Mortgage
              </span>
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-200 ${mortgageMobileOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                mortgageMobileOpen ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-4 pl-4 border-l-2 border-[#c47a45]/30 space-y-1">
                {mortgageItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => goToInvestItem(item.href)}
                    className="flex items-center gap-3 w-full text-gray-600 hover:text-[#26342b] text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition"
                  >
                    <item.icon className="w-4 h-4 text-[#c47a45]" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Remaining links */}
            {navLinks.slice(1).map((link) => (
              <button
                key={link.href}
                onClick={() => scrollToSection(link.href)}
                className="flex items-center gap-3 w-full text-gray-700 hover:text-[#26342b] font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition"
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </button>
            ))}

            {/* Investor action buttons */}
            {!isAuthenticated ? (
              <div className="pt-2 space-y-2">
                <Link
                  to="/invest/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full border border-[#26342b] text-[#26342b] font-medium py-3 px-4 rounded-lg hover:bg-[#26342b] hover:text-white transition"
                >
                  <LogIn className="w-5 h-5" />
                  Login
                </Link>
                <Link
                  to="/invest/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full bg-[#26342b] text-white font-medium py-3 px-4 rounded-lg hover:bg-[#3d5045] transition"
                >
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </Link>
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full border border-red-200 text-red-600 font-medium py-3 px-4 rounded-lg hover:bg-red-50 transition"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            )}

            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 w-full text-white bg-[#26342b] font-medium py-3 px-4 rounded-lg hover:bg-[#3d5045] transition mt-2"
            >
              <Shield className="w-5 h-5" />
              Admin Portal
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

