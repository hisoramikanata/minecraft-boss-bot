const config = require('./config');
const wither = require('./bosses/wither');
const enderDragon = require('./bosses/enderDragon');
const warden = require('./bosses/warden');
const { prepareForFight } = require('./utils/combat');
const { runFullProgression, listPhaseKeys } = require('./progression/runner');
const cancellation = require('./progression/cancellation');

const CHAT_INTERVAL_MS = 1200; // これより速く送ると多くのサーバーでスパム判定・キックされる
const CHAT_QUEUE_MAX = 20; // 採掘ループ等で大量にログが出ても際限なく溜め込まないための上限

function registerCommands(bot) {
  let running = false;
  let currentLabel = null;
  const chatQueue = [];
  let chatTimer = null;

  const flushChatQueue = () => {
    const msg = chatQueue.shift();
    if (msg !== undefined) {
      try { bot.chat(msg); } catch (_) { /* サーバー未接続時などは無視 */ }
    }
    if (chatQueue.length === 0) {
      clearInterval(chatTimer);
      chatTimer = null;
    }
  };

  // コンソールには全件即時出力しつつ、チャットへの送信は一定間隔に間引いて
  // アンチスパムによるキックを防ぐ。長い採掘ループ等で溜まりすぎないよう上限も設ける。
  const say = (msg) => {
    console.log(`[bot] ${msg}`);
    chatQueue.push(msg);
    if (chatQueue.length > CHAT_QUEUE_MAX) chatQueue.shift();
    if (!chatTimer) {
      flushChatQueue();
      chatTimer = setInterval(flushChatQueue, CHAT_INTERVAL_MS);
    }
  };

  async function runTask(label, fn) {
    if (running) {
      say(`既に「${currentLabel}」を実行中です。!stop で中断できます。`);
      return;
    }
    running = true;
    currentLabel = label;
    cancellation.resetCancel();
    say(`${label} を開始します。`);
    try {
      await fn();
    } catch (err) {
      if (err instanceof cancellation.CancelledError) {
        say(`${label} を中断しました。`);
      } else {
        say(`${label} でエラー: ${err.message}`);
        console.error(err);
      }
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
        say('コマンド: !gear / !fight wither|dragon|warden / !avoid warden / !progress start [フェーズ名] / !progress phases / !stop / !status');
        break;

      case '!progress':
        if (args[0] === 'start') {
          const startAt = args[1] || null;
          runTask('フルサバイバル自動進行', () => runFullProgression(bot, say, cancellation.isCancelled, startAt));
        } else if (args[0] === 'phases') {
          say(`フェーズ一覧: ${listPhaseKeys(bot, say)}`);
        } else {
          say('使い方: !progress start [開始フェーズ名] / !progress phases (フェーズ一覧表示)');
        }
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
        // running/currentLabelはrunTaskのfinallyでクリアされるまで維持し、
        // 実行中タスクの終了前に別タスクが多重起動しないようにする。
        cancellation.requestCancel();
        if (bot.pvp) bot.pvp.stop();
        if (bot.pathfinder) bot.pathfinder.setGoal(null);
        bot.clearControlStates();
        say('停止を要求しました(区切りの良いところで進行を止めます)。');
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
