// Tests for kartisiyot/background.js with a fake Chrome. Run: node --test kartisiyot-dev/tests
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBrowser } = require('./harness');

const urls = (n, p = 'https://example.com/p') => Array.from({ length: n }, (_, i) => p + i);
const titles = (g) => g.items.map((i) => i.url.replace('https://', ''));

test('first run: existing Chrome groups are imported, with their names and colors', async () => {
  const b = createBrowser();
  b.openGroup('Work', urls(3), 'blue');
  b.openGroup('', ['https://a.com', 'https://b.com'], 'green');
  await b.reconcile();
  const gs = b.groups();
  assert.equal(gs.length, 2);
  const work = gs.find((g) => g.name === 'Work');
  assert.equal(work.items.length, 3);
  assert.equal(work.color, 'blue');
  assert.ok(work.chromeGroupId != null);
  assert.equal(b.st.local.schema, 2);
});

test('closing one tab removes its item from the open group', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Work', urls(3));
  await b.reconcile();
  await b.closeTab(b.tabsIn(gid)[1].id);
  await b.reconcile();
  assert.deepEqual(titles(b.groups()[0]), ['example.com/p0', 'example.com/p2']);
});

test('closing a whole group keeps it as a saved group with every item', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Work', urls(3));
  await b.reconcile();
  await b.ok({ type: 'setStatus', id: b.groups()[0].id, status: 'read' });
  await b.closeTab(b.tabsIn(gid).map((t) => t.id));
  await b.reconcile();
  const [g] = b.groups();
  assert.equal(g.chromeGroupId, null);
  assert.equal(g.items.length, 3);
  assert.equal(g.status, 'read');
  assert.ok(g.items.every((i) => i.tabId === null));
});

test('closing the tabs one at a time sends the finished group to the trash', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Work', urls(3));
  await b.reconcile();
  for (const t of b.tabsIn(gid)) { await b.closeTab(t.id); await b.reconcile(); }
  assert.equal(b.groups().length, 0);
  assert.equal(b.trash()[0].reason, 'emptied');
  assert.equal(b.trash()[0].group.name, 'Work');
});

test('a group that only ever had one tab is saved, not trashed, when that tab closes', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Watch later', ['https://youtube.com/watch?v=abc']);
  await b.reconcile();
  await b.closeTab(b.tabsIn(gid)[0].id);
  await b.reconcile();
  assert.equal(b.groups().length, 1);
  assert.equal(b.trash().length, 0);
});

test('ungrouping in Chrome sends the group to the trash, and undo brings it back', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Temp', urls(2));
  await b.reconcile();
  await b.chrome.tabs.ungroup(b.tabsIn(gid).map((t) => t.id));
  await b.reconcile();
  assert.equal(b.groups().length, 0);
  const [e] = b.trash();
  assert.equal(e.reason, 'ungrouped');
  await b.ok({ type: 'restore', trashId: e.id });
  assert.equal(b.groups()[0].name, 'Temp');
  assert.equal(b.trash().length, 0);
});

test('reopening a saved group from the panel links it back, without a duplicate', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Course', urls(4));
  await b.reconcile();
  const id = b.groups()[0].id;
  await b.ok({ type: 'setTask', id, task: 'summarize' });
  await b.ok({ type: 'closeGroup', id });
  assert.equal(b.tabsIn(gid).length, 0);
  await b.reconcile();
  await b.ok({ type: 'openGroup', id });
  await b.reconcile();
  const gs = b.groups();
  assert.equal(gs.length, 1);
  assert.ok(gs[0].chromeGroupId != null);
  assert.equal(gs[0].task, 'summarize');
  assert.equal(b.st.groups.find((g) => g.id === gs[0].chromeGroupId).title, 'Course');
});

test('a group reopened from Chrome itself (same name, same links) links back to the saved one', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Course', urls(4));
  await b.reconcile();
  await b.closeTab(b.tabsIn(gid).map((t) => t.id));
  await b.reconcile();
  b.openGroup('Course', urls(4));
  await b.reconcile();
  assert.equal(b.groups().length, 1);
  assert.ok(b.groups()[0].chromeGroupId != null);
});

