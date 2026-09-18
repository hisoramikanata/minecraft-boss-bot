const config = require('./config');
const wither = require('./bosses/wither');
const enderDragon = require('./bosses/enderDragon');
const warden = require('./bosses/warden');
const { prepareForFight } = require('./utils/combat');

function registerCommands(bot) {
  let running = false;
  let currentLabel = null;

  const say = (msg) => {
    console.log(`[bot] ${msg}`);
    try { bot.chat(msg); } catch (_) { /* サーバー未接続時などは無視 */ }
  };

  async function runTask(label, fn) {
    if (running) {
      say(`既に「${currentLabel}」を実行中です。!stop で中断できます。`);
      return;
    }
    running = true;
    currentLabel = label;
    say(`${label} を開始します。`);
    try {
      await fn();
    } catch (err) {
      say(`${label} でエラー: ${err.message}`);
      console.error(err);
    } finally {
      running = false;
      currentLabel = null;
    }
  }

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    if (config.admin && username !== config.admin) return;

    const [cmd, ...args] = message.trim().split(/\s+/);

    switch (cmd) {
      case '!help':
        say('コマンド: !gear / !fight wither|dragon|warden / !avoid warden / !stop / !status');
        break;

      case '!gear':
        runTask('装備の最適化', async () => {
          await prepareForFight(bot);
          say('装備を最適化しました。');
        });
        break;

      case '!fight':
        if (args[0] === 'wither') {
          runTask('ウィザー討伐', () => wither.fight(bot, say));
        } else if (args[0] === 'dragon' || args[0] === 'enderdragon') {
          runTask('エンダードラゴン討伐', () => enderDragon.fight(bot, say));
        } else if (args[0] === 'warden') {
          if (config.wardenAvoidOnly) {
            say('WARDEN_AVOID_ONLY=true のため、!avoid warden を使ってください。');
          } else {
            runTask('ウォーデン応戦(危険)', () => warden.fight(bot, say));
          }
        } else {
          say('使い方: !fight wither|dragon|warden');
        }
        break;

      case '!avoid':
        if (args[0] === 'warden') {
          runTask('ウォーデン回避', () => warden.avoid(bot, say));
        } else {
          say('使い方: !avoid warden');
        }
        break;

      case '!stop':
        if (bot.pvp) bot.pvp.stop();
        if (bot.pathfinder) bot.pathfinder.setGoal(null);
        bot.clearControlStates();
        running = false;
        currentLabel = null;
        say('停止しました。');
        break;

      case '!status':
        say(`HP: ${bot.health?.toFixed(1)} / 満腹度: ${bot.food} / 実行中タスク: ${currentLabel || 'なし'}`);
        break;

      default:
        break;
    }
  });
}

module.exports = { registerCommands };
