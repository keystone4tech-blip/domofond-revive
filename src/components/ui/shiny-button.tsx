import type React from "react";

interface ShinyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export function ShinyButton({ 
  children, 
  onClick, 
  className = "", 
  type = "button", 
  disabled = false,
  href,
  target,
  rel
}: ShinyButtonProps) {
  const styles = `
    @import url("https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,500&display=swap");

    @property --gradient-angle {
      syntax: "<angle>";
      initial-value: 0deg;
      inherits: false;
    }

    @property --gradient-angle-offset {
      syntax: "<angle>";
      initial-value: 0deg;
      inherits: false;
    }

    @property --gradient-percent {
      syntax: "<percentage>";
      initial-value: 5%;
      inherits: false;
    }

    @property --gradient-shine {
      syntax: "<color>";
      initial-value: white;
      inherits: false;
    }

    .shiny-cta {
      --shiny-cta-bg: #2563eb;
      --shiny-cta-bg-subtle: #1d4ed8;
      --shiny-cta-fg: #ffffff;
      --shiny-cta-highlight: #60a5fa;
      --shiny-cta-highlight-subtle: #93c5fd;
      --animation: gradient-angle linear infinite;
      --duration: 3s;
      --shadow-size: 2px;
      --transition: 800ms cubic-bezier(0.25, 1, 0.5, 1);
      
      isolation: isolate;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      outline-offset: 4px;
      padding: 0.5rem 1.1rem;
      font-family: "Inter", sans-serif;
      font-size: 0.825rem;
      line-height: 1.2;
      font-weight: 600;
      border: 1px solid transparent;
      border-radius: 12px;
      color: var(--shiny-cta-fg);
      background: linear-gradient(var(--shiny-cta-bg), var(--shiny-cta-bg)) padding-box,
        conic-gradient(
          from calc(var(--gradient-angle) - var(--gradient-angle-offset)),
          transparent,
          var(--shiny-cta-highlight) var(--gradient-percent),
          var(--gradient-shine) calc(var(--gradient-percent) * 2),
          var(--shiny-cta-highlight) calc(var(--gradient-percent) * 3),
          transparent calc(var(--gradient-percent) * 4)
        ) border-box;
      box-shadow: inset 0 0 0 1px var(--shiny-cta-bg-subtle), 0 4px 12px rgba(37, 99, 235, 0.2);
      transition: var(--transition);
      transition-property: --gradient-angle-offset, --gradient-percent, --gradient-shine, transform, box-shadow;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .dark .shiny-cta {
      --shiny-cta-bg: #0f172a;
      --shiny-cta-bg-subtle: #1e293b;
      --shiny-cta-fg: #ffffff;
      --shiny-cta-highlight: #3b82f6;
      --shiny-cta-highlight-subtle: #60a5fa;
      box-shadow: inset 0 0 0 1px var(--shiny-cta-bg-subtle), 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    .shiny-cta::before,
    .shiny-cta::after,
    .shiny-cta span::before {
      content: "";
      pointer-events: none;
      position: absolute;
      inset-inline-start: 50%;
      inset-block-start: 50%;
      translate: -50% -50%;
      z-index: -1;
    }

    .shiny-cta:active {
      transform: scale(0.98) translateY(1px);
    }

    /* Dots pattern */
    .shiny-cta::before {
      --size: calc(100% - var(--shadow-size) * 3);
      --position: 2px;
      --space: calc(var(--position) * 2);
      width: var(--size);
      height: var(--size);
      background: radial-gradient(
        circle at var(--position) var(--position),
        white calc(var(--position) / 4),
        transparent 0
      ) padding-box;
      background-size: var(--space) var(--space);
      background-repeat: space;
      mask-image: conic-gradient(
        from calc(var(--gradient-angle) + 45deg),
        black,
        transparent 10% 90%,
        black
      );
      border-radius: inherit;
      opacity: 0.2;
      z-index: -1;
    }

    /* Inner shimmer */
    .shiny-cta::after {
      --animation: shimmer linear infinite;
      width: 100%;
      aspect-ratio: 1;
      background: linear-gradient(
        -50deg,
        transparent,
        var(--shiny-cta-highlight),
        transparent
      );
      mask-image: radial-gradient(circle at bottom, transparent 40%, black);
      opacity: 0.4;
    }

    .shiny-cta span {
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .shiny-cta span::before {
      --size: calc(100% + 1rem);
      width: var(--size);
      height: var(--size);
      box-shadow: inset 0 -1ex 2rem 4px var(--shiny-cta-highlight);
      opacity: 0;
      transition: opacity var(--transition);
      animation: calc(var(--duration) * 1.5) breathe linear infinite;
    }

    /* Animate */
    .shiny-cta,
    .shiny-cta::before,
    .shiny-cta::after {
      animation: var(--animation) var(--duration),
        var(--animation) calc(var(--duration) / 0.4) reverse paused;
      animation-composition: add;
    }

    .shiny-cta:is(:hover, :focus-visible) {
      --gradient-percent: 20%;
      --gradient-angle-offset: 95deg;
      --gradient-shine: var(--shiny-cta-highlight-subtle);
      transform: scale(1.03) translateY(-1px);
      box-shadow: inset 0 0 0 1px var(--shiny-cta-highlight), 0 8px 20px rgba(37, 99, 235, 0.3);
    }

    .dark .shiny-cta:is(:hover, :focus-visible) {
      box-shadow: inset 0 0 0 1px var(--shiny-cta-highlight), 0 8px 20px rgba(59, 130, 246, 0.4);
    }

    .shiny-cta:is(:hover, :focus-visible),
    .shiny-cta:is(:hover, :focus-visible)::before,
    .shiny-cta:is(:hover, :focus-visible)::after {
      animation-play-state: running;
    }

    .shiny-cta:is(:hover, :focus-visible) span::before {
      opacity: 1;
    }

    .shiny-cta:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
      animation-play-state: paused !important;
    }

    @keyframes gradient-angle {
      to {
        --gradient-angle: 360deg;
      }
    }

    @keyframes shimmer {
      to {
        rotate: 360deg;
      }
    }

    @keyframes breathe {
      from, to {
        scale: 1;
      }
      50% {
        scale: 1.2;
      }
    }
  `;

  if (href) {
    return (
      <>
        <style>{styles}</style>
        <a 
          href={href} 
          target={target} 
          rel={rel} 
          className={`shiny-cta ${className}`}
          onClick={onClick}
        >
          <span>{children}</span>
        </a>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <button 
        type={type} 
        disabled={disabled} 
        className={`shiny-cta ${className}`} 
        onClick={onClick}
      >
        <span>{children}</span>
      </button>
    </>
  );
}
