import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationDigest, markNotificationRead } from '../apps/mobile/src/domain/notifications.ts';
const now = new Date('2026-09-26T00:00:00Z');
const context = { userId:'self', enabled:true, linked:true, active:true, copyApproved:true, hour:9,
  enabledAt:'2026-09-25T00:00:00Z', linkedAt:'2026-09-25T00:00:00Z', lastAcceptedDay:null };
const task = { id:'sample', groupId:'case', assignee:'self', done:false, notNeeded:false, optional:false,
  dueDate:'2026-09-27', deadlineVerified:true, accessible:true, registeredAt:'2026-09-25T00:00:00Z' };
test('confirmed deadline is eligible at the selected JST time with generic payload', () => {
  const digest = notificationDigest(context,[task],now);
  assert.deepEqual(digest,{key:'self:2026-09-26:task-digest',date:'2026-09-26',body:'確認できる手続きがあります。Tomuraiでご確認ください。'});
  assert.ok(!JSON.stringify(digest).includes(task.id));
  assert.equal(notificationDigest(context,[task],new Date('2026-09-25T23:59:59Z')),null);
});
test('completion, reassignment, missing consent and unverified or optional work never notify', () => {
  for (const change of [{done:true},{notNeeded:true},{optional:true},{assignee:'other'},{accessible:false},{deadlineVerified:false},{dueDate:null}])
    assert.equal(notificationDigest(context,[{...task,...change}],now),null);
  for (const change of [{enabled:false},{linked:false},{active:false},{copyApproved:false},{hour:24},{lastAcceptedDay:'2026-09-26'}])
    assert.equal(notificationDigest({...context,...change},[task],now),null);
});
test('no catch-up, invalid dates or arbitrary late reminders', () => {
  for(const dueDate of ['2026-09-24','2026-09-28','invalid']) assert.equal(notificationDigest(context,[{...task,dueDate}],now),null);
  assert.equal(notificationDigest({...context,enabledAt:'2026-09-26T00:01:00Z'},[task],now),null);
  assert.equal(notificationDigest(context,[{...task,registeredAt:'2026-09-26T01:00:00Z'}],now),null);
  for(const offset of [0,1,7,30,-1]) {
    const due = new Date(now.getTime()+offset*86400000).toISOString().slice(0,10);
    assert.ok(notificationDigest(context,[{...task,dueDate:due}],now));
  }
});
test('read acknowledgement is owner-scoped and distinct from delivery', () => {
  const item={id:'n',ownerId:'self',read:false,date:'2026-09-26'};
  assert.equal(markNotificationRead(item,'other'),null);
  assert.deepEqual(markNotificationRead(item,'self'),{...item,read:true});
});

test('a link established after the scheduled hour cannot catch up that day', () => {
  const late = new Date('2026-09-26T01:00:01Z');
  assert.equal(notificationDigest({...context, linkedAt:'2026-09-26T01:00:00Z'},[task],late),null);
  assert.ok(notificationDigest({...context, linkedAt:'2026-09-26T00:00:00Z'},[task],late));
  for (const linkedAt of [undefined, null, '', 'invalid', '2026-09-26T09:00:00', '2026-02-30T00:00:00Z']) {
    assert.equal(notificationDigest({...context, linkedAt},[task],late),null);
  }
});

test('equivalent explicit timezone timestamps are accepted; ambiguous local timestamps are not', () => {
  assert.ok(notificationDigest({...context, linkedAt:'2026-09-26T09:00:00+09:00'},[task],now));
  assert.equal(notificationDigest({...context, enabledAt:'2026-09-25T00:00:00'},[task],now),null);
  assert.equal(notificationDigest(context,[{...task,registeredAt:'2026-09-25T00:00:00'}],now),null);
});

test('malformed context, collection, task and clock inputs fail closed without throwing', () => {
  for (const invalid of [null, undefined, false, true, 0, 1, '', 'true', [], {}]) {
    assert.equal(notificationDigest(invalid,[task],now),null);
    assert.equal(notificationDigest(context,invalid,now),null);
    assert.equal(notificationDigest(context,[invalid],now),null);
    assert.equal(notificationDigest(context,[task],invalid),null);
  }
  assert.equal(notificationDigest(context,[task],new Date('invalid')),null);
  assert.equal(notificationDigest(context,[task],{getTime:()=>now.getTime()}),null);
  assert.equal(notificationDigest(context,[task],Date.prototype),null);
  assert.ok(notificationDigest(context,[null,{},task],now));
});

test('context eligibility booleans must be literal true and required state cannot be omitted', () => {
  for (const key of ['enabled','linked','active','copyApproved']) {
    for (const value of [undefined,null,'true','false',1,[],{}]) {
      assert.equal(notificationDigest({...context,[key]:value},[task],now),null,`${key}=${String(value)}`);
    }
  }
  for (const userId of [undefined,null,'', ' ',42,[],{}]) assert.equal(notificationDigest({...context,userId},[task],now),null);
  for (const lastAcceptedDay of [undefined, '', 'bad', '2026-09-27',42,{}]) {
    assert.equal(notificationDigest({...context,lastAcceptedDay},[task],now),null);
  }
});

test('task eligibility requires explicit false status fields and literal true authorization flags', () => {
  for (const key of ['done','notNeeded','optional']) {
    for (const value of [undefined,null,'false','true',0,1,[],{}]) {
      assert.equal(notificationDigest(context,[{...task,[key]:value}],now),null,`${key}=${String(value)}`);
    }
  }
  for (const key of ['accessible','deadlineVerified']) {
    for (const value of [undefined,null,'true','false',1,[],{}]) {
      assert.equal(notificationDigest(context,[{...task,[key]:value}],now),null,`${key}=${String(value)}`);
    }
  }
  for (const key of ['id','groupId','dueDate','registeredAt']) {
    for (const value of [undefined,null,'',42,[],{},Symbol('synthetic-invalid')]) {
      assert.equal(notificationDigest(context,[{...task,[key]:value}],now),null, key);
    }
  }
});

test('read acknowledgement rejects missing identity, date or boolean instead of fabricating a read item', () => {
  const item = {id:'synthetic-notice',ownerId:'self',date:'2026-09-26',read:false};
  for (const value of [undefined,null,false,1,'',[],{}]) {
    assert.equal(markNotificationRead(value,'self'),null);
    assert.equal(markNotificationRead(item,value),null);
  }
  assert.equal(markNotificationRead({},undefined),null);
  for (const key of ['id','ownerId','date','read']) {
    for (const value of [undefined,null,{},[],42,'']) assert.equal(markNotificationRead({...item,[key]:value},'self'),null,key);
  }
  assert.equal(markNotificationRead({...item,read:'false'},'self'),null);
  assert.equal(markNotificationRead({...item,date:'2026-02-30'},'self'),null);
  assert.deepEqual(markNotificationRead(item,'self'),{...item,read:true});
  assert.equal(item.read,false);
});
