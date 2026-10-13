import { useReducedMotion } from 'framer-motion';
import FluxLines from './reactbits/FluxLines';

const COLORS = ['#35886f', '#5fab91', '#8cc9b2'];

/** One decorative canvas for every public, patient, pharmacy and admin route. */
export default function AmbientBackground() {
  const reduced = useReducedMotion();
  return (
    <div className="ambient-background" aria-hidden="true">
      <div className="ambient-wash" />
      <FluxLines
        key={reduced ? 'still' : 'motion'}
        colors={COLORS}
        lightMode
        transparent
        opacity={0.26}
        speed={0.12}
        scale={2.2}
        turbulence={0.65}
        shimmer={0.45}
        lineWidth={0.7}
        glow={1.1}
        dpr={0.85}
        paused={!!reduced}
        intro={!reduced}
        mouseInteraction={!reduced}
        mouseStrength={0.35}
        clickSwirl={false}
      />
    </div>
  );
}
