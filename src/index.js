const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const armorManager = require('mineflayer-armor-manager');
const { plugin: autoEat } = require('mineflayer-auto-eat');
const { plugin: collectBlock } = require('mineflayer-collectblock');

const config = require('./config');
const { registerCommands } = require('./commands');
const warden = require('./bosses/warden');

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
  });

  bot.on('kicked', (reason) => console.log('[bot] kicked:', reason));
  bot.on('error', (err) => console.log('[bot] error:', err.message));
  bot.on('end', (reason) => {
    // 再接続のたびにintervalが積み重なりメモリリークになるため、切断時に必ず止める
    if (wardenSafetyInterval) clearInterval(wardenSafetyInterval);
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

createBot();
