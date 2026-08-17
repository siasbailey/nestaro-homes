import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { SERVED_COUNTRIES } from "@contracts/geo";
import BookAppointmentModal from "@/components/crm/BookAppointmentModal";

export default function ContactSection() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "United States",
    message: "",
  });
  const [bookingOpen, setBookingOpen] = useState(false);

  const contactMutation = trpc.contact.submit.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setForm({ firstName: "", lastName: "", email: "", phone: "", country: "United States", message: "" });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.message) {
      toast.error("Please fill in all required fields");
      return;
    }
    contactMutation.mutate(form);
  };

  const countries = [...SERVED_COUNTRIES];

  const fieldCls =
    "rounded-none border-0 border-b border-[#e0b48c] bg-transparent px-0 focus-visible:ring-0 focus-visible:border-[#26342b]";
  const labelCls = "block text-[11px] uppercase tracking-[0.2em] text-[#9ca3af] mb-2";

  return (
    <section id="contact" className="py-24 md:py-32 bg-[#f7f4ee]">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="grid lg:grid-cols-12 gap-10 mb-16 md:mb-24">
          <div className="lg:col-span-5">
            <p className="nh-label mb-6">Contact</p>
            <h2 className="nh-display text-4xl md:text-5xl">Get in touch</h2>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 flex items-end">
            <p className="text-lg text-[#3d5045] leading-relaxed">
              Our US team is here to help — open 24 hours, serving customers across the
              United States &amp; Europe.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-16">
          {/* Form — underline fields, no card */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last Name *</label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                    className={fieldCls}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className={labelCls}>Email Address *</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone (Optional)</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={fieldCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full bg-transparent border-0 border-b border-[#e0b48c] py-2 text-[#26342b] focus:outline-none focus:border-[#26342b]"
                >
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Message *</label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  required
                  placeholder="Tell us about your project..."
                  className={`${fieldCls} resize-none`}
                />
              </div>
              <button
                type="submit"
                disabled={contactMutation.isPending}
                className="bg-[#26342b] text-white px-10 py-4 text-sm font-medium tracking-wide hover:bg-[#192420] transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {contactMutation.isPending ? "Sending..." : "Send Message"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Contact details — definition rows */}
          <div className="lg:col-span-5">
            <dl className="space-y-8 border-t border-[#e0b48c] pt-10">
              <div>
                <dt className={labelCls}>Email</dt>
                <dd className="text-lg text-[#26342b]">info@nestarohomes.com</dd>
              </div>
              <div>
                <dt className={labelCls}>Phone / WhatsApp</dt>
                <dd className="text-lg text-[#26342b]">+1 (506) 497-8043</dd>
                <dd className="text-sm text-[#9ca3af] mt-1">Open 24 hours</dd>
              </div>
              <div>
                <dt className={labelCls}>Address</dt>
                <dd className="text-lg text-[#26342b]">Nestaro Homes LLC</dd>
                <dd className="text-[#3d5045]">Portland, Oregon 97209, United States</dd>
                <dd className="text-sm text-[#9ca3af] mt-1">Serving the United States &amp; Europe</dd>
              </div>
            </dl>

            <div className="mt-12 pt-10 border-t border-[#e0b48c] space-y-6">
              <a
                href="https://wa.me/15064978043"
                target="_blank"
                rel="noopener noreferrer"
                className="nh-link text-sm tracking-wide"
              >
                Chat on WhatsApp
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <p className="text-sm text-[#3d5045] leading-relaxed">
                Get instant replies from our team, any hour.
              </p>
              <button
                onClick={() => setBookingOpen(true)}
                className="nh-link text-sm tracking-wide"
              >
                Book an Appointment
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <p className="text-sm text-[#3d5045] leading-relaxed">
                Viewings, virtual tours, meetings &amp; consultations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {bookingOpen && <BookAppointmentModal onClose={() => setBookingOpen(false)} />}
    </section>
  );
}
