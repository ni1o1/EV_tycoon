const {test,expect}=require('@playwright/test');
const sizes=[{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:414,height:736},{width:1280,height:800},{width:844,height:390}];
async function assertSingleScreen(page, game=false){
 const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
 expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height);expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
 const selectors=game?['.hud','.station-stage','.energy-panel','.game-controls','.asset-grid','.header-actions']:['.home-actions','#mission-list'];
 for(const selector of selectors){const box=await page.locator(selector).boundingBox();expect(box,selector).not.toBeNull();expect(box.y,selector).toBeGreaterThanOrEqual(0);expect(box.y+box.height,selector).toBeLessThanOrEqual(dimensions.height+1);expect(box.x+box.width,selector).toBeLessThanOrEqual(dimensions.width+1)}
 // 滚轮本来就该裁掉窗口外的取值，所以只查界面块，不查 .price-wheel 内部
 for(const selector of game?['.asset-button','.hud-card','.money-costs','.time-weather','.price-block']:['.mission']){
  const fitting=await page.locator(selector).evaluateAll(elements=>elements.every(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1));expect(fitting,selector+' content must fit, not be clipped').toBeTruthy();
 }
 if(game){const stage=await page.locator('.station-stage').boundingBox();expect(stage.height).toBeGreaterThan(65)}
}
for(const size of sizes)test(`${size.width}×${size.height}: menu and gameplay fit one screen even after expansion`,async({page})=>{
 await page.setViewportSize(size);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.mission')).toHaveCount(10);await assertSingleScreen(page);
 await page.getByRole('button',{name:/第 1 关 街角开业/}).click();await assertSingleScreen(page,true);await expect(page.locator('#chart-container canvas')).toHaveCount(1);expect(await page.evaluate(()=>[state.paused,state.gameSpeed])).toEqual([false,500]);await expect(page.locator('#speed-toggle')).toHaveAttribute('aria-label',/1 倍/);const headerBox=await page.locator('.app-header').boundingBox();const hudBox=await page.locator('.hud').boundingBox();expect(headerBox.y).toBeLessThan(hudBox.y);
 await page.evaluate(()=>{state.money=999999.99;updateUI()});await assertSingleScreen(page,true);
 if(size.width===390){await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:'test-results/compact-normal-phone.png'})}
 await page.evaluate(()=>{state.assets.slowCharger=25;state.assets.fastCharger=25;state.money=2000000;state.activeBuffs=Array.from({length:10},(_,i)=>({name:'测试事件'+i,type:'trafficMult',val:1,daysLeft:5,icon:'⚡'}));updateUI();resizeCanvas()});
 await assertSingleScreen(page,true);
 await page.getByRole('button',{name:'关卡',exact:true}).click();await expect(page.locator('#resume-game')).toBeVisible();await assertSingleScreen(page);
 if(size.width===390)await page.screenshot({path:'test-results/compact-menu.png'});
 await page.locator('#resume-game').click();await assertSingleScreen(page,true);
 if(size.width===390)await page.screenshot({path:'test-results/compact-phone.png'});
 expect(errors).toEqual([]);
});
test('optional goal, financial and energy panels retain pause and leave all main controls accessible',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2)});
 await page.locator('#speed-toggle').click();expect(await page.evaluate(()=>[state.paused,state.gameSpeed])).toEqual([false,125]);await expect(page.locator('#speed-toggle')).toHaveAttribute('aria-label',/4 倍/);
 await page.locator('#goal-chip').click();await expect(page.locator('#goal-modal')).toBeVisible();expect(await page.evaluate(()=>state.paused)).toBe(true);
 await page.getByRole('button',{name:'关闭关卡目标',exact:true}).click();expect(await page.evaluate(()=>[state.paused,state.gameSpeed])).toEqual([false,125]);
 await page.locator('#goal-chip').click();await page.locator('#goal-more summary').click();await expect(page.locator('#cash-reserve')).toBeVisible();await expect(page.locator('#ledger-list')).toBeVisible();
 await page.getByRole('button',{name:'借款与还款计划 · 打开银行 →',exact:true}).click();await expect(page.locator('#goal-modal')).toBeHidden();await expect(page.locator('#loan-modal')).toBeVisible();await page.getByRole('button',{name:'取消',exact:true}).click();expect(await page.evaluate(()=>[state.paused,state.gameSpeed])).toEqual([false,125]);await assertSingleScreen(page,true);
 await page.locator('#speed-toggle').click();expect(await page.evaluate(()=>state.gameSpeed)).toBe(62.5);
 await page.locator('#speed-toggle').click();expect(await page.evaluate(()=>[state.paused,state.gameSpeed])).toEqual([true,62.5]);await expect(page.locator('#speed-toggle')).toHaveAttribute('aria-label',/已暂停/);
 await page.locator('#speed-toggle').click();expect(await page.evaluate(()=>[state.paused,state.gameSpeed])).toEqual([false,500]);
 await page.evaluate(()=>{setSpeed(0);openHelp()});await page.locator('#help-next').click();await expect(page.locator('#help-page')).toHaveText('2 / 3');await page.getByRole('button',{name:'关闭玩法指南',exact:true}).click();expect(await page.evaluate(()=>state.paused)).toBe(true);
});
test('small-phone optional panels fit without scrolling and menu navigation clears dialog focus traps',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 for(const action of ['openGoal()','openResearch()','openLoanModal()','openHelp()','selectLevel(0)']){
  await page.goto('/');await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2)});await page.evaluate(action);
  const sizing=await page.locator('[aria-modal="true"]').evaluate(el=>{const sheet=el.firstElementChild;return {height:sheet.clientHeight,scroll:sheet.scrollHeight}});expect(sizing.scroll,action).toBeLessThanOrEqual(sizing.height+1);
  await page.evaluate(()=>showCampaign());await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);await assertSingleScreen(page);
 }
});

