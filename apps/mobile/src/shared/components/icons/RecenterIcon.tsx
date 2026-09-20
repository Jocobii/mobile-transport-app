import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/shared/theme";

interface RecenterIconProps {
  size?: number;
  color?: string;
}

/** Crosshair "go to my location" icon. Decorative: the button carries the label. */
export function RecenterIcon({ size = 24, color = colors.ink }: RecenterIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="2" fill={color} />
      <Path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
