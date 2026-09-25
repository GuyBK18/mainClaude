import type { TargetAndTransition, Transition, Variants } from "framer-motion";

/** Layout shifts: grid reflow, tab content, container resizes. Settles without overshoot you can see. */
export const layoutSpring: Transition = { type: "spring", duration: 0.5, bounce: 0.12 };

/** Small indicators (tab underline, toggles). */
export const snappySpring: Transition = { type: "spring", duration: 0.35, bounce: 0.1 };

/** Decorative pointer-follow on 3D covers. Soft, with momentum. */
export const tiltSpring = { stiffness: 160, damping: 18, mass: 0.6 };

export const easeOut = [0.23, 1, 0.32, 1] as const;

/** Which way a filtered list moved: 1 to a tab on the right, -1 to a tab on the left, 0 for any other change. */
export type Direction = -1 | 0 | 1;
export type SwapCustom = { direction: Direction; index: number };

const SWAP_OFFSET = 40;

/**
 * Items entering and leaving a filtered list. After a tab change they slide in from the new
 * tab's side, a few at a time, and out the other side, so the list moves the way the underline
 * does. Other filter changes use `still`, a change in place. Pass `SwapCustom` as `custom`.
 */
export function swapVariants(still: TargetAndTransition): Variants {
  return {
    hidden: ({ direction }: SwapCustom) => (direction ? { opacity: 0, x: direction * SWAP_OFFSET } : still),
    shown: ({ direction, index }: SwapCustom) => ({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: { ...layoutSpring, delay: direction ? Math.min(index, 8) * 0.03 : 0 },
    }),
    gone: ({ direction }: SwapCustom) => ({
      ...(direction ? { opacity: 0, x: -direction * SWAP_OFFSET } : still),
      transition: { duration: 0.15 },
    }),
  };
}