test('research observations stay visible and real cash/energy changes are shown on the main screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(0)});
 for(const id of ['ui-last-profit','ui-tick-profit','ui-weather-eff','ui-forecast','ui-daily-cost','ui-loan-payment','ui-weekly-rent','ui-rent-countdown','ui-grid-price','ui-weather-name','ui-today-profit'])await expect(page.locator('#'+id)).toBeVisible();
 await page.locator('#btn-battery').click();await expect(page.locator('#ui-battery')).toBeVisible();await expect(page.locator('#batt-status-text')).toBeVisible();await expect(page.locator('#ui-tick-profit')).toHaveText('−$1.8k');await expect(page.locator('.float-text')).toContainText('购买 -$1800');
 await page.evaluate(()=>{state.hour=2;state.batteryKwh=0;processEnergy(.2);updateUI()});await expect(page.locator('#ui-tick-profit')).toHaveClass(/cash-negative/);await expect(page.locator('#batt-status-text')).toHaveText('充电中');
 await expect(page.locator('#ui-grid-price')).toHaveText('$0.35');await expect(page.locator('.price-cost')).toContainText('/kWh');await expect(page.locator('#price-wheel')).toHaveAttribute('aria-valuenow','1.5');
 await page.evaluate(()=>{state.hour=10;updateUI()});await expect(page.locator('#ui-grid-price')).toHaveText('$1.50');
 await page.evaluate(()=>{state.cars=[{type:'slow',slot:0,kwhNeeded:5,kwhReceived:0,priceLocked:1.8,ticksLeft:100}];state.hour=13;processEnergy(1);updateUI();state.paused=false;tick();setSpeed(0)});
 await expect(page.locator('#ui-tick-profit')).toHaveClass(/cash-positive/);
 await expect(page.locator('#chart-container canvas')).toHaveCount(1);
 const chart=await page.evaluate(()=>myChart.getOption().series.map(s=>({name:s.name,count:s.data.filter(v=>v!==null).length})));
 expect(chart.map(s=>s.name),'只买了一组储能时不画光伏').toEqual(['昨日','储能','电网','负荷']);
 expect(chart.find(s=>s.name==='负荷').count).toBeGreaterThan(0);
 expect(await page.evaluate(()=>myChart.getOption().legend[0].data)).toEqual(['昨日','储能','电网','负荷']);
 await page.evaluate(()=>{state.money=999999;buyAsset('solar')});
 expect(await page.evaluate(()=>myChart.getOption().series.map(s=>s.name)),'买下光伏后曲线随之增加').toEqual(['昨日','光伏','储能','电网','负荷']);
 await page.evaluate(()=>{delete state.chartData.demand;saveGame(true);showCampaign();resumeGame()});await expect(page.locator('#chart-container canvas')).toHaveCount(1);await assertSingleScreen(page,true);
});
test('real customers drive in, pause with the game, and drive away without charging twice',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(0)});
 await page.evaluate(()=>{window.animationCustomer={...createVehicle('🚗',()=>.5),type:'slow',slot:0,priceLocked:2,ticksLeft:100};state.cars.push(animationCustomer);draw();setSpeed(500);clearTimeout(state.timer)});
 await expect.poll(()=>page.evaluate(()=>StationArt.inspect().find(v=>v.phase==='entering')?.pose?.x??-100)).toBeGreaterThan(0);
 await page.evaluate(()=>{setSpeed(0);draw()});const frozen=await page.evaluate(()=>StationArt.inspect()[0].pose);await page.waitForTimeout(200);expect(await page.evaluate(()=>StationArt.inspect()[0].pose)).toEqual(frozen);
 await page.evaluate(()=>{setSpeed(500);clearTimeout(state.timer)});await expect.poll(()=>page.evaluate(()=>StationArt.inspect()[0].phase)).toBe('parked');
 const before=await page.evaluate(()=>state.served||0);await page.evaluate(()=>{animationCustomer.kwhReceived=animationCustomer.kwhNeeded-.01;tick();clearTimeout(state.timer)});
 expect(await page.evaluate(()=>state.cars.includes(animationCustomer))).toBe(false);expect(await page.evaluate(()=>state.served)).toBe(before+1);
 await expect.poll(()=>page.evaluate(()=>StationArt.inspect().some(v=>v.phase==='leaving'))).toBe(true);await expect.poll(()=>page.evaluate(()=>StationArt.inspect().some(v=>v.phase==='leaving'))).toBe(false);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{state.cars.push({...createVehicle('🚐',()=>.5),type:'slow',slot:2,priceLocked:2,ticksLeft:100});draw()});expect(await page.evaluate(()=>StationArt.inspect().some(v=>v.phase==='entering'))).toBe(false);await page.evaluate(()=>setSpeed(0));await assertSingleScreen(page,true);
});

