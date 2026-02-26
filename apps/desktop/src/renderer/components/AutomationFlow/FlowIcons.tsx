import React from 'react';

export type FlowIconName =
  | 'arrowLeft'
  | 'play'
  | 'stopSquare'
  | 'pause'
  | 'save'
  | 'check'
  | 'x'
  | 'xCircle'
  | 'alertTriangle'
  | 'copy'
  | 'edit'
  | 'trash'
  | 'flask'
  | 'lightbulb'
  | 'hand'
  | 'mousePointer'
  | 'mapPin'
  | 'target'
  | 'keyboard'
  | 'clock'
  | 'search'
  | 'repeat'
  | 'camera'
  | 'bolt'
  | 'brain';

interface FlowIconProps extends React.SVGProps<SVGSVGElement> {
  name: FlowIconName;
  size?: number;
  strokeWidth?: number;
}

const baseProps = {
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function FlowIcon({ name, size = 16, strokeWidth = 2, ...props }: FlowIconProps) {
  const common = {
    ...baseProps,
    width: size,
    height: size,
    strokeWidth,
    viewBox: '0 0 24 24',
    ...props,
  };

  switch (name) {
    case 'arrowLeft':
      return (
        <svg {...common}>
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      );
    case 'play':
      return (
        <svg {...common}>
          <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
      );
    case 'stopSquare':
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common}>
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      );
    case 'save':
      return (
        <svg {...common}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <path d="M17 21v-8H7v8" />
          <path d="M7 3v5h8" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="m20 6-11 11-5-5" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case 'xCircle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9 9 15" />
          <path d="m9 9 6 6" />
        </svg>
      );
    case 'alertTriangle':
      return (
        <svg {...common}>
          <path d="m10.29 3.86-8.9 15.42A2 2 0 0 0 3.1 22h17.8a2 2 0 0 0 1.72-2.72l-8.9-15.42a2 2 0 0 0-3.43 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );
    case 'flask':
      return (
        <svg {...common}>
          <path d="M9 3h6" />
          <path d="M10 3v6.5l-5.5 9A2 2 0 0 0 6.2 22h11.6a2 2 0 0 0 1.7-3.5L14 9.5V3" />
          <path d="M8.5 14h7" />
        </svg>
      );
    case 'lightbulb':
      return (
        <svg {...common}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.8c.6.5 1 1.3 1 2.2h6c0-.9.4-1.7 1-2.2A7 7 0 0 0 12 2z" />
        </svg>
      );
    case 'hand':
      return (
        <svg {...common}>
          <path d="M7 11.5V8a1.5 1.5 0 1 1 3 0V11" />
          <path d="M10 11V6.5a1.5 1.5 0 1 1 3 0V11" />
          <path d="M13 11V7.5a1.5 1.5 0 1 1 3 0V12" />
          <path d="M16 12V9a1.5 1.5 0 1 1 3 0v6.5A4.5 4.5 0 0 1 14.5 20H11a5 5 0 0 1-5-5v-2.5a1.5 1.5 0 1 1 3 0V13" />
        </svg>
      );
    case 'mousePointer':
      return (
        <svg {...common}>
          <path d="m4 4 7.07 17 2.51-7.42L21 11.07Z" />
          <path d="m13.58 13.58 5.66 5.66" />
        </svg>
      );
    case 'mapPin':
      return (
        <svg {...common}>
          <path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case 'keyboard':
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M6 10h.01" />
          <path d="M9 10h.01" />
          <path d="M12 10h.01" />
          <path d="M15 10h.01" />
          <path d="M18 10h.01" />
          <path d="M6 14h12" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'repeat':
      return (
        <svg {...common}>
          <path d="M17 2v4h-4" />
          <path d="M7 22v-4h4" />
          <path d="M20 11a8 8 0 0 0-13.66-5.66L3 8" />
          <path d="M4 13a8 8 0 0 0 13.66 5.66L21 16" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...common}>
          <path d="M5 7h3l2-2h4l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z" />
        </svg>
      );
    case 'brain':
      return (
        <svg {...common}>
          <path d="M9 4a3 3 0 0 0-3 3v1.2A2.8 2.8 0 0 0 4 11a2.8 2.8 0 0 0 2 2.8V15a3 3 0 0 0 3 3" />
          <path d="M15 4a3 3 0 0 1 3 3v1.2A2.8 2.8 0 0 1 20 11a2.8 2.8 0 0 1-2 2.8V15a3 3 0 0 1-3 3" />
          <path d="M9 7.5A2.5 2.5 0 0 1 11.5 10V18" />
          <path d="M15 7.5A2.5 2.5 0 0 0 12.5 10V18" />
          <path d="M9 12h6" />
        </svg>
      );
    default:
      return null;
  }
}
