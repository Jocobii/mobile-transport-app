import Svg, { Path } from "react-native-svg";
import { colors } from "@/shared/theme";

interface ChevronIconProps {
  size?: number;
  color?: string;
}

/** Right-pointing chevron: the "this row opens something" affordance. Decorative. */
export function ChevronIcon({ size = 20, color = colors.muted }: ChevronIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M7.5 4.5 13 10l-5.5 5.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
