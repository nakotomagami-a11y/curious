"use client";

import { ACHIEVEMENTS } from "@curious/shared";
import { useAchievementStore } from "@lib/stores/achievement-store";

type AchievementPanelProps = {
  onClose: () => void;
};

export function AchievementPanel({ onClose }: AchievementPanelProps) {
  const unlockedIds = useAchievementStore((s) => s.unlockedIds);
  const unlockedCount = unlockedIds.size;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              color: "#d4a843",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 4,
              margin: 0,
            }}
          >
            ACHIEVEMENTS
          </h1>
          <span style={{ color: "#bbb", fontSize: 16 }}>
            {unlockedCount} / {totalCount} Unlocked
          </span>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = unlockedIds.has(ach.id);
            return (
              <div
                key={ach.id}
                style={{
                  background: unlocked
                    ? "rgba(40, 35, 20, 0.95)"
                    : "rgba(30, 30, 30, 0.8)",
                  border: unlocked
                    ? "1px solid #d4a843"
                    : "1px solid #444",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 8,
                  opacity: unlocked ? 1 : 0.5,
                  filter: unlocked ? "none" : "grayscale(100%)",
                }}
              >
                <span style={{ fontSize: 32, lineHeight: 1 }}>
                  {unlocked ? ach.icon : ach.icon}
                </span>
                <div
                  style={{
                    color: unlocked ? "#fff" : "#888",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {unlocked ? ach.name : "???"}
                </div>
                <div
                  style={{
                    color: unlocked ? "#bbb" : "#666",
                    fontSize: 11,
                    lineHeight: 1.3,
                  }}
                >
                  {unlocked ? ach.description : "???"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Close button */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              background: "rgba(60, 55, 40, 0.9)",
              border: "1px solid #d4a843",
              borderRadius: 6,
              color: "#d4a843",
              fontSize: 14,
              fontWeight: 600,
              padding: "10px 32px",
              cursor: "pointer",
              letterSpacing: 1,
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
