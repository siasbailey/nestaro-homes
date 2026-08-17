/**
 * Shared investor avatar bubble — shows the uploaded photo when present,
 * otherwise a professional initial monogram. Used across the investor
 * dashboard, navbar, and every admin record that references an investor.
 */
export default function InvestorAvatar({
  name,
  avatar,
  size = "sm",
  className = "",
}: {
  name?: string | null;
  avatar?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dims = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-xl",
    xl: "w-20 h-20 text-2xl",
  }[size];

  return (
    <div
      className={`${dims} rounded-full bg-[#26342b] flex items-center justify-center text-white font-bold overflow-hidden shrink-0 ${className}`}
    >
      {avatar ? (
        <img src={avatar} alt={name ?? "Investor"} className="w-full h-full object-cover" />
      ) : (
        (name?.trim()?.charAt(0).toUpperCase() ?? "?")
      )}
    </div>
  );
}
