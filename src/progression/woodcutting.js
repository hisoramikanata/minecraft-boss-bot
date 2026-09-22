const { LOG_NAMES, PLANK_NAMES, anyItemCount } = require('./materials');
const { craftItem } = require('./craftingHelper');
const { goto } = require('../utils/navigation');
const { throwIfCancelled } = require('./cancellation');

function findLogs(bot, maxDistance = 64) {
  return bot.findBlocks({
    matching: (block) => block && LOG_NAMES.includes(block.name),
    maxDistance,
    count: 8,
  }).map((pos) => bot.blockAt(pos));
}

// 丸太を目標本数まで伐採する。近くに木が見つからない場合は探索範囲を段階的に広げる。
async function gatherWood(bot, targetLogCount, log = () => {}) {
  let attempts = 0;
  while (anyItemCount(bot, LOG_NAMES) < targetLogCount && attempts < 30) {
    throwIfCancelled();
    attempts += 1;
    const logs = findLogs(bot, 32 + attempts * 8);
    if (logs.length === 0) {
      log('付近に木が見つかりません。探索範囲を広げます...');
      await wander(bot);
      continue;
    }
    log(`丸太を採取します (${logs.length}本発見)`);
    try {
      await bot.collectBlock.collect(logs[0], { ignoreNoPath: true });
    } catch (err) {
      log(`丸太の採取に失敗、別の木を試します: ${err.message}`);
    }
  }

  const have = anyItemCount(bot, LOG_NAMES);
  if (have < targetLogCount) {
    throw new Error(`丸太が目標数まで集まりませんでした (${have}/${targetLogCount})`);
  }
  log(`丸太を ${have} 本確保しました。`);
}

async function wander(bot) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 20;
  const target = bot.entity.position.offset(
    Math.cos(angle) * dist,
    0,
    Math.sin(angle) * dist,
  );
  try {
    await goto(bot, target, 3);
  } catch (_) { /* 到達不能な地形は無視して次の探索へ */ }
}

// 丸太を必要数プランクに変換する(既にあるプランクは考慮せず、指定本数分だけ変換)
async function logsToPlanks(bot, logCount, log = () => {}) {
  const logItem = bot.inventory.items().find((i) => LOG_NAMES.includes(i.name));
  if (!logItem) throw new Error('丸太がありません');
  await craftItem(bot, logItem.name.replace('_log', '_planks'), logCount, log);
}

module.exports = { findLogs, gatherWood, logsToPlanks, wander, PLANK_NAMES };
