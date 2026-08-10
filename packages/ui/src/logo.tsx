import React from "react";

/**
 * Madmail symbol — a white rounded square with the "M" glyph in black.
 * Monochrome by contract (see design-system: madmail). Uses Inter, which
 * the app loads globally; falls back to a system sans if unavailable.
 */
export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = ({ ...props }) => {
  return (
    <svg
      width="650"
      height="650"
      viewBox="0 0 650 650"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Madmail"
      {...props}
    >
      <rect x="0" y="0" width="650" height="650" rx="140" fill="#FAFAFA" />
      <text
        x="325"
        y="352"
        fill="#000000"
        fontFamily="Inter, 'Helvetica Neue', Arial, sans-serif"
        fontWeight={700}
        fontSize={440}
        letterSpacing="-16"
        textAnchor="middle"
        dominantBaseline="central"
      >
        M
      </text>
    </svg>
  );
};
