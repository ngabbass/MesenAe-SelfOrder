import React from 'react';
import { cn, sanitizeHtml } from '@/lib/utils';
import { type Banner } from '@/hooks/db-hooks';
import { Gift } from 'lucide-react';
import { cldBanner, cldUrl } from '@/lib/cld';

interface PromoBannerProps {
  banner: Banner;
  className?: string;
  onAction?: () => void;
  priority?: boolean;
}

const hexToRgb = (hex: string) => {
  if (!hex) return '0, 0, 0';
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
  const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
  const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
};

export default function PromoBanner({ banner, className, onAction, priority }: PromoBannerProps) {
  // ── Position defaults ─────────────────────────────────────────────────────
  const headingP = banner.headingPos ?? { x: 10, y: 20, w: 40 };
  const titleP   = banner.titlePos   ?? { x: 10, y: 38, w: 60 };
  const descP    = banner.descPos    ?? { x: 10, y: 60, w: 60 };
  const buttonP  = banner.buttonPos  ?? { x: 10, y: 82, w: 60 };
  // ── Filters ───────────────────────────────────────────────────────────────
  const bgFilter        = banner.canvasBgFilter      || { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
  const bgFilterStyle   = `brightness(${bgFilter.brightness}%) contrast(${bgFilter.contrast}%) saturate(${bgFilter.saturate}%) blur(${bgFilter.blur}px)`;
  const bgGradientOverlay   = banner.bgGradientOverlay as any;

  let loadedOverlays = banner.overlays || [];
  if (loadedOverlays.length === 0 && banner.overlayImageUrl) {
    loadedOverlays = [{
      id: 'overlay-legacy',
      imageUrl: banner.overlayImageUrl,
      x: banner.overlayPos?.x ?? 80,
      y: banner.overlayPos?.y ?? 50,
      scale: banner.overlayScale ?? 1,
      rotate: banner.overlayRotate ?? 0,
      flipX: banner.overlayFlipX ?? false,
      borderRadius: (banner as any).overlayBorderRadius ?? 0,
      filter: (banner as any).canvasOverlayFilter ?? { brightness: 100, contrast: 100, saturate: 100, blur: 0 }
    }];
  }

  // ── Style maps ────────────────────────────────────────────────────────────
  const headingStyleMap = (style: string | undefined) => ({
    backgroundColor:
      style === 'solid-white'   ? '#FFFFFF' :
      style === 'solid-dark'    ? '#09090b' :
      style === 'outline-white' ? 'transparent' :
      style === 'neon'          ? 'rgba(34,211,238,0.15)' :
      style === 'retro'         ? '#fbbf24' :
      'rgba(255,255,255,0.2)',  // default = glass

    color:
      style === 'solid-white'   ? '#0f172a' :
      style === 'solid-dark'    ? '#ffffff' :
      style === 'outline-white' ? '#ffffff' :
      style === 'neon'          ? '#a5f3fc' :
      style === 'retro'         ? '#09090b' :
      '#ffffff',

    border:
      style === 'solid-white'   ? 'none' :
      style === 'solid-dark'    ? '1px solid #1e293b' :
      style === 'outline-white' ? '0.2cqw solid #ffffff' :
      style === 'neon'          ? '0.15cqw solid #22d3ee' :
      style === 'retro'         ? '0.2cqw solid #09090b' :
      '0.1cqw solid rgba(255,255,255,0.1)',

    boxShadow:
      style === 'neon'   ? '0 0 12px rgba(34,211,238,0.4)' :
      style === 'retro'  ? '0.25cqw 0.25cqw 0px #09090b' :
      'none',

    backdropFilter:
      (style === 'glass' || !style) ? 'blur(8px)' : undefined,
    fontWeight: '900',
    textTransform: 'uppercase' as const,
  });

  const buttonStyleMap = (style: string | undefined) => ({
    backgroundColor:
      style === 'outline'   ? 'transparent' :
      style === 'glass'     ? '#a3e635' : // lime green
      style === 'soft-dark' ? '#ff90e8' : // pink
      style === 'neon'      ? '#3bf4fb' : // cyan
      style === 'retro'     ? '#ffc700' : // yellow
      '#ffc700', // default to yellow
    color: '#000000',
    border: '2px solid #000000',
    boxShadow: '2.5px 2.5px 0px 0px #000000',
    fontWeight: '900',
    textTransform: 'uppercase' as const,
  });

  const textContrastClass = () => {
    if (banner.bgType === 'solid' && banner.bgColor) {
      const hex = banner.bgColor.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 140 ? 'text-black' : 'text-white';
      }
    }
    if (banner.bgType === 'gradient') {
      return 'text-white';
    }
    if (banner.imageUrl === 'preset:orange' || banner.imageUrl === 'preset:yellow') {
      return 'text-black';
    }
    return 'text-white';
  };

  const isLightText = textContrastClass() === 'text-white';

  return (
    /**
     * OUTER div:
     *   - Receives aspect ratio from className (21/9 mobile, 32/9 desktop).
     *   - containerType: inline-size → cqw here = full banner width.
     *   - Overlay image lives here so x=80% means 80% of the full banner width.
     *   - Background layers fill this full area.
     */
    <div
      className={cn(
        'w-full aspect-[21/9] rounded-2xl text-white relative overflow-hidden shadow-md select-none bg-slate-900',
        className,
      )}
      style={{
        containerType: 'inline-size',
        background:
          banner.bgType === 'solid'    ? banner.bgColor :
          banner.bgType === 'gradient' ? banner.bgGradient :
          undefined,
      }}
    >
      {/* ── BACKGROUND ──────────────────────────────────────────────────── */}
      {(!banner.bgType || banner.bgType === 'image') && banner.imageUrl && !banner.imageUrl.startsWith('preset:') ? (
        <div className="absolute inset-0 z-0">
          <img src={cldBanner(banner.imageUrl)} alt={banner.title} loading={priority ? "eager" : "lazy"} fetchpriority={priority ? "high" : "auto"} decoding="async" className="w-full h-full object-cover opacity-55" style={{ filter: bgFilterStyle }} width="800" height="450" />
          {bgGradientOverlay?.enabled ? (
            <div className="absolute inset-0" style={{ background: `linear-gradient(${bgGradientOverlay.angle ?? 90}deg, rgba(${hexToRgb(bgGradientOverlay.color || '#000000')}, ${(bgGradientOverlay.opacityLeft ?? 70) / 100}), rgba(${hexToRgb(bgGradientOverlay.color || '#000000')}, ${(bgGradientOverlay.opacityRight ?? 0) / 100}))` }} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          )}
        </div>
      ) : banner.bgType === 'solid' ? (
        <div className="absolute inset-0 z-0" style={{ backgroundColor: banner.bgColor || '#1E293B' }}>
          {loadedOverlays.length === 0 && <Gift size={90} className="absolute -right-3 -bottom-3 text-white/10 rotate-[-15deg]" />}
        </div>
      ) : banner.bgType === 'gradient' && banner.bgGradient ? (
        <div className="absolute inset-0 z-0" style={{ background: banner.bgGradient }}>
          {loadedOverlays.length === 0 && <Gift size={90} className="absolute -right-3 -bottom-3 text-white/10 rotate-[-15deg]" />}
        </div>
      ) : (
        <div className={cn('absolute inset-0 z-0 bg-gradient-to-br',
          banner.imageUrl === 'preset:green'  ? 'from-emerald-600 via-teal-600 to-cyan-600' :
          banner.imageUrl === 'preset:red'    ? 'from-rose-600 via-red-600 to-orange-600' :
          banner.imageUrl === 'preset:purple' ? 'from-fuchsia-600 via-purple-600 to-violet-600' :
          banner.imageUrl === 'preset:orange' ? 'from-orange-500 via-amber-500 to-yellow-500' :
          'from-blue-600 via-indigo-600 to-purple-600',
        )}>
          {loadedOverlays.length === 0 && <Gift size={90} className="absolute -right-3 -bottom-3 text-white/10 rotate-[-15deg]" />}
        </div>
      )}

      {/* ── OVERLAYS ─────────────────────────────────────────────────────────
           Positioned in the OUTER container so x%/y% map to full banner width.
      ─────────────────────────────────────────────────────────────────────── */}
      {loadedOverlays.map((overlay: any, idx: number) => {
        const overlayFilterStyle = `brightness(${overlay.filter?.brightness ?? 100}%) contrast(${overlay.filter?.contrast ?? 100}%) saturate(${overlay.filter?.saturate ?? 100}%) blur(${overlay.filter?.blur ?? 0}px)`;
        return (
          <div
            key={overlay.id}
            className="absolute pointer-events-none promo-overlay-container"
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 5 + idx,
              width: `${(overlay.scale ?? 1) * 20}%`,
            }}
          >
            <img
              src={cldUrl(overlay.imageUrl, { q: 'auto', f: 'auto' })}
              style={{
                transform: `scaleX(${overlay.flipX ? -1 : 1}) rotate(${overlay.rotate ?? 0}deg)`,
                filter: overlayFilterStyle,
                borderRadius: `${overlay.borderRadius ?? 0}%`,
              }}
              className="w-full h-auto object-contain drop-shadow-2xl pointer-events-none"
              decoding="async"
              alt="Overlay"
              loading={priority ? "eager" : "lazy"}
              fetchpriority={priority ? "high" : "auto"}
              width="600"
              height="600"
            />
          </div>
        );
      })}

      {/* ── CONTENT ZONE ─────────────────────────────────────────────────────
           On mobile: w-full, cqw based on full width.
           On desktop: constrained to 21/9 box so text doesn't overlap or get huge.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="absolute inset-y-0 left-0 w-[62%] z-10 p-[4cqw] sm:p-[5cqw] flex flex-col justify-center items-start gap-[1.5cqw] pointer-events-none text-left">
        {/* Heading badge */}
        {banner.heading && (
          <div className="pointer-events-none">
            <span
              className="promo-heading px-[1.5cqw] py-[0.5cqw] rounded inline-block uppercase tracking-widest font-black select-none text-center"
              style={{
                ...headingStyleMap(banner.headingStyle),
                fontSize: 'clamp(7px, 2.0cqw, 11px)',
                lineHeight: '1.1'
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(banner.heading) }}
            />
          </div>
        )}

        {/* Title */}
        {banner.title && (
          <div className="pointer-events-none w-full">
            <h4
              className={cn(
                "promo-title font-black leading-tight whitespace-normal break-words m-0 text-left select-none uppercase tracking-wide",
                isLightText ? "text-white" : "text-black"
              )}
              style={{
                fontSize: 'clamp(9px, 3.4cqw, 16px)',
                textShadow: isLightText
                  ? '2px 2px 0px rgba(0,0,0,0.95)'
                  : '1px 1px 0px rgba(255,255,255,0.7)'
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(banner.title) }}
            />
          </div>
        )}

        {/* Description */}
        {banner.description && (
          <div className="pointer-events-none w-full">
            <p
              className={cn(
                "promo-desc whitespace-normal break-words leading-tight font-black m-0 text-left select-none uppercase tracking-wide opacity-90",
                isLightText ? "text-slate-100" : "text-slate-900"
              )}
              style={{
                fontSize: 'clamp(7.5px, 2.0cqw, 11px)',
                textShadow: isLightText
                  ? '1.5px 1.5px 0px rgba(0,0,0,0.9)'
                  : '0.5px 0.5px 0px rgba(255,255,255,0.5)'
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(banner.description) }}
            />
          </div>
        )}

        {/* Button */}
        {(onAction || banner.link || banner.buttonText) && (
          <div className="pointer-events-auto mt-[0.5cqw]">
            <button
              onClick={e => {
                e.stopPropagation();
                if (banner.link) {
                  if (banner.link.startsWith('http')) window.open(banner.link, '_blank');
                  else window.location.href = banner.link;
                } else if (onAction) onAction();
              }}
              style={{
                ...buttonStyleMap(banner.badgeStyle),
                fontSize: 'clamp(8px, 2.2cqw, 12px)'
              }}
              className="promo-btn font-extrabold px-[2.5cqw] py-[0.8cqw] rounded-none shadow-sm hover:opacity-90 active:scale-95 transition-all inline-block pointer-events-auto select-none"
            >
              {banner.buttonText || 'Lihat Detail'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