test('cash and every multi-part goal remain legible on a small phone',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/');
 for(let level=1;level<=10;level++){
  await page.evaluate(level=>startLevelGame(level),level);await assertSingleScreen(page,true);
  await page.getByRole('button',{name:'查看关卡目标',exact:true}).click();
  const fits=await page.locator('#goal-modal .sheet').evaluate(el=>el.scrollHeight<=el.clientHeight+1);expect(fits,`level ${level} goal`).toBeTruthy();
  await page.getByRole('button',{name:'关闭关卡目标',exact:true}).click();
 }
});

test('tutorial hides locked purchases while keeping achievement progress and energy costs accessible',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/');await page.evaluate(()=>{career.unlocks=[];startLevelGame(1);setSpeed(0)});
 for(const id of ['btn-fast','btn-solar','btn-battery'])await expect(page.locator('#'+id)).toBeHidden();
 for(const sel of ['.solar-reading','.battery-reading'])await expect(page.locator(sel),'没有光伏储能时不显示这两项读数').toBeHidden();
 await expect(page.locator('#btn-loan')).toBeHidden();await page.locator('#station-live').click();await expect(page.locator('#research-modal')).toBeVisible();await expect(page.locator('#loan-modal')).toBeHidden();await page.getByRole('button',{name:'关闭技术与成就',exact:true}).click();
 await page.evaluate(()=>{career.unlocks=['fastCharger'];state.money=99999;clearUnlockPopup();updateUI()});await expect(page.locator('#btn-fast')).toBeVisible();await expect(page.locator('#btn-fast .asset-state')).toHaveText('购买 +');await expect(page.locator('#station-live')).toHaveAttribute('title',/光伏/);await assertSingleScreen(page,true);
 await page.locator('#station-live').click();await expect(page.locator('.research-row')).toHaveCount(4);await page.getByRole('button',{name:'关闭技术与成就',exact:true}).click();await assertSingleScreen(page,true);
});
test('unlock popup fits every viewport, names the new purchase, closes on tap and fades out on its own',async({page})=>{
 for(const size of [{width:320,height:568},{width:390,height:844},{width:1280,height:800},{width:844,height:390}]){
  await page.setViewportSize(size);await page.goto('/');
  await page.evaluate(()=>{career.unlocks=[];startLevelGame(1);setSpeed(0);state.day=101;state.money=6000;checkEndGame();closePanel('game-over-modal');updateUI()});
  const popup=page.locator('#unlock-popup');await expect(popup).toBeVisible();await expect(popup).toContainText('快充');await expect(popup).toContainText('新解锁');
  const box=await popup.boundingBox();expect(box.x,`${size.width}x${size.height}`).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width,`${size.width}x${size.height}`).toBeLessThanOrEqual(size.width+1);expect(box.y+box.height).toBeLessThanOrEqual(size.height+1);
  await expect(page.locator('#btn-fast')).toBeVisible();await assertSingleScreen(page,true);
  if(size.width===390)await page.screenshot({path:'test-results/compact-unlock-popup.png'});
 }
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.evaluate(()=>{career.unlocks=[];startLevelGame(1);setSpeed(0);unlockTechnologiesForLevel(1);updateUI()});
 await page.locator('.unlock-close').click();await expect(page.locator('#unlock-popup')).toBeHidden();
 await page.evaluate(()=>{unlockTechnologiesForLevel(2);updateUI()});await expect(page.locator('#unlock-popup')).toContainText('光伏');
 await expect(page.locator('#unlock-popup')).toBeHidden({timeout:9000});await assertSingleScreen(page,true);
 await page.evaluate(()=>{career.unlocks=[];unlockTechnologiesForLevel(1);updateUI()});
 await page.locator('#goal-chip').click();await expect(page.locator('#unlock-popup')).toBeHidden();
 await page.getByRole('button',{name:'关闭关卡目标',exact:true}).click();await expect(page.locator('#unlock-popup')).toBeVisible();await assertSingleScreen(page,true);
});
test('every money reading follows the gain-red / loss-green convention',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(0);state.lastDayProfit=-120;state.currentDayProfit=250;updateUI()});
 const colors=await page.evaluate(()=>{
  const root=getComputedStyle(document.documentElement);
  const rgb=hex=>{const n=parseInt(hex.trim().slice(1),16);return `rgb(${n>>16&255}, ${n>>8&255}, ${n&255})`};
  return {gain:rgb(root.getPropertyValue('--gain')),loss:rgb(root.getPropertyValue('--loss')),
   yesterday:getComputedStyle(document.querySelector('#ui-last-profit span')).color,
   today:getComputedStyle(document.getElementById('ui-today-profit')).color,
   maintenance:getComputedStyle(document.getElementById('ui-daily-cost')).color,
   rent:getComputedStyle(document.getElementById('ui-weekly-rent')).color};
 });
 expect(colors.yesterday, '亏损的昨日净收支').toBe(colors.loss);
 expect(colors.maintenance, '日维护支出').toBe(colors.loss);
 expect(colors.rent, '租金支出').toBe(colors.loss);
 expect(colors.today, '今日毛利为正').toBe(colors.gain);
 await assertSingleScreen(page,true);
});
test('the price wheel behaves like an iOS picker: drag with momentum, snap, tap and keys',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(0)});
 const display=page.locator('#price-display');
 const wheel=page.locator('#price-wheel');
 await expect(display).toHaveText('$1.50');
 // 连续取值列 + 中间选择带
 expect(await page.locator('.wheel-item').count()).toBe(26);
 expect(await wheel.evaluate(el=>({centre:el.querySelectorAll('.wheel-item')[10].classList.contains('is-current'),band:!!el.querySelector('.wheel-band'),hidden:getComputedStyle(el).overflow}))).toMatchObject({centre:true,band:true});
 // 真的是一列滚轮：每格等高于 --row、纵向逐行排开、中间那格更大、列表比窗口高得多
 const geom=await wheel.evaluate(el=>{
  const items=[...el.querySelectorAll('.wheel-item')],row=parseFloat(getComputedStyle(el).getPropertyValue('--row'))||13;
  const rects=items.slice(8,13).map(i=>i.getBoundingClientRect());
  return {row,winH:el.clientHeight,listH:document.getElementById('price-list').getBoundingClientRect().height,
   heights:rects.map(r=>Math.round(r.height)),tops:rects.map(r=>Math.round(r.top)),
   curSize:parseFloat(getComputedStyle(items[10]).fontSize),nbSize:parseFloat(getComputedStyle(items[9]).fontSize)};
 });
 expect(geom.listH,'整列要比窗口高，才是可滚动的选择列').toBeGreaterThan(geom.winH*2);
 expect(geom.heights.every(h=>Math.abs(h-geom.row)<=3),`每格高度应等于 --row：${JSON.stringify(geom)}`).toBe(true);
 for(let i=1;i<geom.tops.length;i++)expect(Math.abs(geom.tops[i]-geom.tops[i-1]-geom.row),'格子要纵向逐行排开').toBeLessThanOrEqual(2);
 expect(geom.curSize).toBeGreaterThan(geom.nbSize);
 expect(Math.round(geom.winH/geom.row),'窗口至少露出三行').toBeGreaterThanOrEqual(3);
 // 点上方/下方一格
 const box=await wheel.boundingBox();
 const row=await wheel.evaluate(el=>parseFloat(getComputedStyle(el).getPropertyValue('--row'))||16);
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2-row);
 await expect(display).toHaveText('$1.40');
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2+row);
 await expect(display).toHaveText('$1.50');
 // 拖动两格并吸附
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-2*row,{steps:6});await page.mouse.up();
 // 上滑加价并吸附到某一格（惯性可能多走一格）
 const dragged=await page.evaluate(()=>state.price);
 expect(dragged,'上滑应当加价').toBeGreaterThan(1.5);
 await expect(display).toHaveText(`$${dragged.toFixed(2)}`);
 await expect(wheel).toHaveAttribute('aria-valuenow',dragged.toFixed(1));
 await page.waitForTimeout(320);
 expect(await page.evaluate(()=>{const items=[...document.querySelectorAll('.wheel-item')];return items.filter(i=>i.classList.contains('is-current')).map(i=>i.textContent)})).toEqual([`$${dragged.toFixed(2)}`]);
 const offset=await page.evaluate(()=>{const list=document.getElementById('price-list');const wheel=document.getElementById('price-wheel');const row=parseFloat(getComputedStyle(wheel).getPropertyValue('--row'))||16;const m=/translateY\((-?[\d.]+)px\)/.exec(list.style.transform);return {row,offset:m?Number(m[1]):null,index:state.price}});
 expect(offset.offset).not.toBeNull();
 expect(Math.abs((1-(offset.offset/offset.row))-Math.round(1-offset.offset/offset.row)),'应当吸附到整格').toBeLessThan(0.001);
 // 滚轮加一格、下键减一格（相对当前价，惯性不影响这两步）
 const base=await page.evaluate(()=>state.price);
 await wheel.hover();await page.mouse.wheel(0,-120);
 await expect(display).toHaveText(`$${(base+0.1).toFixed(2)}`);
 await page.keyboard.press('ArrowDown');
 await expect(display).toHaveText(`$${base.toFixed(2)}`);
 expect(await page.evaluate(()=>state.price)).toBe(base);
 // 售价块直接写出每度毛利，方便和车旁的金额对上
 const expected=await page.evaluate(()=>`${state.price-currentGridPrice()>=0?'+':'−'}$${Math.abs(state.price-currentGridPrice()).toFixed(2)}`);
 await expect(page.locator('#ui-margin-rate')).toHaveText(expected);
 await assertSingleScreen(page,true);
});
test('the scene clock and the day arc move continuously between ten-minute ticks',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(500);state.hour=10;state.minute=0});
 const hours=await page.evaluate(async()=>{const out=[];for(let i=0;i<12;i++){draw();out.push(StationArt.hourNow());await new Promise(r=>setTimeout(r,60))}return out});
 expect(new Set(hours.map(h=>h.toFixed(4))).size,'场景时刻应在两回合之间连续插值').toBeGreaterThan(6);
 expect(hours[hours.length-1]).toBeGreaterThan(hours[0]);
 // 每采样一步的推进都要远小于一个回合（10 分钟 = 0.1667h），说明是在两回合之间平滑插值
 const steps=hours.slice(1).map((h,i)=>h-hours[i]);
 expect(Math.min(...steps)).toBeGreaterThanOrEqual(0);
 expect(Math.max(...steps),'不应出现整格跳变').toBeLessThan(10/60/2);
 expect(await page.locator('.time-head strong').textContent()).toMatch(/^\d{2}:\d{2}$/);
});
test('the station scene paints a sky that follows the hour and the weather',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(0)});
 const sky=await page.evaluate(()=>{
  const read=(weather,hour)=>{state.weather=weather;state.hour=hour;state.minute=0;draw();
   const canvas=document.getElementById('gameCanvas'), ctx=canvas.getContext('2d');
   const px=ctx.getImageData(Math.round(canvas.width*.08),Math.round(canvas.height*.06),1,1).data;
   return [px[0],px[1],px[2]]};
  const noonSunny=read('sunny',12), noonRain=read('rainy',12), night=read('sunny',23), dusk=read('sunny',17.8|0);
  return {noonSunny,noonRain,night,dusk};
 });
 const sum=c=>c[0]+c[1]+c[2];
 expect(sky.noonSunny[2],'正午天空偏蓝').toBeGreaterThan(sky.noonSunny[0]);
 expect(sky.noonRain,'雨天与晴天的天空不同').not.toEqual(sky.noonSunny);
 expect(sum(sky.night),'夜里天空更暗').toBeLessThan(sum(sky.noonSunny));
 expect(sum(sky.dusk),'黄昏天色与正午不同').not.toBe(sum(sky.noonSunny));
});