test('browser restart: a slowly restored unnamed group is not duplicated and keeps status and task', async () => {
  const b1 = createBrowser();
  b1.openGroup('', urls(10));
  await b1.reconcile();
  const id = b1.groups()[0].id;
  await b1.ok({ type: 'setStatus', id, status: 'read' });
  await b1.ok({ type: 'setTask', id, task: 'summarize' });
  const b2 = b1.restart();
  await b2.reconcile();                       // Chrome has not restored anything yet
  const gid = b2.openGroup('', urls(10).slice(0, 7));
  await b2.reconcile();                       // 7 of 10 tabs are back
  let gs = b2.groups();
  assert.equal(gs.length, 1);
  assert.equal(gs[0].items.length, 10, 'the 3 links not restored yet stay in the group');
  urls(10).slice(7).forEach((u) => b2.addTab(gid, u));
  await b2.reconcile();
  gs = b2.groups();
  assert.equal(gs.length, 1);
  assert.equal(gs[0].status, 'read');
  assert.equal(gs[0].task, 'summarize');
  assert.ok(gs[0].items.every((i) => i.tabId != null));
});

test('browser restart: a named group with 4 of 10 tabs back is not duplicated', async () => {
  const b1 = createBrowser();
  b1.openGroup('Course', urls(10));
  await b1.reconcile();
  const b2 = b1.restart();
  const gid = b2.openGroup('Course', urls(10).slice(0, 4));
  await b2.reconcile();
  urls(10).slice(4).forEach((u) => b2.addTab(gid, u));
  await b2.reconcile();
  assert.equal(b2.groups().length, 1);
  assert.equal(b2.groups()[0].items.length, 10);
});

test('the startup wait is not cut short by the first tab event', async () => {
  const b = createBrowser();
  b.fire('runtime.onStartup');
  b.fire('tabs.onUpdated', 1, { status: 'complete' }, {});
  const pending = b.pendingTimers();
  assert.ok(pending[pending.length - 1] >= 3000, 'got ' + pending);
});

test('extension reload keeps the link even when most tabs changed while it was off', async () => {
  const b1 = createBrowser();
  const gid = b1.openGroup('Keep', ['https://a.com', 'https://b.com']);
  await b1.reconcile();
  const b2 = b1.reloadExtension();
  b2.addTab(gid, 'https://c.com'); b2.addTab(gid, 'https://d.com'); b2.addTab(gid, 'https://e.com');
  await b2.reconcile();
  assert.equal(b2.groups().length, 1);
  assert.equal(b2.groups()[0].items.length, 5);
});

test('a new group with a matching name and half the links does not take over the saved group', async () => {
  const b = createBrowser({ local: { groups: [{ id: 'old', name: 'other', status: 'watch', task: 'old task', chromeGroupId: null, items: [{ url: 'https://a.com' }, { url: 'https://b.com' }] }] } });
  b.openGroup('other', ['https://a.com', 'https://c.com']);
  await b.reconcile();
  const old = b.groups().find((g) => g.id === 'old');
  assert.deepEqual(titles(old), ['a.com', 'b.com']);
  assert.equal(old.chromeGroupId, null);
  assert.equal(b.groups().length, 2);
});

test('an unnamed new group never erases the name of a saved group', async () => {
  const b = createBrowser({ local: { groups: [{ id: 'r', name: 'Recipes', chromeGroupId: null, items: [{ url: 'https://a.com' }] }] } });
  b.openGroup('', ['https://a.com']);
  await b.reconcile();
  assert.equal(b.groups().find((g) => g.id === 'r').name, 'Recipes');
});

test('relinking never drops saved links: missing ones stay as not open', async () => {
  const b = createBrowser({ local: { groups: [{ id: 's', name: '', chromeGroupId: null, items: urls(5).map((u) => ({ url: u })) }] } });
  b.openGroup('', urls(4));
  await b.reconcile();
  const g = b.groups().find((x) => x.id === 's');
  assert.ok(g.chromeGroupId != null);
  assert.equal(g.items.length, 5);
  assert.equal(g.items.filter((i) => i.tabId == null).length, 1);
});

