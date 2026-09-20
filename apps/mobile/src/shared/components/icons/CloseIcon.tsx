import Svg, { Path } from "react-native-svg";
import { colors } from "@/shared/theme";

interface CloseIconProps {
  size?: number;
  color?: string;
}

/** "✕" drawn as SVG so it looks the same on every font. Decorative: the button carries the label. */
export function CloseIcon({ size = 20, color = colors.ink }: CloseIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M5 5l10 10M15 5L5 15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
