export function hasMaterials(text) {
  return /材料|提交|携带|准备|申请所需|报名所需|报销所需/.test(text) && text.trim().length >= 15;
}

export function cleanOcrText(text) {
  return text.replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1').trim();
}

export function normalizeItems(payload, source) {
  const raw = Array.isArray(payload?.items) ? payload.items : [];
  if (!raw.length || raw.length > 20) throw new Error('清单数量无效');
  return raw.map((item, index) => {
    const name = String(item?.name ?? '').trim();
    const evidence = String(item?.evidence ?? '').trim();
    if (!name || !evidence) throw new Error(`第 ${index + 1} 项缺少名称或原文依据`);
    return { id: index + 1, name, evidence, verified: source.includes(evidence), checked: false };
  });
}
