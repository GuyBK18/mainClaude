import type { Transition } from "framer-motion";

/** Layout shifts: grid reflow, tab content, container resizes. Settles without overshoot you can see. */
export const layoutSpring: Transition = { type: "spring", duration: 0.5, bounce: 0.12 };

/** Small indicators (tab underline, toggles). */
export const snappySpring: Transition = { type: "spring", duration: 0.35, bounce: 0.1 };

/** Decorative pointer-follow on 3D covers. Soft, with momentum. */
export const tiltSpring = { stiffness: 160, damping: 18, mass: 0.6 };

export const easeOut = [0.23, 1, 0.32, 1] as const;
