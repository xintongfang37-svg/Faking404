import test from 'node:test';
import assert from 'node:assert/strict';
import { hasMaterials, normalizeItems, cleanOcrText } from '../src/logic.js';

test('只提示包含材料要求的文书', () => {
  assert.equal(hasMaterials('申请人须准备学生证、报名表和照片各一份。'), true);
  assert.equal(hasMaterials('今日天气晴朗，欢迎参加活动。'), false);
});
test('原文依据缺失时标记待核实', () => {
  const items = normalizeItems({ items:[{name:'学生证',evidence:'携带学生证'},{name:'照片',evidence:'两寸照片'}] }, '请携带学生证办理。');
  assert.equal(items[0].verified,true);
  assert.equal(items[1].verified,false);
});
test('拒绝没有依据的返回', () => {
  assert.throws(()=>normalizeItems({items:[{name:'照片'}]},'通知'), /原文依据/);
});
test('中文 OCR 字间空格可以清理', () => {
  assert.equal(cleanOcrText('申 请 人 请 准备 申请 表。'), '申请人请准备申请表。');
});
