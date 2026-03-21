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

// --- Stamina ---
export const PLAYER_MAX_STAMINA = 100;
export const STAMINA_REGEN_RATE = 6.67; // per second while moving (full in ~15s)
export const STAMINA_REGEN_RATE_IDLE = 10; // per second standing still (full in 10s)
export const STAMINA_COST_DASH = 20;
export const STAMINA_COST_ATTACK = 10;

// --- Mana ---
export const PLAYER_MAX_MANA = 100;
export const MANA_REGEN_RATE = 3; // per second

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

// --- Stun ---
export const STUN_DURATION = 0.5; // seconds

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

// --- Caster Enemy ---
export const CASTER_SPEED = 120;
export const CASTER_MAX_HEALTH = 50;
export const CASTER_ATTACK_RANGE = 350;
export const CASTER_ATTACK_COOLDOWN = 2.0;
export const CASTER_CAST_DURATION = 0.6;
export const CASTER_DESIRED_DISTANCE = 300;
export const CASTER_FLEE_DISTANCE = 150;
export const CASTER_AGGRO_RANGE = 600;
export const CASTER_LEASH_RANGE = 800;
export const CASTER_SPAWN_CHANCE = 0.3;

// --- Dasher Enemy ---
export const DASHER_SPEED = 140;
export const DASHER_MAX_HEALTH = 60;
export const DASHER_AGGRO_RANGE = 550;
export const DASHER_LEASH_RANGE = 750;
export const DASHER_TELEGRAPH_DURATION = 0.8;
export const DASHER_DASH_SPEED = 900;
export const DASHER_DASH_DURATION = 0.25;
export const DASHER_DASH_DAMAGE = 15;
export const DASHER_RECOVERY_DURATION = 1.0;
export const DASHER_ATTACK_COOLDOWN = 3.0;
export const DASHER_DESIRED_DISTANCE = 200;
export const DASHER_ATTACK_RANGE = 400;
export const DASHER_SPAWN_CHANCE = 0.15;

// --- Shielder Enemy ---
export const SHIELDER_SPEED = 100;
export const SHIELDER_MAX_HEALTH = 100;
export const SHIELDER_AGGRO_RANGE = 450;
export const SHIELDER_LEASH_RANGE = 650;
export const SHIELDER_ATTACK_RANGE = 60;
export const SHIELDER_ATTACK_COOLDOWN = 1.5;
export const SHIELDER_PUNCH_DAMAGE = 8;
export const SHIELDER_PUNCH_DURATION = 0.5;
export const SHIELDER_SHIELD_ARC = (120 * Math.PI) / 180; // 120° frontal arc
export const SHIELDER_SHIELD_DROP_DURATION = 0.5; // drops shield when attacking
export const SHIELDER_SPAWN_CHANCE = 0.10;

// --- Summoner Enemy ---
export const SUMMONER_SPEED = 80;
export const SUMMONER_MAX_HEALTH = 40;
export const SUMMONER_AGGRO_RANGE = 600;
export const SUMMONER_LEASH_RANGE = 800;
export const SUMMONER_DESIRED_DISTANCE = 400;
export const SUMMONER_SUMMON_COOLDOWN = 6.0;
export const SUMMONER_SUMMON_DURATION = 1.0;
export const SUMMONER_MAX_MINIONS = 4;
export const SUMMONER_MINION_HEALTH = 20;
export const SUMMONER_MINION_SPEED = 200;
export const SUMMONER_MINION_DAMAGE = 3;
export const SUMMONER_MINION_LIFETIME = 8.0;
export const SUMMONER_SPAWN_CHANCE = 0.08;

// --- Bomber Enemy ---
export const BOMBER_SPEED = 180;
export const BOMBER_MAX_HEALTH = 30;
export const BOMBER_AGGRO_RANGE = 500;
export const BOMBER_LEASH_RANGE = 700;
export const BOMBER_EXPLODE_RADIUS = 80;
export const BOMBER_EXPLODE_DAMAGE = 25;
export const BOMBER_FUSE_TIME = 5.0; // explodes after this long near player
export const BOMBER_PROXIMITY_RANGE = 50; // distance to trigger fuse
export const BOMBER_SPAWN_CHANCE = 0.08;

