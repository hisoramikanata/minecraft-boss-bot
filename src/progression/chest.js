const { placeNearBot } = require('./placement');
const { craftItem } = require('./craftingHelper');
const { findItem, itemCount } = require('./materials');

function findNearbyChest(bot, maxDistance = 16) {
  return bot.findBlock({
    matching: (b) => b && b.name === 'chest',
    maxDistance,
  });
}

// 拠点用のチェストを1つ用意し、mineflayer-collectblockが荷物満杯時に
// 自動でアイテムを預けられるよう登録する。道具・武器・防具は預けず
// 手元に残す(collectblockのデフォルトitemFilterに準拠)。
async function ensureChest(bot, log = () => {}) {
  let chest = findNearbyChest(bot);

  if (!chest) {
    if (!findItem(bot, 'chest')) {
      if (itemCount(bot, 'planks') < 8 && itemCount(bot, 'oak_planks') < 8) {
        // 板材が無ければ何もしない(チェスト無しでも進行は継続できる)
        log('チェスト用の板材が不足しているため、チェスト設置はスキップします。');
        return null;
      }
      try {
        await craftItem(bot, 'chest', 1, log);
      } catch (err) {
        log(`チェストのクラフトに失敗: ${err.message}`);
        return null;
      }
    }
    try {
      chest = await placeNearBot(bot, 'chest', log);
    } catch (err) {
      log(`チェストの設置に失敗: ${err.message}`);
      return null;
    }
  }

  if (chest && bot.collectBlock) {
    bot.collectBlock.chestLocations = [chest.position];
    log('拠点チェストを設定しました。荷物が一杯になると自動で預けます。');
  }
  return chest;
}

module.exports = { ensureChest, findNearbyChest };
