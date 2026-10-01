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
test('campaign initializes running at 1x, restrictions are enforced by logic and UI, and saved game restores exact state',()=>{
 const b=boot();assert.equal(b.win.document.querySelectorAll('.mission:disabled').length,9);
 b.run('startLevelGame(1)');assert.equal(b.run('state.paused'),false);assert.equal(b.run('state.gameSpeed'),500);assert.equal(b.run('state.lastTickData.limit'),20);
 b.run("buyAsset('solar'); buyAsset('fastCharger'); takeLoan()");assert.equal(b.run('state.money'),1800);assert.equal(b.run('state.assets.solar'),0);
 b.run("buyAsset('slowCharger'); adjustPrice(.1); saveGame(true)");assert.equal(b.run('state.assets.slowCharger'),2);
 const saved=b.win.localStorage.getItem('ev_tycoon_save_v2');const c=boot({'ev_tycoon_save_v2':saved});c.run('resumeGame()');assert.equal(c.run('state.money'),1000);assert.equal(c.run('state.price'),1.6);assert.equal(c.run('state.assets.slowCharger'),2);assert.equal(c.run('state.paused'),false);b.close();c.close();
});
test('speed changes maintain exactly one tick timer, dialog closing respects existing pause',()=>{
 const b=boot();b.run('startLevelGame(2);career.unlocks=TECHNOLOGIES.map(t=>t.key);setSpeed(500);setSpeed(125);setSpeed(62.5)');
 const ticks=[...b.timers.values()].filter(t=>t.fn.name==='tick');assert.equal(ticks.length,1);assert.equal(ticks[0].ms,62.5);
 b.run('openLoanModal();closeLoanModal()');assert.equal(b.run('state.paused'),false);
 b.run('setSpeed(0);openLoanModal();closeLoanModal()');assert.equal(b.run('state.paused'),true);
 b.run('closeModal("loan-modal");closeModal("help-modal")');assert.equal(b.run('modalOpenCount'),0);b.close();
});
test('rent must be paid before final victory, and going broke before day 100 fails the run',()=>{
 const b=boot();b.run('career.unlocks=[];startLevelGame(1);state.money=3000;state.assets.slowCharger=2;state.weeksSurvived=3;state.hour=23;state.minute=50;state.day=98;state.paused=false;tick()');
 assert.equal(b.run('state.day'),99);assert.equal(b.run('state.pendingRent'),725);assert.equal(b.run('state.ended'),false);
 b.run('state.day=101;checkEndGame()');assert.equal(b.run('state.victoryAchieved'),false,'欠着租金不能算通关');
 b.run('payBill();checkEndGame()');assert.equal(b.run('state.victoryAchieved'),true);assert.equal(b.run('isLevelUnlocked(2)'),true);
 assert.equal(b.run('state.history.length>0 && state.lastDayProfit<0'),true,'租金与维护要记进日结算');
 assert.equal(b.win.localStorage.getItem('ev_tycoon_save_v2'),null);
 // 没活到 100 天就破产 → 本关不算通关，也不解锁下一关
 const c=boot();c.run('startLevelGame(2);state.day=40;state.money=-1;checkEndGame()');
 assert.equal(c.run('state.ended'),true);assert.equal(c.run('state.victoryAchieved'),false);
 assert.equal(c.run('isLevelUnlocked(3)'),false);assert.match(c.win.document.getElementById('go-title').innerText,/资金链断裂/);
 b.close();c.close();
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
test('stars exclude outstanding debt and every campaign level is a 100-day survival run',()=>{
 const b=boot();
 assert.equal(b.run('cashMetric({money:2255,loan:{active:false}},2300)'), '净$2,255/2.3k');
 assert.equal(b.run('cashMetric({money:2255,loan:{active:true,principal:1000}},2300)'), '净$1,255/2.3k');
 assert.ok(b.run('CAMPAIGN.length')===10&&b.run('CAMPAIGN.every(m=>m.days===100)'),'十关都是 100 天');
 assert.ok(b.run('CAMPAIGN.every(m=>m.goal(state))'),'通关条件就是活过 100 天');
 assert.deepEqual(JSON.parse(b.run('JSON.stringify(CAMPAIGN.slice(0,4).map(m=>m.unlock))')),['fastCharger','solar','battery','bank']);
 assert.deepEqual(JSON.parse(b.run('JSON.stringify(CAMPAIGN.slice(4).map(m=>m.unlock||null))')),[null,null,null,null,null,null],'后六关不再解锁设备');
 // 三星要净资金达标，欠款会拉低净资金
 b.run('career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(8);state.money=CAMPAIGN[7].stars[1];state.loan={active:true,principal:5000};showGameOver(true)');
 assert.equal(b.run('progress[8]'),2);
 b.run('state.loan={active:false};state.money=CAMPAIGN[7].stars[1];showGameOver(true)');assert.equal(b.run('progress[8]'),3);
 b.close();
});
test('free modes reset prior restrictions and inflation without duplicate off-grid discounts',()=>{
 const b=boot();b.run("startLevelGame(1);selectedSettings={city:'gz',loc:'com',mode:'super'};startGame()");assert.equal(b.run('state.assets.slowCharger'),0);assert.equal(b.run('state.assets.fastCharger'),1);assert.equal(b.win.document.getElementById('btn-fast').disabled,false);
 b.run("selectedSettings.mode='offgrid';startGame()");assert.equal(b.run('state.currentCosts.solar'),900);assert.equal(b.run('state.batteryKwh'),100);assert.equal(b.win.document.getElementById('btn-transformer').disabled,true);assert.equal(b.win.document.getElementById('btn-transformer').classList.contains('hidden'),true);
 b.run("selectedSettings.mode='inflation';startGame()");assert.equal(b.run('CONFIG.inflationRate'),1.5);b.run('startLevelGame(2)');assert.equal(b.run('CONFIG.inflationRate'),1.1);assert.equal(b.win.document.getElementById('btn-slow').disabled,false);b.close();
});

test('fresh tutorial starts with one slow charger and only two purchasing options',()=>{
 const b=boot();b.run('career.unlocks=[];startLevelGame(1)');
 assert.equal(b.run('state.assets.slowCharger'),1);assert.equal(b.run('state.assets.transformer'),0);assert.equal(b.run('state.targetDays'),100);
 assert.equal(b.win.document.querySelectorAll('.asset-button:not(.hidden)').length,2);
 assert.equal(b.win.document.getElementById('btn-bank-details').classList.contains('hidden'),true);
 assert.equal(b.win.document.getElementById('card-loan-status').classList.contains('hidden'),true);
 for(const key of ['fastCharger','solar','battery','bank'])assert.equal(b.run(`technologyAvailable('${key}')`),false);
 b.run("state.money=100000;buyAsset('fastCharger');buyAsset('solar');buyAsset('battery');openLoanModal();updateLoanPreview();takeLoan()");
 assert.equal(b.run('state.money'),100000);assert.equal(b.run('state.loan.active'),false);
 assert.equal(b.win.document.getElementById('research-modal').classList.contains('hidden'),false);
 // 已经解锁过的账号回到第 1 关可以直接用
 b.run('closePanel("research-modal");career.unlocks=["fastCharger"];startLevelGame(1);updateUI()');
 assert.equal(b.run("technologyAvailable('fastCharger')"),true);assert.equal(b.run("technologyAvailable('solar')"),false);
 b.close();
});
test('beating a level unlocks the next device, once, and it persists across levels and reloads',()=>{
 const b=boot();b.run('career.unlocks=[];startLevelGame(1)');
 assert.equal(b.run("technologyAvailable('fastCharger')"),false);
 b.run('state.day=101;state.money=6000;checkEndGame()');
 assert.equal(b.run('state.victoryAchieved'),true);
 assert.equal(b.run("technologyAvailable('fastCharger')"),true);
 assert.deepEqual(JSON.parse(b.run('JSON.stringify(career.unlocks)')),['fastCharger']);
 // 重复通关不会重复记，也不会重复弹卡
 b.run('clearUnlockPopup();unlockTechnologiesForLevel(1);unlockTechnologiesForLevel(1)');
 assert.deepEqual(JSON.parse(b.run('JSON.stringify(career.unlocks)')),['fastCharger']);
 // 第 2 关通关解锁光伏，并且跨存档保留
 b.run('unlockTechnologiesForLevel(2)');
 assert.deepEqual(JSON.parse(b.run('JSON.stringify(career.unlocks)')),['fastCharger','solar']);
 b.run('saveGame(true)');
 const c=boot({'ev_tycoon_career_v3':b.win.localStorage.getItem('ev_tycoon_career_v3')});
 c.run('startLevelGame(3)');
 assert.equal(c.run("technologyAvailable('solar')"),true);assert.equal(c.run("technologyAvailable('battery')"),false);assert.equal(c.run("technologyAvailable('bank')"),false);
 b.close();c.close();
});
test('all nine original modes have visible presets, restrictions override research, and continued play still earns milestones',()=>{
 const b=boot();assert.deepEqual(JSON.parse(b.run('JSON.stringify([...new Set(CAMPAIGN.map(m=>m.mode))])')).sort(),['std','super','ghost','powerlimit','offgrid','rain','luxury','inflation','shark'].sort());
 b.run("career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(3);state.money=100000;buyAsset('slowCharger')");assert.equal(b.run('state.assets.slowCharger'),0);
 b.run("startLevelGame(6);state.money=100000;buyAsset('transformer')");assert.equal(b.run('state.assets.transformer'),0);assert.equal(b.run('state.batteryKwh'),150);
 b.run("career.unlocks=[];startLevelGame(1);state.day=101;state.money=10000;checkEndGame()");assert.equal(b.run('state.victoryAchieved'),true);assert.equal(b.run('isLevelUnlocked(2)'),true);assert.ok(b.run("career.unlocks.includes('fastCharger')"));b.close();
});
test('battery bars run red → yellow → green and every car carries its own ten-minute earnings',()=>{
 const b=boot();
 const hue=pct=>Number((b.win.StationArt.socColor(pct).match(/hsl\((\d+)/)||[])[1]);
 assert.ok(hue(0.05)<25,'低电量要偏红');assert.ok(hue(0.5)>40&&hue(0.5)<70,'半电量偏黄');assert.ok(hue(0.98)>110,'接近满电偏绿');
 assert.ok(hue(0.05)<hue(0.5)&&hue(0.5)<hue(0.98),'电量越高色相越大');
 b.run("career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(0);state.price=2;state.cars=[{...createVehicle('🚗'),type:'slow',slot:0,kwhReceived:0,kwhNeeded:20,priceLocked:2,ticksLeft:60},{...createVehicle('🚕'),type:'slow',slot:1,kwhReceived:0,kwhNeeded:20,priceLocked:2,ticksLeft:60}];processEnergy(0.35)");
 const cars=b.run('state.cars.map(c=>({tick:c.cashTick,total:c.cashTotal,id:c.cashTickId,kwh:c.kwhReceived}))');
 const revenue=b.run('state.lastTickData.revenue'), cost=b.run('state.lastTickData.cost');
 assert.ok(cars.every(c=>c.tick>0&&c.total===c.tick&&Number.isInteger(c.id)),JSON.stringify(cars));
 assert.ok(cars.every(c=>Math.abs(c.tick-c.kwh*(2-0.35))<1e-9),`每车金额是毛利：${JSON.stringify(cars)}`);
 const sum=cars.reduce((acc,c)=>acc+c.tick,0);
 assert.ok(Math.abs(sum-(revenue-cost))<1e-9,`没有光储时，每车毛利之和应等于本回合净收 ${sum} vs ${revenue-cost}`);
 b.close();
});
test('the +$ next to a car is this round’s margin, not the billed revenue',()=>{
 const b=boot();
 b.run("career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(0);state.price=1.5;state.hour=6;state.minute=0;state.assets={slowCharger:1,fastCharger:0,solar:0,battery:0,transformer:1};state.batteryKwh=0;state.cars=[{...createVehicle('🚗'),type:'slow',slot:0,kwhReceived:0,kwhNeeded:40,priceLocked:1.5,ticksLeft:60}]");
 b.run('processEnergy(currentGridPrice())');
 const r=b.run('({grid:currentGridPrice(),delivered:state.cars[0].kwhReceived,pop:state.cars[0].cashTick,revenue:state.lastTickData.revenue,cost:state.lastTickData.cost})');
 assert.ok(r.grid>0&&r.delivered>0,JSON.stringify(r));
 assert.ok(Math.abs(r.pop-r.delivered*(1.5-r.grid))<1e-9,`应该是「送出的电 × (售价 − 成本电价)」：${JSON.stringify(r)}`);
 // 画面上那行小字用的就是这两个值：送出的度数 × 每度毛利
 const detail=b.run('({kwh:state.cars[0].cashKwh,rate:state.cars[0].cashRate})');
 assert.ok(Math.abs(detail.rate-(1.5-r.grid))<1e-9,'每度毛利＝售价 − 成本电价');
 assert.ok(Math.abs(detail.kwh*detail.rate-r.pop)<1e-9,'车旁金额＝送出的度数 × 每度毛利');
 assert.ok(Math.abs(r.pop-(r.revenue-r.cost))<1e-9,'没有光储、只有一辆车时，车旁金额应当等于本回合净收');
 assert.ok(r.pop<r.revenue,'不能把售电总收入当成赚到的钱');
 // 售价低于成本电价时会算出负毛利，画面用红字显示
 b.run('state.price=0.5;state.cars[0].priceLocked=0.5;processEnergy(currentGridPrice())');
 assert.ok(b.run('state.cars[0].cashTick')<0,'亏本售电要显示负毛利');
 b.close();
});
test('legacy progress and running saves retain their original targets while mapping into the new campaign',()=>{
 const b=boot({'ev_tycoon_progress_v2':{1:3,2:2,3:1,4:2},'ev_tycoon_unlocked_levels':[1,2,3,4,5]});assert.equal(b.run('legacyProgress[4]'),2);assert.equal(b.run('progress[6]||0'),0);assert.equal(b.run('isLevelUnlocked(5)'),true);assert.equal(b.run("career.unlocks.includes('bank')"),true);
 b.run('startLevelGame(3)');const saved=JSON.parse(b.win.localStorage.getItem('ev_tycoon_save_v2'));saved.version=2;delete saved.state.campaignRevision;saved.state.targetDays=21;saved.state.levelName='快充时代';
 const c=boot({'ev_tycoon_save_v2':saved});c.run('resumeGame()');assert.equal(c.run('state.campaignRevision'),2);assert.equal(c.run('currentMission().days'),21);assert.equal(c.run('calcWeeklyRent()'),1200);assert.equal(c.run('state.targetDays'),21);
 c.run('state.day=22;state.money=7000;state.assets.fastCharger=3;checkEndGame()');assert.equal(c.run('state.victoryAchieved'),true);assert.equal(c.run('isLevelUnlocked(4)'),true);c.win.document.getElementById('btn-next-level').onclick();assert.equal(c.run('state.campaignRevision'),3);assert.equal(c.run('currentLevel'),4);assert.equal(c.run('state.targetDays'),100);b.close();c.close();
});
test('each newly unlocked device opens one dismissible popup naming the purchase entry, and waits for open panels',()=>{
 const b=boot();const popup=()=>b.win.document.getElementById('unlock-popup');
 b.run('career.unlocks=[];startLevelGame(1);state.day=101;checkEndGame()');
 // 通关瞬间会先弹结算窗口，解锁卡片排在后面
 assert.equal(b.run('unlockCurrent && unlockCurrent.tech.key'),'fastCharger');
 b.run('closePanel("game-over-modal")');
 assert.equal(popup().classList.contains('hidden'),false);
 assert.equal(b.win.document.getElementById('unlock-title').textContent,'快充');
 assert.equal(b.win.document.getElementById('unlock-eyebrow').textContent,'新解锁');
 assert.match(b.win.document.getElementById('unlock-desc').textContent,/30 kW 快充桩/);
 assert.match(b.win.document.getElementById('unlock-hint').textContent,/设备栏「快充」/);
 b.run('dismissUnlock()');assert.equal(popup().classList.contains('hidden'),true);
 b.run('career.unlocks=["fastCharger"];unlockTechnologiesForLevel(2)');
 assert.equal(b.win.document.getElementById('unlock-title').textContent,'光伏');
 assert.match(b.win.document.getElementById('unlock-hint').textContent,/设备栏「光伏」/);
 b.run('showCampaign()');assert.equal(popup().classList.contains('hidden'),true);
 b.run('resumeGame();clearUnlockPopup()');assert.equal(popup().classList.contains('hidden'),true);
 // 解锁时正开着面板：卡片先让位，面板关闭后再出现
 b.run('career.unlocks=[];unlockTechnologiesForLevel(1);openModal("goal-modal")');
 assert.equal(popup().classList.contains('hidden'),true);
 b.run('closePanel("goal-modal")');assert.equal(popup().classList.contains('hidden'),false);
 assert.equal(b.win.document.getElementById('unlock-title').textContent,'快充');b.close();
});
