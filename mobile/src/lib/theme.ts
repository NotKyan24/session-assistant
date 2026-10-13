/**
 * COLORS: one palette for light mode and one for dark mode.
 *
 * Screens call `useColors()` and use names like `colors.text` instead of hex
 * codes, so the whole app follows the phone's light/dark setting.
 */
import { useColorScheme } from "react-native";

const light = {
  background: "#FFFFFF",
  surface: "#F2F4F7",
  text: "#101828",
  muted: "#667085",
  border: "#D0D5DD",
  primary: "#1D6FE0",
  onPrimary: "#FFFFFF",
  danger: "#D92D20",
  success: "#12B76A",
  disabled: "#98A2B3",
};

const dark: typeof light = {
  background: "#0C111D",
  surface: "#1F242F",
  text: "#F5F5F6",
  muted: "#94969C",
  border: "#333741",
  primary: "#4B8DF0",
  onPrimary: "#FFFFFF",
  danger: "#F97066",
  success: "#47CD89",
  disabled: "#61646C",
};

export type Colors = typeof light;

// Picks the palette from the phone's current appearance setting.
export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

/** One color per speaker on the Transcript screen; repeats after six speakers. */
export const SPEAKER_COLORS = ["#1D6FE0", "#C4320A", "#079455", "#7A5AF8", "#DD2590", "#0E9384"];
