import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "@/src/design/ThemeProvider";

export interface DonutSegment {
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerLabel,
  size = 126,
  strokeWidth = 16,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  size?: number;
  strokeWidth?: number;
}) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(
    segments.reduce((sum, item) => sum + Math.max(0, item.value), 0),
    1,
  );
  const arcs = segments.reduce<
    (DonutSegment & { dash: number; offset: number; end: number })[]
  >((result, segment) => {
    const fraction = Math.max(0, segment.value) / total;
    const start = result.at(-1)?.end ?? 0;
    return [
      ...result,
      {
        ...segment,
        dash: fraction * circumference,
        offset: -start * circumference,
        end: start + fraction,
      },
    ];
  }, []);
  return (
    <View
      accessible
      accessibilityLabel={centerLabel}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {arcs.map((segment, index) => {
          return (
            <Circle
              key={`${segment.color}-${index}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
              strokeDashoffset={segment.offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>
      <View style={styles.center}>
        <Text numberOfLines={2} style={[styles.label, { color: colors.text }]}>
          {centerLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: "absolute" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },
});
