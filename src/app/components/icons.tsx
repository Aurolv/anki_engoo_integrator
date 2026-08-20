import type { SVGProps } from "react";

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

export function Plus(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function Alert(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.4h.01" />
    </svg>
  );
}

export function Spinner(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M21 12a9 9 0 1 0-9 9" />
    </svg>
  );
}

export function Speaker(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M11 5 6.5 9H3.5v6h3L11 19V5Z" />
      <path d="M15 9.8a3.4 3.4 0 0 1 0 4.4" />
      <path d="M17.8 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

export function Sun(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}

export function Moon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M20 14.3A8.5 8.5 0 0 1 9.7 4a8.5 8.5 0 1 0 10.3 10.3Z" />
    </svg>
  );
}