test('an item with a note or custom title stays with its page when the tab navigates', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Course', ['https://youtube.com/watch?v=l3']);
  await b.reconcile();
  const g = b.groups()[0];
  await b.ok({ type: 'setItemTitle', id: g.id, itemId: g.items[0].id, title: 'Lecture 3' });
  const t = b.tabsIn(gid)[0];
  t.url = 'https://youtube.com/watch?v=l3&t=120'; // same video, new timestamp: not a new page
  await b.reconcile();
  assert.equal(b.groups()[0].items.length, 1);
  t.url = 'https://youtube.com/watch?v=l4'; t.title = 'Lecture 4 - YouTube';
  await b.reconcile();
  const items = b.groups()[0].items;
  assert.equal(items.length, 2);
  assert.equal(items.find((i) => i.customTitle === 'Lecture 3').tabId, null);
  assert.equal(items.find((i) => i.url.includes('l4')).customTitle, null);
});

test('moving a tab to another open group keeps its custom title and note', async () => {
  const b = createBrowser();
  const g1 = b.openGroup('One', ['https://a.com', 'https://x.com']);
  const g2 = b.openGroup('Two', ['https://b.com']);
  await b.reconcile();
  const one = b.byName('One')[0];
  await b.ok({ type: 'setItemTitle', id: one.id, itemId: one.items[0].id, title: 'My title' });
  await b.ok({ type: 'setItemNote', id: one.id, itemId: one.items[0].id, note: 'come back' });
  b.tabsIn(g1)[0].groupId = g2;
  await b.reconcile();
  const moved = b.byName('Two')[0].items.find((i) => i.url === 'https://a.com');
  assert.equal(moved.customTitle, 'My title');
  assert.equal(moved.note, 'come back');
  assert.equal(b.byName('One')[0].items.length, 1);
});

test('title counters like "(3) Inbox" do not cause writes', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Mail', ['https://mail.example.com']);
  await b.reconcile();
  const w0 = b.st.writes;
  for (let n = 1; n <= 5; n++) { b.tabsIn(gid)[0].title = '(' + n + ') Inbox'; await b.reconcile(); }
  assert.ok(b.st.writes - w0 <= 1, 'writes: ' + (b.st.writes - w0));
});

test('empty new tab pages are not saved as items', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Work', ['https://a.com']);
  b.addTab(gid, 'chrome://newtab/');
  await b.reconcile();
  assert.equal(b.groups()[0].items.length, 1);
});

test('open all skips links Chrome refuses and groups the rest', async () => {
  const b = createBrowser({ local: { groups: [{ id: 'm', name: 'Mixed', chromeGroupId: null, items: [{ url: 'https://a.com' }, { url: 'chrome://kill' }, { url: 'https://c.com' }] }] } });
  const r = await b.ok({ type: 'openGroup', id: 'm' });
  assert.equal(r.skipped.length, 1);
  const g = b.groups()[0];
  assert.ok(g.chromeGroupId != null);
  assert.equal(b.tabsIn(g.chromeGroupId).length, 2);
});

test('closing a group that fills its window opens a new tab first, so the window stays', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Only', urls(2));
  await b.reconcile();
  await b.ok({ type: 'closeGroup', id: b.groups()[0].id });
  assert.equal(b.tabsIn(gid).length, 0);
  assert.ok(b.st.tabs.length >= 1, 'a tab is left in the window');
});

test('deleting a group and an item goes through the trash and can be undone', async () => {
  const b = createBrowser();
  const gid = b.openGroup('Work', urls(3));
  await b.reconcile();
  const g = b.groups()[0];
  const r1 = await b.ok({ type: 'removeItem', id: g.id, itemId: g.items[0].id });
  await b.reconcile();
  assert.equal(b.groups()[0].items.length, 2);
  assert.equal(b.tabsIn(gid).length, 2, 'its tab was closed');
  await b.ok({ type: 'restore', trashId: r1.trashId });
  assert.equal(b.groups()[0].items.length, 3);
  const r2 = await b.ok({ type: 'deleteGroup', id: g.id });
  await b.reconcile();
  assert.equal(b.groups().length, 0);
  assert.equal(b.tabsIn(gid).length, 0);
  await b.ok({ type: 'restore', trashId: r2.trashId });
  assert.equal(b.groups()[0].name, 'Work');
  assert.equal(b.groups()[0].chromeGroupId, null);
});

