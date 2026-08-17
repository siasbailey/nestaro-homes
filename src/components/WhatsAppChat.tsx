import { useState } from "react";
import { MessageCircle, X, Send, User } from "lucide-react";

const quickReplies = ["Pricing", "Financing", "Viewing", "Payment"];

const responses: Record<string, string> = {
  pricing: "Our premium tiny homes range from $20,000 for The Spruce Studio to $189,000 for The Tillamook Grand. All prices include full documentation and delivery coordination.",
  mortgage: "Yes! Financing is available on eligible models. Pay a deposit and spread the balance in monthly or yearly installments. See the Financing page for plans and our calculator.",
  inspection: "Absolutely — we encourage viewings. Book an appointment with our consultants at any time, and a final inspection is always scheduled before delivery.",
  payment: "We accept bank transfer, Zelle, and cryptocurrency (BTC, ETH, USDT) for outright purchases. Financing purchases start with a deposit.",
};

export default function WhatsAppChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ from: "user" | "agent"; text: string }[]>([
    { from: "agent", text: "Hello! Welcome to Nestaro Homes. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { from: "user", text }]);
    setInput("");

    setTimeout(() => {
      const lower = text.toLowerCase();
      let reply = "Thank you for your message! Our team will get back to you shortly. For immediate assistance, please call +1 (506) 497-8043 or email info@nestarohomes.com";
      
      for (const [key, value] of Object.entries(responses)) {
        if (lower.includes(key)) {
          reply = value;
          break;
        }
      }
      if (lower.includes("price") || lower.includes("cost") || lower.includes("$") || lower.includes("dollar")) reply = responses.pricing;
      else if (lower.includes("mortgage") || lower.includes("financ") || lower.includes("installment") || lower.includes("plan")) reply = responses.mortgage;
      else if (lower.includes("inspect") || lower.includes("view") || lower.includes("visit")) reply = responses.inspection;
      else if (lower.includes("pay")) reply = responses.payment;

      setMessages((prev) => [...prev, { from: "agent", text: reply }]);
    }, 1000);
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 rounded-full shadow-lg hover:bg-green-600 transition flex items-center justify-center text-white hover:scale-110"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-[#075e54] text-white p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Nestaro Homes Support</h3>
                  <div className="flex items-center gap-1 text-xs text-green-300">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    Online now
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.from === "user" ? "justify-end" : ""}`}>
                {msg.from === "agent" && (
                  <div className="w-8 h-8 bg-[#075e54] rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl shadow-sm max-w-[80%] text-sm ${
                    msg.from === "user"
                      ? "bg-[#dcf8c6] text-gray-800 rounded-tr-none"
                      : "bg-white text-gray-700 rounded-tl-none"
                  }`}
                >
                  {msg.text}
                </div>
                {msg.from === "user" && (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Replies */}
          <div className="px-4 py-2 bg-white border-t">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full whitespace-nowrap transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#26342b] text-sm"
              />
              <button
                onClick={() => sendMessage(input)}
                className="bg-[#075e54] text-white px-4 py-2 rounded-lg hover:bg-[#064e45] transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