test('money pops up next to a charging car and the cable is plugged into it',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.evaluate(()=>{
  career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(8);state.price=1.8;
  state.cars=[{...createVehicle('🚗'),type:'slow',slot:0,kwhReceived:2,kwhNeeded:40,priceLocked:1.8,ticksLeft:60}];
  resizeCanvas();document.getElementById('toast').classList.add('hidden');setSpeed(500);
 });
 await expect.poll(()=>page.evaluate(()=>StationArt.inspect().some(v=>v.phase==='parked')),{timeout:5000}).toBe(true);
 const first=await page.evaluate(()=>{const v=StationArt.inspect().find(x=>x.phase==='parked');return {cash:v.cash,age:v.cashAge,gun:!!v.pose.gun,port:{x:v.pose.x-27*v.pose.s,y:v.pose.y+3*v.pose.s}}});
 expect(first.gun,'车位要记住充电枪位置才能接线').toBe(true);
 expect(first.cash,'停好的车每回合都会产生一笔进账').toBeGreaterThan(0);
 expect(first.age).not.toBeNull();
 // 每十分钟都会重新跳一次（金额相同也要重跳），所以采样里应该能看到刚触发的
 const samples=await page.evaluate(async()=>{const out=[];for(let i=0;i<14;i++){const v=StationArt.inspect().find(x=>x.phase==='parked');out.push(v?v.cashAge:null);await new Promise(r=>setTimeout(r,120))}return out});
 expect(samples.some(a=>a!==null&&a<400),'能看到刚触发的进账飘字').toBe(true);
 expect(new Set(samples.filter(a=>a!==null)).size,'飘字时间在推进').toBeGreaterThan(1);
 await assertSingleScreen(page,true);
});

test('the compact HUD and purchase row leave most of the screen to the scene and the curve',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.evaluate(()=>{career.unlocks=TECHNOLOGIES.map(t=>t.key);startLevelGame(2);setSpeed(0);updateUI();resizeCanvas()});
 const m=await page.evaluate(()=>{
  const h=s=>Math.round(document.querySelector(s).getBoundingClientRect().height);
  const rows=[...document.querySelectorAll('.asset-button')].map(b=>b.getBoundingClientRect().height);
  return {hud:h('.hud'),stage:h('.station-stage'),energy:h('.energy-panel'),controls:h('.game-controls'),btn:Math.max(...rows),grid:Math.round(document.querySelector('.asset-grid').getBoundingClientRect().height)};
 });
 expect(m.hud,'顶栏两张卡要紧凑').toBeLessThanOrEqual(78);
 expect(m.controls,'底行要紧凑').toBeLessThanOrEqual(112);
 expect(m.stage,'场景要拿到最多空间').toBeGreaterThanOrEqual(380);
 expect(m.energy,'曲线要比原来的 155px 更大').toBeGreaterThanOrEqual(170);
 expect(m.grid-m.btn*2,'购买键要撑满格位，不留空档').toBeLessThanOrEqual(10);
});
