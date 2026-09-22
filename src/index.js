const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const armorManager = require('mineflayer-armor-manager');
const { plugin: autoEat } = require('mineflayer-auto-eat');
const { plugin: collectBlock } = require('mineflayer-collectblock');

const config = require('./config');
const { registerCommands } = require('./commands');
const warden = require('./bosses/warden');
const { nearestHostile, fightMob } = require('./utils/combat');
const { setInCombat } = require('./utils/combatLock');

// 近接で反撃してよい敵Mob。クリーパー(自爆)とウォーデン(即死級ダメージ)は
// 専用の回避ロジックに任せるため、ここでは対象から除外する。
const MELEE_HOSTILES = [
  'zombie', 'husk', 'drowned', 'zombie_villager', 'skeleton', 'stray',
  'spider', 'cave_spider', 'silverfish', 'endermite', 'vex', 'slime',
  'magma_cube', 'phantom', 'pillager', 'vindicator', 'witch', 'guardian',
  'elder_guardian', 'blaze', 'wither_skeleton', 'hoglin', 'piglin_brute',
  'ravager', 'zoglin', 'piglin', 'enderman',
];

function createBot() {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    version: config.version,
    auth: config.auth,
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(autoEat);
  bot.loadPlugin(collectBlock);

  let wardenSafetyInterval = null;
  let combatDefenseInterval = null;

  bot.once('spawn', () => {
    const movements = new Movements(bot);
    movements.canDig = true;
    bot.pathfinder.setMovements(movements);
    // デフォルト5秒だと複雑な地形で経路探索がタイムアウトしやすいため延長する
    bot.pathfinder.thinkTimeout = 20000;

    if (bot.autoEat) {
      bot.autoEat.options = {
        priority: 'foodPoints',
        startAt: 16,
        bannedFood: [],
      };
    }

    console.log(`[bot] ${config.username} としてログインしました (${config.host}:${config.port})`);
    registerCommands(bot);

    // ウォーデンは常時オートセーフティとして自動回避を監視する(AVOID_ONLYに関わらず有効)
    if (config.wardenAvoidOnly) {
      wardenSafetyInterval = startWardenSafety(bot);
    }

    // 採掘・移動中など何をしていても、近くの敵に攻撃されたら剣/斧に持ち替えて応戦する
    combatDefenseInterval = startCombatDefense(bot);
  });

  bot.on('kicked', (reason) => console.log('[bot] kicked:', reason));
  bot.on('error', (err) => console.log('[bot] error:', err.message));
  bot.on('end', (reason) => {
    // 再接続のたびにintervalが積み重なりメモリリークになるため、切断時に必ず止める
    if (wardenSafetyInterval) clearInterval(wardenSafetyInterval);
    if (combatDefenseInterval) clearInterval(combatDefenseInterval);
    console.log('[bot] disconnected:', reason, '- 5秒後に再接続します');
    setTimeout(createBot, 5000);
  });

  return bot;
}

function startWardenSafety(bot) {
  let handling = false;
  return setInterval(async () => {
    if (handling) return;
    const target = warden.findWarden(bot);
    if (!target) return;
    const dist = bot.entity.position.distanceTo(target.position);
    if (dist < 20) {
      handling = true;
      try {
        await warden.avoid(bot, (msg) => console.log(`[warden-safety] ${msg}`));
      } finally {
        handling = false;
      }
    }
  }, 2000);
}

// HPが減った、または近くに近接可能な敵がいる場合、剣/斧に持ち替えて応戦する。
// ボス戦などで既にbot.pvpが戦闘中の場合は干渉しないようスキップする。
function startCombatDefense(bot) {
  let lastHealth = bot.health;
  let handling = false;

  return setInterval(async () => {
    if (handling) return;
    if (bot.pvp && bot.pvp.target) return; // 既存の戦闘(ボス戦等)を邪魔しない

    const currentHealth = bot.health;
    const tookDamage = currentHealth < lastHealth;
    lastHealth = currentHealth;

    const threat = nearestHostile(bot, (e) => e.name && MELEE_HOSTILES.includes(e.name), tookDamage ? 12 : 5);
    if (!threat) return;

    handling = true;
    setInCombat(true);
    // 採掘・移動などで出ていた既存の移動ゴールを止め、戦闘を最優先にする
    if (bot.pathfinder) bot.pathfinder.setGoal(null);
    try {
      console.log(`[combat-defense] ${threat.name} を検知、応戦します。`);
      await fightMob(bot, threat, { log: (msg) => console.log(`[combat-defense] ${msg}`), maxDurationMs: 20000 });
    } catch (err) {
      console.log('[combat-defense] error:', err.message);
    } finally {
      setInCombat(false);
      handling = false;
    }
  }, 1000);
}

createBot();
