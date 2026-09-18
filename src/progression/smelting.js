const { ensureFurnace } = require('./craftingHelper');
const { FUEL_NAMES, findItem, itemCount } = require('./materials');
const { goto } = require('../utils/navigation');

function waitForOutput(furnace, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      furnace.removeListener('update', check);
      reject(new Error('精錬がタイムアウトしました'));
    }, timeoutMs);

    function check() {
      const output = furnace.outputItem();
      if (output && output.count > 0) {
        clearTimeout(timer);
        furnace.removeListener('update', check);
        resolve();
      }
    }
    furnace.on('update', check);
    check();
  });
}

// inputName の原料を count 個、かまどで精錬して回収する。
async function smelt(bot, inputName, count, log = () => {}) {
  const inputItem = findItem(bot, inputName);
  if (!inputItem) throw new Error(`${inputName} がインベントリにありません`);

  const fuel = FUEL_NAMES.map((name) => findItem(bot, name)).find(Boolean);
  if (!fuel) throw new Error('燃料(石炭/木炭など)がありません');

  const furnaceBlock = await ensureFurnace(bot, log);
  await goto(bot, furnaceBlock.position, 3);
  const furnace = await bot.openFurnace(furnaceBlock);

  try {
    await furnace.putFuel(fuel.type, null, Math.min(fuel.count, Math.ceil(count / 8)));
    await furnace.putInput(inputItem.type, null, Math.min(inputItem.count, count));

    let obtained = 0;
    const target = Math.min(inputItem.count, count);
    while (obtained < target) {
      await waitForOutput(furnace, 20000);
      const out = await furnace.takeOutput();
      obtained += out.count;
      log(`精錬完了: ${out.name} x${out.count} (${obtained}/${target})`);
    }
  } finally {
    await furnace.close();
  }
}

module.exports = { smelt };
