// --- Arena ---
export const ARENA_WIDTH = 2000;
export const ARENA_HEIGHT = 2000;
export const ARENA_HALF_WIDTH = ARENA_WIDTH / 2;
export const ARENA_HALF_HEIGHT = ARENA_HEIGHT / 2;

// --- Player ---
export const PLAYER_SPEED = 300;
export const PLAYER_RADIUS = 30;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_HEALTH_REGEN_RATE = 2; // per second
export const PLAYER_ROTATION_SPEED = 12; // lerp factor
export const PLAYER_ATTACK_SPEED_MULTIPLIER = 1 / 1.4; // speed reduction while attacking

// --- Sword ---
export const SWORD_DAMAGE = 25;
export const SWORD_REACH = 60;
export const SLASH_DURATION = 0.18; // seconds
export const SLASH_SWEEP_ANGLE = (180 * Math.PI) / 180; // radians (~180°)
export const ATTACK_COOLDOWN = 0.3; // seconds between attacks
export const SLASH_HOLD_DURATION = 0.12; // hold at end of swing before arm returns
export const COMBO_RESET_TIME = 1.5; // seconds idle before combo resets

// --- i-frames ---
export const IFRAME_DURATION = 0.3; // seconds of invulnerability after hit

// --- Enemy ---
export const ENEMY_SPEED = 150;
export const ENEMY_RADIUS = 30;
export const ENEMY_MAX_HEALTH = 75;
export const ENEMY_AGGRO_RANGE = 500;
export const ENEMY_LEASH_RANGE = 700;
export const ENEMY_ATTACK_RANGE = 50;
export const ENEMY_ATTACK_COOLDOWN = 1.0;
export const ENEMY_PUNCH_DAMAGE = 1;
export const ENEMY_PUNCH_DURATION = 0.4; // seconds
export const ENEMY_RESPAWN_DELAY = 1.0; // seconds
export const ENEMY_ACTIVE_COUNT = 6; // spawner maintains this many
export const ENEMY_DESIRED_DISTANCE = 80; // stop this far from player center
export const ENEMY_SEPARATION_RADIUS = 70; // repel enemies within this distance of each other
export const ENEMY_SEPARATION_FORCE = 100; // units/sec push away from other enemies

// --- Boss ---
export const BOSS_SCALE = 1.5;
export const BOSS_RADIUS = 45; // 30 * 1.5
export const BOSS_SPEED = 100;
export const BOSS_MAX_HEALTH = 300;
export const BOSS_AGGRO_RANGE = 600;
export const BOSS_SLAM_TRIGGER_RANGE = 200;
export const BOSS_TELEGRAPH_DURATION = 1.0; // seconds
export const BOSS_JUMP_DURATION = 0.6;
export const BOSS_SLAM_RADIUS = 150;
export const BOSS_SLAM_DAMAGE = 3.5;
export const BOSS_SLAM_COOLDOWN = 3.0; // seconds between slams
export const BOSS_RECOVERY_DURATION = 1.5;
export const BOSS_RESPAWN_DELAY = 10; // seconds

// --- Knockback ---
export const KNOCKBACK_SWORD = 80;
export const KNOCKBACK_PUNCH = 40;
export const KNOCKBACK_SLAM = 800;
export const KNOCKBACK_DECAY = 0.85;
export const KNOCKBACK_MIN_THRESHOLD = 0.1;

// --- Camera ---
export const CAMERA_LAG_FACTOR = 0.001;
export const CAMERA_LOOK_AHEAD_DISTANCE = 45;
export const CAMERA_ANGLE_DEG = 60; // degrees from horizontal
export const CAMERA_HEIGHT = 280;

// --- Dissolve ---
export const DISSOLVE_DURATION = 0.5; // seconds
export const DEATH_ROTATE_DURATION = 0.3; // player death rotate-down time
export const DEATH_DELAY_BEFORE_DISSOLVE = 0.5; // pause before dissolve starts

// --- Hit Flash ---
export const HIT_FLASH_DURATION = 0.15; // seconds

// --- Dash ---
export const DASH_SPEED = 630; // units/sec (~2.1x PLAYER_SPEED)
export const DASH_DURATION = 0.15; // seconds — very short burst
export const DASH_COOLDOWN = 2.0; // seconds between dashes

// --- Damage ---
export const DAMAGE_VARIANCE = 0.2; // ±20% of base damage

// --- Simulation ---
export const SERVER_TICK_RATE = 20; // Hz
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;
