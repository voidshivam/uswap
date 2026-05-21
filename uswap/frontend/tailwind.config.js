import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["index.html", "src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem" },
    extend: {
      colors: {
        // Brand
        indigo: {
          DEFAULT: "#5B6EFF",
          50: "#EEF0FF",
          100: "#E0E3FF",
          600: "#5B6EFF",
          700: "#4554E6",
        },
        mint: {
          DEFAULT: "#3DDC97",
          50: "#E7FBF2",
          100: "#D0F7E5",
          600: "#3DDC97",
          700: "#27B97A",
        },
        // Neutrals
        canvas: "#F7F8FA",
        card: "#FFFFFF",
        ink: "#1A1D2E",
        slate: "#5C6178",
        mist: "#8A8FA3",
        line: "#E8EAF0",
        danger: "#F0556E",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(26,29,46,0.06), 0 4px 16px -4px rgba(26,29,46,0.05)",
        lift: "0 8px 24px -6px rgba(26,29,46,0.10), 0 2px 8px -2px rgba(26,29,46,0.06)",
        glow: "0 8px 28px -6px rgba(91,110,255,0.35)",
        "glow-mint": "0 8px 28px -6px rgba(61,220,151,0.35)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        breathe: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        "bear-blink": {
          "0%,92%,100%": { transform: "scaleY(1)" },
          "96%": { transform: "scaleY(0.1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        float: "float 4s ease-in-out infinite",
        "spin-slow": "spin-slow 1.2s linear infinite",
        breathe: "breathe 3s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};