// --- Teleporter Enemy ---
export const TELEPORTER_SPEED = 130;
export const TELEPORTER_MAX_HEALTH = 45;
export const TELEPORTER_AGGRO_RANGE = 500;
export const TELEPORTER_LEASH_RANGE = 700;
export const TELEPORTER_BLINK_RANGE = 200;
export const TELEPORTER_BLINK_COOLDOWN = 3.0;
export const TELEPORTER_BLINK_TELEGRAPH = 0.3;
export const TELEPORTER_ATTACK_RANGE = 50;
export const TELEPORTER_ATTACK_COOLDOWN = 1.0;
export const TELEPORTER_PUNCH_DAMAGE = 10;
export const TELEPORTER_PUNCH_DURATION = 0.3;
export const TELEPORTER_SPAWN_CHANCE = 0.08;

// --- Healer Enemy ---
export const HEALER_SPEED = 110;
export const HEALER_MAX_HEALTH = 55;
export const HEALER_AGGRO_RANGE = 550;
export const HEALER_LEASH_RANGE = 750;
export const HEALER_HEAL_RANGE = 200;
export const HEALER_HEAL_RATE = 5; // HP per second
export const HEALER_HEAL_DURATION = 2.0;
export const HEALER_HEAL_COOLDOWN = 3.0;
export const HEALER_FLEE_DISTANCE = 150;
export const HEALER_DESIRED_DISTANCE = 250;
export const HEALER_SPAWN_CHANCE = 0.06;

// --- Projectile ---
export const PROJECTILE_SPEED = 400;
export const PROJECTILE_RADIUS = 10;
export const PROJECTILE_DAMAGE = 8;
export const PROJECTILE_LIFETIME = 3.0;
export const PROJECTILE_KNOCKBACK = 60;

// --- Spells ---
export const FIREBALL_MANA_COST = 25;
export const FIREBALL_COOLDOWN = 4.0;
export const FIREBALL_SPEED = 500;
export const FIREBALL_RADIUS = 15;
export const FIREBALL_DAMAGE = 20;
export const FIREBALL_LIFETIME = 4.0;
export const FIREBALL_KNOCKBACK = 100;

export const ICE_LANCE_MANA_COST = 15;
export const ICE_LANCE_COOLDOWN = 3.0;
export const ICE_LANCE_SPEED = 600;
export const ICE_LANCE_RADIUS = 10;
export const ICE_LANCE_DAMAGE = 25;
export const ICE_LANCE_LIFETIME = 3.0;
export const ICE_LANCE_KNOCKBACK = 60;
export const ICE_LANCE_MAX_PIERCE = 3;

export const LIGHTNING_CHAIN_MANA_COST = 30;
export const LIGHTNING_CHAIN_COOLDOWN = 5.0;
export const LIGHTNING_CHAIN_DAMAGE = 15;
export const LIGHTNING_CHAIN_BOUNCES = 3;
export const LIGHTNING_CHAIN_RANGE = 150;

export const HEAL_CIRCLE_MANA_COST = 20;
export const HEAL_CIRCLE_COOLDOWN = 8.0;
export const HEAL_CIRCLE_RADIUS = 120;
export const HEAL_CIRCLE_HEAL_TOTAL = 30;
export const HEAL_CIRCLE_DURATION = 3.0;

export const SHIELD_BUBBLE_MANA_COST = 25;
export const SHIELD_BUBBLE_COOLDOWN = 10.0;
export const SHIELD_BUBBLE_RADIUS = 80;
export const SHIELD_BUBBLE_DURATION = 3.0;
export const SHIELD_BUBBLE_ABSORB = 50;

export const GRAVITY_WELL_MANA_COST = 35;
export const GRAVITY_WELL_COOLDOWN = 12.0;
export const GRAVITY_WELL_RADIUS = 200;
export const GRAVITY_WELL_DURATION = 3.0;
export const GRAVITY_WELL_DPS = 5;
export const GRAVITY_WELL_PULL_FORCE = 200;

export const BLOCK_SHIELD_MANA_COST = 15;
export const BLOCK_SHIELD_COOLDOWN = 6.0;
export const BLOCK_SHIELD_DURATION = 1.5;
export const BLOCK_SHIELD_ABSORB = 40;
export const BLOCK_SHIELD_REFLECT_DAMAGE = 10;

// --- Spell Drops ---
export const SPELL_DROP_CHANCE = 0.20;
export const SPELL_DROP_LIFETIME = 30.0;
export const SPELL_DROP_PICKUP_RANGE = 40;
export const MAX_SPELL_SLOTS = 9;

