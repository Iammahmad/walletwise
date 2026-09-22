import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

export type CategoryIcon = ComponentProps<typeof Ionicons>["name"];

export const CATEGORY_ICONS: readonly CategoryIcon[] = [
  "restaurant-outline",
  "cart-outline",
  "basket-outline",
  "bus-outline",
  "car-outline",
  "bag-handle-outline",
  "receipt-outline",
  "game-controller-outline",
  "film-outline",
  "medical-outline",
  "medkit-outline",
  "school-outline",
  "home-outline",
  "airplane-outline",
  "paw-outline",
  "cafe-outline",
  "gift-outline",
  "fitness-outline",
  "phone-portrait-outline",
  "construct-outline",
  "people-outline",
  "briefcase-outline",
  "cash-outline",
  "arrow-down-circle-outline",
  "pie-chart-outline",
  "ellipsis-horizontal-outline",
];

export const CATEGORY_COLORS = [
  "#087F5B",
  "#059669",
  "#047857",
  "#0284C7",
  "#2563EB",
  "#4F46E5",
  "#7C3AED",
  "#9333EA",
  "#DB2777",
  "#DC2626",
  "#EA580C",
  "#D97706",
  "#475569",
  "#64748B",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];
