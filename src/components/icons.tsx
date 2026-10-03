interface IconProps {
  size?: number;
  className?: string;
}

function S({
  size = 15,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}





export const IconExport = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3v11M7.5 9.5L12 14l4.5-4.5" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </S>
);

export const IconEye = (p: IconProps) => (
  <S {...p}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
    <circle cx="12" cy="12" r="2.6" />
  </S>
);

export const IconEyeOff = (p: IconProps) => (
  <S {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 3.8M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.3-1" />
    <path d="M9.9 9.9a2.9 2.9 0 0 0 4.2 4.2" />
  </S>
);


export const IconPlus = (p: IconProps) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);

export const IconCheck = (p: IconProps) => (
  <S {...p}>
    <path d="M4 12.5l5 5L20 6.5" />
  </S>
);

export const IconClose = (p: IconProps) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </S>
);

export const IconSearch = (p: IconProps) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </S>
);

export const IconSparkle = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M18.5 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
  </S>
);








export const IconCopy = (p: IconProps) => (
  <S {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </S>
);


export const IconCube = (p: IconProps) => (
  <S {...p}>
    <path d="M12 2l9 5v10l-9 5-9-5V7z" />
    <path d="M12 12l9-5M12 12L3 7M12 12v10" />
  </S>
);





export const IconPolygon = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3l8 5.5-3 11H7l-3-11z" />
  </S>
);


export const IconMap = (p: IconProps) => (
  <S {...p}>
    <path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7z" />
    <path d="M9 4v13M15 7v13" />
  </S>
);

export const IconAlert = (p: IconProps) => (
  <S {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4.5M12 17.6v.01" />
  </S>
);

export const IconDocument = (p: IconProps) => (
  <S {...p}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
    <path d="M14 3v4h4M9 12h6M9 16h4" />
  </S>
);

export const IconTrash = (p: IconProps) => (
  <S {...p}>
    <path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" />
  </S>
);

export const IconUpload = (p: IconProps) => (
  <S {...p}>
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </S>
);

export const IconRefresh = (p: IconProps) => (
  <S {...p}>
    <path d="M20 11a8 8 0 1 0-1.8 6" />
    <path d="M20 4v7h-7" />
  </S>
);

export const IconSplit = (p: IconProps) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M12 4v16" />
  </S>
);

export const IconStack = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="15" width="16" height="5" rx="1" />
    <rect x="4" y="9" width="16" height="4" rx="1" />
    <rect x="7" y="3" width="10" height="4" rx="1" />
  </S>
);
