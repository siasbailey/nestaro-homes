import { Link } from "react-router";
import { ArrowLeft, FileText } from "lucide-react";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import Footer from "@/sections/Footer";

export default function TermsConditions() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <AnnouncementBar />
      <main className="pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-[#26342b] hover:text-[#3d5045] mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="text-center mb-12">
            <FileText className="w-12 h-12 text-[#26342b] mx-auto mb-4" />
            <h1 className="text-4xl font-serif font-bold text-[#26342b] mb-4">Terms & Conditions</h1>
            <p className="text-gray-600">Last updated: June 2026</p>
          </div>

          <div className="prose max-w-none text-gray-600">
            <h2 className="text-xl font-bold text-[#26342b] mb-3">1. Acceptance of Terms</h2>
            <p className="mb-4">By accessing and using the Nestaro Homes website and services, you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">2. Products and Services</h2>
            <p className="mb-4">Nestaro Homes LLC designs, builds, and sells premium tiny homes from Portland, Oregon, United States. All home descriptions, specifications, and pricing are subject to change without notice. We reserve the right to withdraw any model from sale at any time.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">3. Ordering and Payment</h2>
            <p className="mb-4">To purchase a home, you must provide accurate and complete information. Outright purchases require full payment before documentation begins; financed purchases require the applicable deposit followed by scheduled installments. We accept bank transfer, Zelle, and cryptocurrency.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">4. Documentation & Delivery</h2>
            <p className="mb-4">Build, documentation, and delivery timelines are estimates and not guaranteed. We are not responsible for delays caused by payment delays or other circumstances beyond our control. Ownership transfers upon completed documentation and delivery.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">5. Cancellation and Refunds</h2>
            <p className="mb-4">Purchases may be cancelled within 14 days of the purchase request for a full refund. After 14 days, cancellation fees apply based on documentation and build progress. Purchases may not be cancelled once ownership transfer has been executed.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">6. Certification & Condition</h2>
            <p className="mb-4">All homes are sold with complete certification documentation and are inspected before delivery. Pre-existing defects identified at the final inspection are rectified before delivery; damage from misuse after delivery is not covered.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">7. Limitation of Liability</h2>
            <p className="mb-4">Nestaro Homes shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our products or services. Our total liability shall not exceed the amount paid for the product.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">8. Governing Law</h2>
            <p className="mb-4">These Terms shall be governed by and construed in accordance with the laws of the State of Oregon, United States, without regard to its conflict of law provisions.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">9. Contact Information</h2>
            <p className="mb-4">For questions about these Terms, please contact us at:<br />Email: info@nestarohomes.com<br />Address: Portland, Oregon 97209, United States</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
