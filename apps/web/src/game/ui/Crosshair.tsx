import { useRef, useEffect } from "react";
import { targetingData } from "../targeting/targeting-state";

const CURSOR_SIZE = 32;

/**
 * Custom SVG crosshair with magnetic cursor effect.
 *
 * Raw mouse position tracked via mousemove. Each rAF tick, if an enemy is
 * nearby (magneticStrength > 0 from useTargeting), the displayed position
 * lerps toward the enemy's screen position. The inner brackets tint red
 * when hovering a target.
 */
export function Crosshair() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bracketsRef = useRef<SVGGElement>(null);
  const rawMouse = useRef({ x: 0, y: 0 });
  const rafId = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Track raw mouse position
    function onMouseMove(e: MouseEvent) {
      rawMouse.current.x = e.clientX;
      rawMouse.current.y = e.clientY;
    }
    window.addEventListener("mousemove", onMouseMove);

    // rAF loop — compute final position with magnetic pull
    function tick() {
      const { magneticStrength, magneticScreenX, magneticScreenY } =
        targetingData;

      let finalX = rawMouse.current.x;
      let finalY = rawMouse.current.y;

      if (magneticStrength > 0) {
        finalX += (magneticScreenX - finalX) * magneticStrength;
        finalY += (magneticScreenY - finalY) * magneticStrength;
      }

      el!.style.transform = `translate(${finalX - CURSOR_SIZE / 2}px, ${finalY - CURSOR_SIZE / 2}px)`;

      // Tint inner brackets when hovering a target
      if (bracketsRef.current) {
        bracketsRef.current.style.fill =
          magneticStrength > 0.05 ? "#ff6644" : "white";
      }

      rafId.current = requestAnimationFrame(tick);
    }

    rafId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        pointerEvents: "none",
        zIndex: 9999,
        filter: "drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.7))",
      }}
    >
      <svg
        width={CURSOR_SIZE}
        height={CURSOR_SIZE}
        viewBox="0 0 128 128"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        {/* outer crosshair lines — always white */}
        <g fill="white">
          <rect x="61.5" y="2" width="5" height="46" rx="2.5" />
          <rect x="61.5" y="80" width="5" height="46" rx="2.5" />
          <rect x="2" y="61.5" width="46" height="5" rx="2.5" />
          <rect x="80" y="61.5" width="46" height="5" rx="2.5" />
        </g>
        {/* inner corner brackets — tint on hover */}
        <g ref={bracketsRef} fill="white" style={{ transition: "fill 0.1s" }}>
          <rect x="40" y="40" width="5" height="16" rx="2.5" />
          <rect x="40" y="40" width="16" height="5" rx="2.5" />
          <rect x="83" y="40" width="5" height="16" rx="2.5" />
          <rect x="72" y="40" width="16" height="5" rx="2.5" />
          <rect x="40" y="72" width="5" height="16" rx="2.5" />
          <rect x="40" y="83" width="16" height="5" rx="2.5" />
          <rect x="83" y="72" width="5" height="16" rx="2.5" />
          <rect x="72" y="83" width="16" height="5" rx="2.5" />
        </g>
      </svg>
    </div>
  );
}
