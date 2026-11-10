import { randomBytes, randomInt } from 'node:crypto';

const slots = 4;
const maximumPool = 20;
const revealDelay = 2300;
const revealSpacing = 850;

function shuffle(items) {
  const result = [...items];
  for (let last = result.length - 1; last > 0; last--) {
    const chosen = randomInt(last + 1);
    [result[last], result[chosen]] = [result[chosen], result[last]];
  }
  return result;
}

export function createRaffle(database) {
  let open = false;
  let draw = database?.readDraw() || null;
  const activity = () => database?.activity() || [];
  const shown = () => draw?.winners.filter(winner => winner.revealAt <= Date.now()) ?? [];
  return {
    open() { open = true; },
    close() { open = false; },
    draw() {
      if (!open) return { ok: false, error: '请先打开抽奖环节。' };
      if (draw) return { ok: false, error: '本场抽奖已经完成。' };
      if (!database) return { ok: false, error: '活动数据暂时不可用。' };
      const pool = shuffle(activity()).sort((a, b) => b.score - a.score).slice(0, maximumPool);
      if (pool.length < slots) return { ok: false, error: '参与人数不足 4 位，暂时无法抽奖。' };
      const used = new Set();
      const startedAt = Date.now();
      const winners = shuffle(pool).slice(0, slots).map((person, index) => {
        let code;
        do { code = randomBytes(3).toString('hex').toUpperCase(); } while (used.has(code));
        used.add(code);
        return { visitorId: person.visitorId, code, revealAt: startedAt + revealDelay + revealSpacing * index };
      });
      const record = { startedAt, pool, winners };
      database.saveDraw(record);
      draw = record;
      return { ok: true };
    },
    revealTimes: () => draw?.winners.map(winner => winner.revealAt) ?? [],
    ticket: visitorId => shown().find(winner => winner.visitorId === visitorId)?.code ?? null,
    view() {
      if (!open) return null;
      const revealed = shown();
      return {
        count: draw?.pool.length ?? Math.min(maximumPool, activity().length),
        startedAt: draw?.startedAt ?? null,
        winners: revealed.map(({ code }) => code),
      };
    },
  };
}
