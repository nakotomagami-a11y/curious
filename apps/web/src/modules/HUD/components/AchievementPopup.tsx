"use client";

import { useEffect, useState } from "react";
import { useAchievementStore } from "@lib/stores/achievement-store";

export function AchievementPopup() {
  const pendingPopups = useAchievementStore((s) => s.pendingPopups);
  const dismissPopup = useAchievementStore((s) => s.dismissPopup);
  const [visible, setVisible] = useState(false);

  const current = pendingPopups[0] ?? null;

  useEffect(() => {
    if (!current) {
      setVisible(false);
      return;
    }

    // Trigger slide-in
    const showTimer = setTimeout(() => setVisible(true), 50);

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      // Wait for slide-out animation before removing from queue
      setTimeout(() => dismissPopup(), 300);
    }, 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [current, dismissPopup]);

  if (!current) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 32,
        right: 32,
        zIndex: 9999,
        transform: visible ? "translateX(0)" : "translateX(120%)",
        transition: "transform 0.3s ease-out",
        background: "rgba(20, 16, 8, 0.95)",
        border: "2px solid #d4a843",
        borderRadius: 8,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 280,
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(212, 168, 67, 0.3)",
        pointerEvents: "auto",
      }}
    >
      <span style={{ fontSize: 36, lineHeight: 1 }}>{current.icon}</span>
      <div>
        <div
          style={{
            color: "#d4a843",
            fontWeight: 700,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            marginBottom: 2,
          }}
        >
          Achievement Unlocked
        </div>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
          {current.name}
        </div>
        <div style={{ color: "#bbb", fontSize: 12, marginTop: 2 }}>
          {current.description}
        </div>
      </div>
    </div>
  );
}
