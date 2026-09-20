import type { ComponentProps } from "react";
import {
  type FlatListProps,
  type ScrollViewProps,
  SectionList,
  type SectionListProps,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSheetScroll } from "./BottomSheet";

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

/** No overscroll, so a downward drag at the top of a list goes to the sheet and nothing bounces. */
const NO_OVERSCROLL = { bounces: false, overScrollMode: "never" } as const;

/** `FlatList` that hands downward drags at its top to the bottom sheet (E008-T03). */
export function SheetFlatList<T>(props: FlatListProps<T>) {
  const { scrollGesture, scrollHandler } = useSheetScroll();
  return (
    <GestureDetector gesture={scrollGesture}>
      <Animated.FlatList
        {...(props as unknown as ComponentProps<typeof Animated.FlatList>)}
        {...NO_OVERSCROLL}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      />
    </GestureDetector>
  );
}

/** `SectionList` that hands downward drags at its top to the bottom sheet (E008-T03). */
export function SheetSectionList<ItemT, SectionT>(props: SectionListProps<ItemT, SectionT>) {
  const { scrollGesture, scrollHandler } = useSheetScroll();
  return (
    <GestureDetector gesture={scrollGesture}>
      <AnimatedSectionList
        {...(props as SectionListProps<unknown, unknown>)}
        {...NO_OVERSCROLL}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      />
    </GestureDetector>
  );
}

/** `ScrollView` that hands downward drags at its top to the bottom sheet (E008-T03). */
export function SheetScrollView(props: ScrollViewProps) {
  const { scrollGesture, scrollHandler } = useSheetScroll();
  return (
    <GestureDetector gesture={scrollGesture}>
      <Animated.ScrollView
        {...props}
        {...NO_OVERSCROLL}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      />
    </GestureDetector>
  );
}
