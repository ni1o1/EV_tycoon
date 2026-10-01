const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {JSDOM}=require('jsdom');
function boot(storage={}, seed=7){
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../docs/index.html'),'utf8'),{url:'https://example.test/',runScripts:'outside-only'});
 const win=dom.window;const timers=new Map();let timerId=0;
 win.setTimeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId};win.clearTimeout=id=>timers.delete(id);win.scrollTo=()=>{};
 const ctx=new Proxy({}, {get:(target,k)=>target[k] || (k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}),set:(target,k,v)=>(target[k]=v,true)});
 win.HTMLCanvasElement.prototype.getContext=()=>ctx;
 win.echarts={init:()=>({setOption(){},dispose(){},resize(){}}),graphic:{LinearGradient:function(){}}};
 let random=seed;win.Math.random=()=>{random=(random*1664525+1013904223)>>>0;return random/4294967296};
 for(const [k,v] of Object.entries(storage)) win.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
 for(const file of ['vehicles.js','energy.js','finance.js','station-art.js','game.js','campaign.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs',file),'utf8'),dom.getInternalVMContext(),{filename:file});
 return {win,timers,run:code=>vm.runInContext(code,dom.getInternalVMContext()),close:()=>win.close()};
}
test('campaign initializes paused, restrictions are enforced by logic and UI, and saved game restores exact state',()=>{
 const b=boot();assert.equal(b.win.document.querySelectorAll('.mission:disabled').length,9);
 b.run('startLevelGame(1)');assert.equal(b.run('state.paused'),true);assert.equal(b.run('state.lastTickData.limit'),20);
 b.run("buyAsset('solar'); buyAsset('fastCharger'); takeLoan()");assert.equal(b.run('state.money'),1800);assert.equal(b.run('state.assets.solar'),0);
 b.run("buyAsset('slowCharger'); adjustPrice(.1); saveGame(true)");assert.equal(b.run('state.assets.slowCharger'),2);
 const saved=b.win.localStorage.getItem('ev_tycoon_save_v2');const c=boot({'ev_tycoon_save_v2':saved});c.run('resumeGame()');assert.equal(c.run('state.money'),1000);assert.equal(c.run('state.price'),1.6);assert.equal(c.run('state.assets.slowCharger'),2);assert.equal(c.run('state.paused'),true);b.close();c.close();
});
test('speed changes maintain exactly one tick timer, dialog closing respects existing pause',()=>{
 const b=boot();b.run('startLevelGame(2);career.unlocks=TECHNOLOGIES.map(t=>t.key);setSpeed(500);setSpeed(125);setSpeed(62.5)');
 const ticks=[...b.timers.values()].filter(t=>t.fn.name==='tick');assert.equal(ticks.length,1);assert.equal(ticks[0].ms,62.5);
 b.run('openLoanModal();closeLoanModal()');assert.equal(b.run('state.paused'),false);
 b.run('setSpeed(0);openLoanModal();closeLoanModal()');assert.equal(b.run('state.paused'),true);
 b.run('closeModal("loan-modal");closeModal("help-modal")');assert.equal(b.run('modalOpenCount'),0);b.close();
});
test('rent must be paid before final victory; rent and debt are included in daily history',()=>{
 const b=boot();b.run('startLevelGame(1);state.money=3000;state.assets.slowCharger=2;state.totalEnergy=1800;state.claimedMilestones=TECHNOLOGIES.map(t=>t.key);state.dailyPoolLeft=0;state.weeksSurvived=3;state.hour=23;state.minute=50;state.day=28;state.paused=false;tick()');
 assert.equal(b.run('state.day'),29);assert.equal(b.run('state.pendingRent'),240);assert.equal(b.run('state.ended'),false);
 b.run('payBill()');assert.equal(b.run('state.victoryAchieved'),true);assert.equal(b.run('isLevelUnlocked(2)'),true);assert.equal(b.run('state.history.at(-1).profit'),-264);
 assert.equal(b.win.localStorage.getItem('ev_tycoon_save_v2'),null);b.close();
});
test('missing the non-survival goal fails the mission and does not unlock next stage',()=>{
 const b=boot();b.run('startLevelGame(2);state.day=46;state.pendingRent=0;checkEndGame()');assert.equal(b.run('state.ended'),true);assert.equal(b.run('isLevelUnlocked(3)'),false);assert.match(b.win.document.getElementById('go-title').innerText,/目标/);b.close();
});
test('corrupt saves and local progress cannot crash the main menu',()=>{
 const b=boot({'ev_tycoon_unlocked_levels':'bad json','ev_tycoon_progress_v2':null,'ev_tycoon_save_v2':{version:2,state:{money:42}}});assert.equal(b.run('isLevelUnlocked(1)'),true);assert.equal(b.win.document.getElementById('resume-game').classList.contains('hidden'),true);b.close();
});
test('loan requests cannot be duplicated, daily repayment updates net profit and settles principal',()=>{
 const b=boot();b.run('startLevelGame(2);career.unlocks=TECHNOLOGIES.map(t=>t.key);openLoanModal();takeLoan()');const money=b.run('state.money');b.run('takeLoan()');assert.equal(b.run('state.money'),money);
 const payment=b.run('state.loan.fixedDaily'),maintenance=b.run('calcDailyCost()');b.run('state.currentDayProfit=100;dailySettle()');assert.equal(b.run('state.lastDayProfit'),100-maintenance-payment);
 b.run('state.money=100000;for(let i=0;i<20;i++){dailySettle();if(state.pendingRent)payBill()}');assert.equal(b.run('state.loan.active'),false);assert.equal(b.run('state.loan.principal'),0);b.close();
});
test('saved event and pending rent restore as mandatory dialogs without automatic running',()=>{
 const b=boot();b.run('startLevelGame(2);state.pendingRent=1000;saveGame(true);resumeGame()');assert.equal(b.win.document.getElementById('bill-modal').classList.contains('hidden'),false);assert.equal(b.run('state.paused'),true);
 b.run('payBill();state.pendingEvent={title:"补贴",description:"模拟事件",icon:"+",amount:"$500"};saveGame(true);showCampaign();resumeGame()');assert.equal(b.win.document.getElementById('event-modal').classList.contains('hidden'),false);assert.equal(b.run('modalOpenCount'),1);b.run('closeEventModal()');assert.equal(b.run('state.pendingEvent'),null);b.close();
});
test('all ten missions finish the reference weather scenario with real investment, energy and rent rules',()=>{
 const {simulate,referencePlans}=require('../scripts/balance.cjs');
 const results=[];
 for(let level=1;level<=10;level++){
  const r=simulate(level,171,referencePlans[level]);results.push(r);
  assert.equal(r.won,true,JSON.stringify(results));
 }
 console.log('Campaign results:',results);
});
test('idle operation cannot pass the off-grid and peak challenges across sampled weather',()=>{
 const {simulate}=require('../scripts/balance.cjs');
 for(const level of [5,6])for(const seed of [171,342,513,684]){
  const r=simulate(level,seed);assert.equal(r.won,false,JSON.stringify(r));
 }
});
test('cash goals and stars exclude outstanding debt and enforce all flagship requirements',()=>{
 const b=boot();b.run('startLevelGame(8);state.money=80000;state.loan={active:true,principal:40000};state.assets.slowCharger=8;state.assets.fastCharger=6');
 assert.equal(b.run('CAMPAIGN[7].goal(state)'),false);
 assert.equal(b.run('cashMetric({money:2255,loan:{active:false}},2300)'), '净$2,255/2.3k');
 b.run('state.loan.active=false;state.assets.fastCharger=5;state.assets.slowCharger=9');assert.equal(b.run('CAMPAIGN[7].goal(state)'),false);
 b.run('state.assets.fastCharger=6;state.assets.slowCharger=8;state.loan={active:true,principal:20000};showGameOver(true)');assert.equal(b.run('progress[8]'),1);
 b.close();
});
test('free modes reset prior restrictions and inflation without duplicate off-grid discounts',()=>{
 const b=boot();b.run("startLevelGame(1);selectedSettings={city:'gz',loc:'com',mode:'super'};startGame()");assert.equal(b.run('state.assets.slowCharger'),0);assert.equal(b.run('state.assets.fastCharger'),1);assert.equal(b.win.document.getElementById('btn-fast').disabled,false);
 b.run("selectedSettings.mode='offgrid';startGame()");assert.equal(b.run('state.currentCosts.solar'),900);assert.equal(b.run('state.batteryKwh'),100);assert.equal(b.win.document.getElementById('btn-transformer').disabled,true);
 b.run("selectedSettings.mode='inflation';startGame()");assert.equal(b.run('CONFIG.inflationRate'),1.5);b.run('startLevelGame(2)');assert.equal(b.run('CONFIG.inflationRate'),1.1);assert.equal(b.win.document.getElementById('btn-slow').disabled,false);b.close();
});

