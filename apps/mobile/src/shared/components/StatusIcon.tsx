import Svg, { Circle, Path, Rect } from "react-native-svg";
import { type ArrivalStatusTone, statusColors } from "@/shared/theme";

interface StatusIconProps {
  status: ArrivalStatusTone;
  size?: number;
}

/** Decorative status glyph; the meaning is always also written as text next to it. */
export function StatusIcon({ status, size = 14 }: StatusIconProps) {
  const color = statusColors[status].fg;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {status === "ok" ? (
        <>
          <Circle cx="8" cy="8" r="2.5" fill={color} />
          <Path
            d="M3.5 4.5a6 6 0 0 0 0 7M12.5 4.5a6 6 0 0 1 0 7"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {status === "attention" ? (
        <>
          <Path d="M8 2 15 14H1L8 2Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
          <Path d="M8 6.5v3.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <Circle cx="8" cy="11.7" r="0.9" fill={color} />
        </>
      ) : null}
      {status === "problem" ? (
        <>
          <Circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.6" />
          <Path
            d="M5.5 5.5l5 5M10.5 5.5l-5 5"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {status === "neutral" ? (
        <>
          <Rect x="2" y="3" width="12" height="11" rx="2" stroke={color} strokeWidth="1.6" />
          <Path
            d="M2 7h12M5.5 1.5v3M10.5 1.5v3"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </Svg>
  );
}
