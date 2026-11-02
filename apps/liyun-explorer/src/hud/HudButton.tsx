import { motion, type HTMLMotionProps } from 'framer-motion';
import { tween } from '../motion/transitions';
import { useMotionPreferences } from '../motion/useMotionPreferences';

/** framer 独占按钮 transform；CSS 只负责金线、颜色和焦点环。 */
export default function HudButton(props: HTMLMotionProps<'button'>) {
  const { reducedMotion } = useMotionPreferences();
  return <motion.button type="button" initial={false}
    whileHover={reducedMotion ? undefined : { y: -2 }}
    whileTap={reducedMotion ? undefined : { y: 1, scale: .985, transition: tween.tap }}
    transition={tween.fast} {...props}/>;
}