test('removing the last item of a saved group moves the whole group to the trash', async () => {
  const b = createBrowser({ local: { groups: [{ id: 's', name: 'Solo', task: 'x', chromeGroupId: null, items: [{ url: 'https://a.com', id: 'i1' }] }] } });
  await b.ok({ type: 'removeItem', id: 's', itemId: 'i1' });
  assert.equal(b.groups().length, 0);
  assert.equal(b.trash()[0].group.task, 'x');
});

test('export data can be imported back, as a merge or as a replace', async () => {
  const b = createBrowser();
  b.openGroup('Open now', urls(3, 'https://open.com/'));
  await b.reconcile();
  const exported = b.groups().concat([{ name: 'Saved', status: 'read', items: [{ url: 'https://s.com/1', note: 'n' }, { url: 'javascript:alert(1)' }] }]);
  const r = await b.ok({ type: 'importData', groups: exported, mode: 'merge' });
  assert.equal(r.added, 1);
  assert.equal(r.joined, 1, 'the open group matched itself and was not duplicated');
  const saved = b.byName('Saved')[0];
  assert.equal(saved.items.length, 1, 'unsafe links are dropped');
  assert.equal(saved.items[0].note, 'n');
  const r2 = await b.ok({ type: 'importData', groups: [{ name: 'Fresh', items: [{ url: 'https://f.com' }] }], mode: 'replace' });
  assert.equal(r2.added, 1);
  assert.deepEqual(b.groups().map((g) => g.name).sort(), ['Fresh', 'Open now']);
  assert.equal(b.trash()[0].kind, 'snapshot');
  await b.ok({ type: 'restore', trashId: b.trash()[0].id });
  assert.deepEqual(b.groups().map((g) => g.name).sort(), ['Open now', 'Saved']);
});

test('importing an older backup of an open group merges into it instead of duplicating', async () => {
  const b = createBrowser();
  b.openGroup('', urls(5));
  await b.reconcile();
  await b.ok({ type: 'importData', mode: 'replace', groups: [{ name: '', status: 'read', task: 'from backup', items: urls(3).map((u) => ({ url: u })) }] });
  await b.reconcile();
  assert.equal(b.groups().length, 1);
  assert.equal(b.groups()[0].task, 'from backup');
});

test('data from version 1 is migrated: new fields get defaults, nothing is lost', async () => {
  const v1 = [{ id: 'g', name: 'Old', color: 'blue', status: 'watch', task: 't', chromeGroupId: null, windowId: null, createdAt: 1, updatedAt: 2, lastActiveAt: 3,
    items: [{ id: 'i', url: 'https://a.com', title: 'A', customTitle: 'Mine', favIconUrl: '', tabId: null, addedAt: 1 }] }];
  const b = createBrowser({ local: { groups: v1 } });
  await b.reconcile();
  await b.ok({ type: 'setPinned', id: 'g', pinned: true });
  const [g] = b.groups();
  assert.equal(b.st.local.schema, 2);
  assert.equal(g.items[0].customTitle, 'Mine');
  assert.equal(g.items[0].note, '');
  assert.equal(g.pinned, true);
  assert.equal(g.lastActiveAt, 3);
});

test('moving an item between groups and merging two groups', async () => {
  const b = createBrowser({ local: { groups: [
    { id: 'a', name: 'other', chromeGroupId: null, items: [{ id: 'x', url: 'https://x.com' }, { id: 'y', url: 'https://y.com' }] },
    { id: 'b', name: 'other', chromeGroupId: null, items: [{ id: 'z', url: 'https://z.com' }, { id: 'y2', url: 'https://y.com' }] }] } });
  await b.ok({ type: 'moveItem', id: 'a', itemId: 'x', toId: 'b', beforeItemId: 'z' });
  assert.deepEqual(b.groups().find((g) => g.id === 'b').items.map((i) => i.id), ['x', 'z', 'y2']);
  const r = await b.ok({ type: 'mergeGroups', id: 'a', intoId: 'b' });
  assert.equal(b.groups().length, 1);
  assert.equal(b.groups()[0].items.length, 3, 'the duplicate link was not added twice');
  await b.ok({ type: 'restore', trashId: r.trashId });
  assert.equal(b.groups().length, 2);
});

test('errors from Chrome reach the panel in Hebrew', async () => {
  const b = createBrowser();
  const r = await b.send({ type: 'openItem', id: 'missing', itemId: 'x' });
  assert.equal(r.ok, false);
  assert.match(r.error, /[֐-׿]/);
});
