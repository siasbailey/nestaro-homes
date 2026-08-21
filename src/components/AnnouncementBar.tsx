import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { MessageCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import {
  ANNOUNCEMENT_PAGES,
  announcementSpeedSeconds,
  type AnnouncementDirection,
  type AnnouncementDisplayMode,
  type AnnouncementSpeed,
} from "@contracts/announcements";

export interface TickerMessage {
  id: number;
  title: string | null;
  message: string;
}

export interface TickerSettings {
  displayMode: AnnouncementDisplayMode;
  speed: AnnouncementSpeed;
  direction: AnnouncementDirection;
  pauseOnHover: "yes" | "no";
  autoRepeat: "yes" | "no";
  bgColor: string;
  textColor: string;
}

function SocialLinks({ bgColor }: { bgColor: string }) {
  return (
    <div
      className="absolute right-0 top-0 h-full flex items-center gap-3 px-4"
      style={{ background: `linear-gradient(to left, ${bgColor}, ${bgColor}, transparent)` }}
    >
      <a
        href="https://wa.me/15064978043"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:scale-110 transition-transform"
        title="WhatsApp"
      >
        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
      <a
        href="https://tiktok.com/@nestaro_homes"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:scale-110 transition-transform"
        title="TikTok"
      >
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.33 6.34 6.34 6.34 0 006.33-6.33V8.83a8.26 8.26 0 004.83 1.54v-3.5c-.03.01-.05.01-.05.01V6.7z"/>
        </svg>
      </a>
      <a
        href="https://facebook.com/nestarohomes"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:scale-110 transition-transform"
        title="Facebook"
      >
        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      </a>
    </div>
  );
}

function MessageSpan({ m, iconColor }: { m: TickerMessage; iconColor: string }) {
  return (
    <span className="text-sm font-medium flex items-center gap-2">
      <MessageCircle className="w-4 h-4 shrink-0" style={{ color: iconColor }} />
      {m.title && <span className="font-bold">{m.title}:</span>}
      {m.message}
    </span>
  );
}

/** Pure presentational ticker — also reused by the admin preview. */
export function AnnouncementTicker({ messages, settings }: { messages: TickerMessage[]; settings: TickerSettings }) {
  const [rotateIndex, setRotateIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const isRotate = settings.displayMode === "rotate";

  useEffect(() => {
    if (!isRotate || paused || messages.length <= 1) return;
    const timer = setInterval(() => {
      setRotateIndex((i) => {
        if (i + 1 >= messages.length) {
          return settings.autoRepeat === "yes" ? 0 : i;
        }
        return i + 1;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [isRotate, paused, messages.length, settings.autoRepeat]);

  useEffect(() => setRotateIndex(0), [messages.length, settings.displayMode]);

  if (messages.length === 0) return null;

  const seconds = announcementSpeedSeconds(settings.speed);
  const marqueeStyle: React.CSSProperties = {
    animationDuration: `${seconds}s`,
    animationDirection: settings.direction === "ltr" ? "reverse" : "normal",
    animationIterationCount: settings.autoRepeat === "yes" ? "infinite" : 1,
    animationFillMode: settings.autoRepeat === "yes" ? undefined : "forwards",
  };
  const pauseClass = settings.pauseOnHover === "yes" ? "hover:[animation-play-state:paused]" : "";

  return (
    <div
      className="overflow-hidden whitespace-nowrap relative z-10 h-10 flex items-center"
      style={{ backgroundColor: settings.bgColor, color: settings.textColor }}
      onMouseEnter={() => settings.pauseOnHover === "yes" && setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {isRotate ? (
        <div className="px-4 w-full">
          <div key={rotateIndex} className="animate-[fadein_0.5s_ease-in] inline-flex">
            <span className="truncate inline-flex max-w-full">
              <MessageSpan m={messages[rotateIndex % messages.length]} iconColor="#c47a45" />
            </span>
          </div>
        </div>
      ) : (
        <div className={`animate-scroll-x inline-flex items-center gap-8 px-4 ${pauseClass}`} style={marqueeStyle}>
          {[0, 1, 2].map((copy) => (
            <span key={copy} className="inline-flex items-center gap-8">
              {messages.map((m) => (
                <MessageSpan key={`${copy}-${m.id}`} m={m} iconColor="#c47a45" />
              ))}
            </span>
          ))}
        </div>
      )}
      <SocialLinks bgColor={settings.bgColor} />
    </div>
  );
}

/** Website-wide bar — fetches live announcements and decides where to render. */
export default function AnnouncementBar() {
  const location = useLocation();
  const { data, isError } = trpc.announcement.publicBar.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isError || !data || data.announcements.length === 0) return null;

  const { visibility, selectedPages } = data.settings;
  const path = location.pathname;
  const pagePaths = new Set<string>(ANNOUNCEMENT_PAGES.map((p) => p.path));
  const visible =
    visibility === "homepage"
      ? path === "/"
      : visibility === "all"
        ? pagePaths.has(path)
        : selectedPages.includes(path);
  if (!visible) return null;

  return (
    <>
      {/* Clears the fixed h-20 navbar so the bar sits directly underneath it
          (a spacer — not a margin — so it cannot collapse through the page). */}
      <div className="h-20" aria-hidden="true" />
      <AnnouncementTicker messages={data.announcements} settings={data.settings} />
    </>
  );
}