test('fresh tutorial starts with one slow charger and only two purchasing options',()=>{
 const b=boot();b.run('startLevelGame(1)');assert.equal(b.run('state.assets.slowCharger'),1);assert.equal(b.run('state.assets.transformer'),0);assert.equal(b.run('state.targetDays'),28);b.run('career.unlocks=TECHNOLOGIES.map(t=>t.key)');
 for(const key of ['marketing','fastCharger','solar','battery','bank'])assert.equal(b.run(`technologyAvailable('${key}')`),false);
 b.run("state.money=100000;buyAsset('marketing');buyAsset('fastCharger');buyAsset('solar');buyAsset('battery');openLoanModal();updateLoanPreview();takeLoan()");assert.equal(b.run('state.money'),100000);assert.equal(b.run('state.loan.active'),false);assert.equal(b.run('state.marketingPurchases||0'),0);assert.equal(b.win.document.getElementById('research-modal').classList.contains('hidden'),false);b.close();
});
test('research needs all conditions, grants each reward once per run, and persists across levels and reloads',()=>{
 const b=boot();b.run('startLevelGame(1);state.day=15;state.totalEnergy=799;state.served=8;checkTechnologyUnlocks()');assert.equal(b.run("technologyAvailable('fastCharger')"),false);assert.equal(b.run('state.money'),2100);
 b.run('state.totalEnergy=800;checkTechnologyUnlocks();checkTechnologyUnlocks()');assert.equal(b.run('state.money'),2900);assert.equal(b.run("technologyAvailable('fastCharger')"),true);
 b.run('saveGame(true)');const c=boot({'ev_tycoon_save_v2':b.win.localStorage.getItem('ev_tycoon_save_v2'),'ev_tycoon_career_v3':b.win.localStorage.getItem('ev_tycoon_career_v3')});c.run('resumeGame();checkTechnologyUnlocks()');assert.equal(c.run('state.money'),2900);assert.equal(c.run("technologyAvailable('fastCharger')"),true);
 c.run('startLevelGame(2)');assert.equal(c.run("technologyAvailable('fastCharger')"),true);assert.equal(c.run("technologyAvailable('bank')"),false);c.run('state.day=36;state.served=79;checkTechnologyUnlocks()');assert.equal(c.run("technologyAvailable('bank')"),false);c.run('state.served=80;checkTechnologyUnlocks();openLoanModal();takeLoan()');assert.equal(c.run('state.loan.active'),true);b.close();c.close();
});
test('all nine original modes have visible presets, restrictions override research, and continued play still earns milestones',()=>{
 const b=boot();assert.deepEqual(JSON.parse(b.run('JSON.stringify([...new Set(CAMPAIGN.map(m=>m.mode))])')).sort(),['std','super','ghost','powerlimit','offgrid','rain','luxury','inflation','shark'].sort());
 b.run("career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(3);state.money=100000;buyAsset('slowCharger')");assert.equal(b.run('state.assets.slowCharger'),0);
 b.run("startLevelGame(6);state.money=100000;buyAsset('transformer')");assert.equal(b.run('state.assets.transformer'),0);assert.equal(b.run('state.batteryKwh'),150);
 b.run("startLevelGame(1);state.day=29;state.money=10000;state.assets.slowCharger=2;state.totalEnergy=2000;checkEndGame();continueGame();state.day=36;state.served=80;checkEndGame()");assert.equal(b.run('state.ended'),false);assert.ok(JSON.parse(b.run('JSON.stringify(state.claimedMilestones)')).includes('bank'));b.close();
});
test('legacy progress and running saves retain their original targets while mapping into the new campaign',()=>{
 const b=boot({'ev_tycoon_progress_v2':{1:3,2:2,3:1,4:2},'ev_tycoon_unlocked_levels':[1,2,3,4,5]});assert.equal(b.run('legacyProgress[4]'),2);assert.equal(b.run('progress[6]||0'),0);assert.equal(b.run('isLevelUnlocked(5)'),true);assert.equal(b.run("career.unlocks.includes('bank')"),true);
 b.run('startLevelGame(3)');const saved=JSON.parse(b.win.localStorage.getItem('ev_tycoon_save_v2'));saved.version=2;delete saved.state.campaignRevision;saved.state.targetDays=21;saved.state.levelName='快充时代';
 const c=boot({'ev_tycoon_save_v2':saved});c.run('resumeGame()');assert.equal(c.run('state.campaignRevision'),2);assert.equal(c.run('currentMission().days'),21);assert.equal(c.run('calcWeeklyRent()'),1200);assert.equal(c.run('state.targetDays'),21);
 c.run('state.day=22;state.money=7000;state.assets.fastCharger=3;checkEndGame()');assert.equal(c.run('state.victoryAchieved'),true);assert.equal(c.run('isLevelUnlocked(4)'),true);c.win.document.getElementById('btn-next-level').onclick();assert.equal(c.run('state.campaignRevision'),3);assert.equal(c.run('currentLevel'),4);assert.equal(c.run('state.targetDays'),65);b.close();c.close();
});
