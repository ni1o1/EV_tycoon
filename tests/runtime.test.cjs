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
 for(const file of ['energy.js','finance.js','game.js','campaign.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs',file),'utf8'),dom.getInternalVMContext(),{filename:file});
 return {win,timers,run:code=>vm.runInContext(code,dom.getInternalVMContext()),close:()=>win.close()};
}
test('campaign initializes paused, restrictions are enforced by logic and UI, and saved game restores exact state',()=>{
 const b=boot();assert.equal(b.win.document.querySelectorAll('.mission:disabled').length,5);
 b.run('startLevelGame(1)');assert.equal(b.run('state.paused'),true);assert.equal(b.run('state.lastTickData.limit'),40);
 b.run("buyAsset('solar'); buyAsset('fastCharger'); takeLoan()");assert.equal(b.run('state.money'),5000);assert.equal(b.run('state.assets.solar'),0);
 b.run("buyAsset('slowCharger'); adjustPrice(.1); saveGame(true)");assert.equal(b.run('state.assets.slowCharger'),4);
 const saved=b.win.localStorage.getItem('ev_tycoon_save_v2');const c=boot({'ev_tycoon_save_v2':saved});c.run('resumeGame()');assert.equal(c.run('state.money'),4400);assert.equal(c.run('state.price'),1.6);assert.equal(c.run('state.assets.slowCharger'),4);assert.equal(c.run('state.paused'),true);b.close();c.close();
});
test('speed changes maintain exactly one tick timer, dialog closing respects existing pause',()=>{
 const b=boot();b.run('startLevelGame(2);setSpeed(500);setSpeed(125);setSpeed(62.5)');
 const ticks=[...b.timers.values()].filter(t=>t.fn.name==='tick');assert.equal(ticks.length,1);assert.equal(ticks[0].ms,62.5);
 b.run('openLoanModal();closeLoanModal()');assert.equal(b.run('state.paused'),false);
 b.run('setSpeed(0);openLoanModal();closeLoanModal()');assert.equal(b.run('state.paused'),true);
 b.run('closeModal("loan-modal");closeModal("help-modal")');assert.equal(b.run('modalOpenCount'),0);b.close();
});
test('rent must be paid before final victory; rent and debt are included in daily history',()=>{
 const b=boot();b.run('startLevelGame(1);state.hour=23;state.minute=50;state.day=7;state.paused=false;tick()');
 assert.equal(b.run('state.day'),8);assert.equal(b.run('state.pendingRent'),300);assert.equal(b.run('state.ended'),false);
 b.run('payBill()');assert.equal(b.run('state.victoryAchieved'),true);assert.equal(b.run('isLevelUnlocked(2)'),true);assert.equal(b.run('state.history.at(-1).profit'),-340);
 assert.equal(b.win.localStorage.getItem('ev_tycoon_save_v2'),null);b.close();
});
test('missing the non-survival goal fails the mission and does not unlock next stage',()=>{
 const b=boot();b.run('startLevelGame(2);state.day=15;state.pendingRent=0;checkEndGame()');assert.equal(b.run('state.ended'),true);assert.equal(b.run('isLevelUnlocked(3)'),false);assert.match(b.win.document.getElementById('go-title').innerText,/目标/);b.close();
});
test('corrupt saves and local progress cannot crash the main menu',()=>{
 const b=boot({'ev_tycoon_unlocked_levels':'bad json','ev_tycoon_progress_v2':null,'ev_tycoon_save_v2':{version:2,state:{money:42}}});assert.equal(b.run('isLevelUnlocked(1)'),true);assert.equal(b.win.document.getElementById('resume-game').classList.contains('hidden'),true);b.close();
});
test('loan requests cannot be duplicated, daily repayment updates net profit and settles principal',()=>{
 const b=boot();b.run('startLevelGame(2);openLoanModal();takeLoan()');const money=b.run('state.money');b.run('takeLoan()');assert.equal(b.run('state.money'),money);
 const payment=b.run('state.loan.fixedDaily'),maintenance=b.run('calcDailyCost()');b.run('state.currentDayProfit=100;dailySettle()');assert.equal(b.run('state.lastDayProfit'),100-maintenance-payment);
 b.run('state.money=100000;for(let i=0;i<20;i++){dailySettle();if(state.pendingRent)payBill()}');assert.equal(b.run('state.loan.active'),false);assert.equal(b.run('state.loan.principal'),0);b.close();
});
test('saved event and pending rent restore as mandatory dialogs without automatic running',()=>{
 const b=boot();b.run('startLevelGame(2);state.pendingRent=1000;saveGame(true);resumeGame()');assert.equal(b.win.document.getElementById('bill-modal').classList.contains('hidden'),false);assert.equal(b.run('state.paused'),true);
 b.run('payBill();state.pendingEvent={title:"补贴",description:"模拟事件",icon:"+",amount:"$500"};saveGame(true);showCampaign();resumeGame()');assert.equal(b.win.document.getElementById('event-modal').classList.contains('hidden'),false);assert.equal(b.run('modalOpenCount'),1);b.run('closeEventModal()');assert.equal(b.run('state.pendingEvent'),null);b.close();
});
test('all six missions can finish with a simple viable strategy across deterministic weather/events',()=>{
 const results=[];
 for(let level=1;level<=6;level++){
  const b=boot({},level*171);b.run(`startLevelGame(${level});updatePrice(1.8);if(currentLevel===2){buyAsset('solar');buyAsset('solar')}if(currentLevel===3){buyAsset('fastCharger');buyAsset('transformer')}if(currentLevel===6){buyAsset('slowCharger');buyAsset('slowCharger');buyAsset('slowCharger')}`);
  // Exercise the real simulation, auto-acknowledging in-game bills and events only.
  b.run(`for(let i=0;i<7000&&!state.ended;i++){if(state.pendingRent>0)payBill();if(state.pendingEvent)closeEventModal();if(state.ended)break;state.paused=false;tick()}`);
  const passed=b.run('state.victoryAchieved');results.push({level,money:Math.round(b.run('state.money')),energy:Math.round(b.run('state.totalEnergy')),passed});
  assert.equal(passed,true,JSON.stringify(results));b.close();
 }
 console.log('Campaign results:',results);
});
test('free modes reset prior restrictions and inflation without duplicate off-grid discounts',()=>{
 const b=boot();b.run("startLevelGame(1);selectedSettings={city:'gz',loc:'com',mode:'super'};startGame()");assert.equal(b.run('state.assets.slowCharger'),0);assert.equal(b.run('state.assets.fastCharger'),1);assert.equal(b.win.document.getElementById('btn-fast').disabled,false);
 b.run("selectedSettings.mode='offgrid';startGame()");assert.equal(b.run('state.currentCosts.solar'),450);assert.equal(b.run('state.batteryKwh'),100);assert.equal(b.win.document.getElementById('btn-transformer').disabled,true);
 b.run("selectedSettings.mode='inflation';startGame()");assert.equal(b.run('CONFIG.inflationRate'),1.5);b.run('startLevelGame(2)');assert.equal(b.run('CONFIG.inflationRate'),1.1);assert.equal(b.win.document.getElementById('btn-slow').disabled,false);b.close();
});
