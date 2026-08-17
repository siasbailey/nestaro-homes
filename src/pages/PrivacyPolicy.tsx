import { Link } from "react-router";
import { ArrowLeft, Shield } from "lucide-react";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import Footer from "@/sections/Footer";

export default function PrivacyPolicy() {
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
            <Shield className="w-12 h-12 text-[#26342b] mx-auto mb-4" />
            <h1 className="text-4xl font-serif font-bold text-[#26342b] mb-4">Privacy Policy</h1>
            <p className="text-gray-600">Last updated: June 2026</p>
          </div>

          <div className="prose max-w-none text-gray-600">
            <h2 className="text-xl font-bold text-[#26342b] mb-3">1. Introduction</h2>
            <p className="mb-4">Nestaro Homes LLC ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or make a purchase.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">2. Information We Collect</h2>
            <p className="mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 mb-4 space-y-1">
              <li>Personal identification information (name, email, phone number)</li>
              <li>Contact address and location information</li>
              <li>Payment information (processed securely through third-party providers)</li>
              <li>Communication preferences and correspondence</li>
            </ul>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">3. How We Use Your Information</h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-1">
              <li>Process and fulfill your orders</li>
              <li>Communicate with you about your order status</li>
              <li>Provide customer support</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Improve our website and services</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">4. Information Sharing</h2>
            <p className="mb-4">We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc pl-6 mb-4 space-y-1">
              <li>Documentation and delivery partners for purchase processing purposes</li>
              <li>Payment processors to complete transactions</li>
              <li>Legal authorities when required by law</li>
            </ul>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">5. Data Security</h2>
            <p className="mb-4">We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. All data transmission is encrypted using SSL technology.</p>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">6. Your Rights</h2>
            <p className="mb-4">Under applicable US and international privacy laws, you have the right to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>

            <h2 className="text-xl font-bold text-[#26342b] mb-3">7. Contact Us</h2>
            <p className="mb-4">If you have any questions about this Privacy Policy, please contact us at:</p>
            <p className="mb-4">Email: info@nestarohomes.com<br />Address: Portland, Oregon 97209, United States</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
