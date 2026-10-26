import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../动态相册.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('const DEFAULT_BOOKMARKS='), html.indexOf('// Planner UI.'));
const model = vm.runInNewContext(`${code};({validDate:plannerValidDate,validTime:plannerValidTime,cells:plannerCalendarCells,shift:plannerShiftMonth,url:plannerBookmarkURL,calendar:plannerNormalizeCalendar,bookmarks:plannerNormalizeBookmarks})`, { URL });

test('calendar dates, leap days and month boundaries are validated without local-time arithmetic', () => {
  assert.equal(model.validDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '', null]) assert.equal(model.validDate(date), false);
  const cells = model.cells('2026-10');
  assert.equal(cells.length, 42);
  assert.equal(cells[0], '2026-09-28');
  assert.equal(cells[41], '2026-11-08');
  assert.equal(model.cells('not-a-month').length, 0);
  assert.equal(model.shift('2026-01', -1), '2025-12');
  assert.equal(model.shift('2026-12', 1), '2027-01');
  assert.equal(model.validTime('23:59'), true);
  for (const time of ['24:00', '12:60', '9:00', null]) assert.equal(model.validTime(time), false);
});

test('calendar migration keeps notes and schedules while rejecting invalid and duplicate records', () => {
  const result = model.calendar({events:[
    {id:'note',date:'2026-10-24',title:' 留下一句话 ',text:'想见你',kind:'note',time:'09:00'},
    {id:'plan',date:'2026-10-24',title:'一起散步',kind:'schedule',time:'17:30',endTime:'18:30',done:true},
    {id:'bad',date:'2026-02-30',title:'invalid'},
    {id:'empty',date:'2026-10-24',title:' '},
    {id:'note',date:'2026-10-25',title:'duplicate'},
  ]});
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].title, '留下一句话');
  assert.equal(result.events[0].time, '');
  assert.equal(result.events[1].time, '17:30');
  assert.equal(result.events[1].done, true);
  assert.equal(model.calendar(null).events.length, 0);
});

test('website bookmarks allow HTTP(S) only, and an intentionally empty list stays empty', () => {
  assert.equal(model.url('example.com/a?q=1'), 'https://example.com/a?q=1');
  assert.equal(model.url('https://example.com/?q=1&x=2'), 'https://example.com/?q=1&x=2');
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///C:/secret', 'https://user:pass@example.com', '']) assert.equal(model.url(url), null);
  assert.equal(model.bookmarks(undefined).length, 2);
  assert.equal(model.bookmarks([]).length, 0);
  const valid = model.bookmarks([{id:'a',name:'A',url:'example.com'}, {id:'a',name:'duplicate',url:'example.org'}, {id:'b',name:'B',url:'javascript:alert(1)'}]);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].url, 'https://example.com/');
});
