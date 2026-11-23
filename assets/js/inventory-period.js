const vietnamDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const dayMs = 86_400_000;

export function defaultInventoryPeriod(now = new Date()) {
  const end = vietnamDate.format(now);
  return { start: end.slice(0, 7) + '-01', end };
}

function dayStart(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return NaN;
  const time = Date.parse(`${value}T00:00:00+07:00`);
  return Number.isFinite(time) && vietnamDate.format(time) === value ? time : NaN;
}

function quantity(value) {
  return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value))
    ? Number(value) : null;
}

export function inventoryBalances(items, movements, period, now = new Date()) {
  const start = dayStart(period.start);
  const end = dayStart(period.end);
  const cutoff = Number(now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end > cutoff) {
    throw new Error('Chọn kỳ hợp lệ. Ngày bắt đầu phải trước hoặc bằng ngày kết thúc, và ngày kết thúc không được ở tương lai.');
  }

  const byId = new Map(items.filter(item => item.id).map(item => [item.id, item]));
  const bySku = new Map();
  const skuOf = value => String(value ?? '').trim().toUpperCase();
  const balance = new Map();
  for (const item of items) {
    const sku = skuOf(item.sku);
    if (sku) bySku.set(sku, bySku.has(sku) ? null : item);
    balance.set(item, { received: 0, issued: 0, later: 0 });
  }

  for (const movement of movements) {
    if (!movement || !['in', 'out'].includes(movement.type)) continue;
    const at = Date.parse(movement.at);
    const amount = quantity(movement.amount);
    if (!Number.isFinite(at) || at < start || at > cutoff || !(amount > 0)) continue;
    const item = movement.itemId ? byId.get(movement.itemId) : bySku.get(skuOf(movement.sku));
    if (!item) continue;
    const row = balance.get(item);
    if (at >= end + dayMs) row.later += movement.type === 'in' ? amount : -amount;
    else row[movement.type === 'in' ? 'received' : 'issued'] += amount;
  }

  for (const [item, row] of balance) {
    const current = quantity(item.quantity);
    const closing = current === null ? null : current - row.later;
    balance.set(item, {
      opening: closing === null ? null : closing - row.received + row.issued,
      received: row.received,
      issued: row.issued,
      closing,
    });
  }
  return balance;
}
