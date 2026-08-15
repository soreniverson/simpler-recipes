/**
 * One icon set for the recipe surfaces: outline, 1.75 stroke, sized via className (default 20px).
 */
function Icon({ children, className = 'w-5 h-5', strokeWidth = 1.75, ...rest }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p) => (
  <Icon {...p}>
    <path d="M6.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7Z" />
  </Icon>
);
export const CloseIcon = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const ChevronLeftIcon = (p) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const ChevronRightIcon = (p) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
export const CheckIcon = (p) => (
  <Icon {...p} strokeWidth={2.25}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const HeartIcon = ({ filled, ...p }) =>
  filled ? (
    <svg className={p.className || 'w-5 h-5'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  ) : (
    <Icon {...p}>
      <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </Icon>
  );
export const ShareIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </Icon>
);
export const PrintIcon = (p) => (
  <Icon {...p}>
    <path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <path d="M7 14h10v6H7z" />
  </Icon>
);
export const CopyIcon = (p) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
);
export const LinkIcon = (p) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.1 1.1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.1-1.1" />
  </Icon>
);
export const ExternalIcon = (p) => (
  <Icon {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  </Icon>
);
export const ListIcon = (p) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth={2.5} />
  </Icon>
);
export const TimerIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5M9 2h6" />
  </Icon>
);
export const MinusIcon = (p) => (
  <Icon {...p} strokeWidth={2}>
    <path d="M5 12h14" />
  </Icon>
);
export const PlusIcon = (p) => (
  <Icon {...p} strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const SparklesIcon = (p) => (
  <Icon {...p}>
    <path d="M9.8 15.9L9 18.75l-.8-2.85a4.5 4.5 0 0 0-3.1-3.1L2.25 12l2.85-.8a4.5 4.5 0 0 0 3.1-3.1L9 5.25l.8 2.85a4.5 4.5 0 0 0 3.1 3.1l2.85.8-2.85.8a4.5 4.5 0 0 0-3.1 3.1z" />
    <path d="M18.3 8.7L18 9.75l-.3-1.05a3.4 3.4 0 0 0-2.4-2.4L14.25 6l1.05-.3a3.4 3.4 0 0 0 2.4-2.4L18 2.25l.3 1.05a3.4 3.4 0 0 0 2.4 2.4l1.05.3-1.05.3a3.4 3.4 0 0 0-2.4 2.4z" />
  </Icon>
);
export const RotateIcon = (p) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5M20 4v4.5h-4.5" />
    <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5M4 20v-4.5h4.5" />
  </Icon>
);
export const ImagePlaceholderIcon = (p) => (
  <Icon {...p} strokeWidth={1.25}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 16l5-5 4 4 3-3 6 6" />
    <circle cx="16" cy="9" r="1.5" />
  </Icon>
);
