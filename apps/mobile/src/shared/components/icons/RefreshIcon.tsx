import Svg, { Path } from "react-native-svg";
import { colors } from "@/shared/theme";

interface RefreshIconProps {
  size?: number;
  color?: string;
}

/** Two circular arrows: "refresh now". Decorative: the button carries the label. */
export function RefreshIcon({ size = 16, color = colors.muted }: RefreshIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
