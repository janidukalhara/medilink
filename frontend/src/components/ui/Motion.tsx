import { ReactNode, useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function ParallaxImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  return (
    <div ref={ref} className={`parallax-image ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ y: reduced ? 0 : y }}
        loading={className.includes("hero") ? "eager" : "lazy"}
      />
    </div>
  );
}

export function AnimatedHeading({ text }: { text: string }) {
  const reduced = useReducedMotion();
  return (
    <span>
      <span className="sr-only">{text}</span>
      {text.split(" ").map((word, i) => (
        <span className="word-mask" aria-hidden="true" key={`${word}-${i}`}>
          <motion.span
            initial={reduced ? false : { y: "110%" }}
            animate={{ y: 0 }}
            transition={{
              delay: 0.15 + i * 0.075,
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}