// --- Buffs/Debuffs ---
export const SPEED_BOOST_MULTIPLIER = 1.5;
export const SPEED_BOOST_DURATION = 2.0;
export const BURN_DPS = 3;
export const BURN_DURATION = 3.0;
export const BURN_TICK_INTERVAL = 0.5;
export const FREEZE_SPEED_MULTIPLIER = 0.5;
export const FREEZE_DURATION = 2.0;

// --- Survival Mode ---
export const SURVIVAL_BASE_ENEMY_COUNT = 4;
export const SURVIVAL_ENEMY_INCREMENT = 2;
export const SURVIVAL_MEGA_BOSS_WAVE = 5;
export const SURVIVAL_MEGA_BOSS_HEALTH = 600;
export const WAVE_HEALTH_SCALE = 0.15;
export const WAVE_SPEED_SCALE = 0.08;
export const WAVE_DAMAGE_SCALE = 0.10;

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

// --- Boss Phases ---
export const BOSS_PHASE_2_THRESHOLD = 0.50; // 50% HP
export const BOSS_PHASE_3_THRESHOLD = 0.25; // 25% HP
export const BOSS_RAGE_THRESHOLD = 0.20; // 20% HP
export const BOSS_RAGE_SPEED_MULT = 1.5;
export const BOSS_RAGE_DAMAGE_MULT = 1.3;

// --- Hydra Boss ---
export const HYDRA_MAX_HEALTH = 500;
export const HYDRA_SPEED = 80;
export const HYDRA_RADIUS = 50;
export const HYDRA_HEAD_COUNT = 3;
export const HYDRA_ATTACK_COOLDOWN = 2.0;
export const HYDRA_BITE_DAMAGE = 12;
export const HYDRA_BITE_RANGE = 120;

// --- Mage Boss ---
export const MAGE_BOSS_MAX_HEALTH = 400;
export const MAGE_BOSS_SPEED = 60;
export const MAGE_BOSS_RADIUS = 40;
export const MAGE_BOSS_TELEPORT_COOLDOWN = 5.0;
export const MAGE_BOSS_TELEPORT_RANGE = 300;
export const MAGE_BOSS_PROJECTILE_DAMAGE = 10;
export const MAGE_BOSS_PROJECTILE_SPEED = 350;
export const MAGE_BOSS_PATTERN_COOLDOWN = 8.0;
export const MAGE_BOSS_PATTERN_COUNT = 12; // projectiles in a burst

// --- Knockback ---
export const KNOCKBACK_SWORD = 80;
export const KNOCKBACK_PUNCH = 40;
export const KNOCKBACK_SLAM = 800;
export const KNOCKBACK_DASHER = 200;
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
export const DASH_COOLDOWN = 4.0; // seconds between dashes

// --- Elite Enemies ---
export const ELITE_SPAWN_CHANCE = 0.15;
export const ELITE_VAMPIRIC_HEAL_PCT = 0.20; // heals 20% of damage dealt
export const ELITE_THORNS_REFLECT_PCT = 0.30; // reflects 30% damage
export const ELITE_HASTE_SPEED_MULT = 2.0;
export const ELITE_HASTE_ATTACK_MULT = 0.5; // cooldown halved
export const ELITE_GIANT_SCALE = 1.8;
export const ELITE_GIANT_HP_MULT = 2.0;
export const ELITE_GIANT_DAMAGE_MULT = 1.5;
export const ELITE_GIANT_SPEED_MULT = 0.7;
export const ELITE_SHIELDED_FRONT_REDUCTION = 0.5; // 50% damage from front
export const ELITE_BERSERKER_THRESHOLD = 0.3; // triggers below 30% HP
export const ELITE_BERSERKER_DAMAGE_MULT = 2.0;
export const ELITE_BERSERKER_SPEED_MULT = 1.5;

// --- Critical Hits ---
export const CRIT_CHANCE = 0.15; // 15% base
export const CRIT_MULTIPLIER = 2.0;
export const BACKSTAB_CRIT_BONUS = 0.30; // +30% when hitting from behind
export const TELEGRAPH_CRIT_BONUS = 1.0; // guaranteed crit during telegraph

// --- Damage ---
export const DAMAGE_VARIANCE = 0.2; // ±20% of base damage

// --- Simulation ---
export const SERVER_TICK_RATE = 20; // Hz
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;
