const {test,expect}=require('@playwright/test');
const sizes=[{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:414,height:736},{width:1280,height:800},{width:844,height:390}];
async function assertSingleScreen(page, game=false){
 const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
 expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height);expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
 const selectors=game?['.hud','.operating-stats','.game-status','.station-stage','.energy-panel','.pricing','.asset-grid','.bottom-controls']:['.home-actions','#mission-list'];
 for(const selector of selectors){const box=await page.locator(selector).boundingBox();expect(box,selector).not.toBeNull();expect(box.y,selector).toBeGreaterThanOrEqual(0);expect(box.y+box.height,selector).toBeLessThanOrEqual(dimensions.height+1);expect(box.x+box.width,selector).toBeLessThanOrEqual(dimensions.width+1)}
 for(const selector of game?['.asset-button']:['.mission']){
  const fitting=await page.locator(selector).evaluateAll(elements=>elements.every(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1));expect(fitting,selector+' content must fit, not be clipped').toBeTruthy();
 }
 if(game){const stage=await page.locator('.station-stage').boundingBox();expect(stage.height).toBeGreaterThan(65)}
}
for(const size of sizes)test(`${size.width}×${size.height}: menu and gameplay fit one screen even after expansion`,async({page})=>{
 await page.setViewportSize(size);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.mission')).toHaveCount(6);await assertSingleScreen(page);
 await page.getByRole('button',{name:'第 1 关 第一度电，运营 7 天，保持资金为正',exact:true}).click();await assertSingleScreen(page,true);await expect(page.locator('#chart-container canvas')).toHaveCount(1);
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
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(()=>startLevelGame(2));
 await page.locator('#speed-4').click();await expect(page.locator('#speed-4')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'查看关卡目标',exact:true}).click();await expect(page.locator('#goal-modal')).toBeVisible();await expect(page.locator('#speed-0')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'关闭关卡目标',exact:true}).click();await expect(page.locator('#speed-4')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'经营',exact:true}).click();await page.getByRole('tab',{name:'能源',exact:true}).click();await expect(page.locator('#chart-container canvas')).toHaveCount(1);await page.getByRole('tab',{name:'收支',exact:true}).click();
 await page.getByRole('button',{name:'借款与还款计划 打开银行 →',exact:true}).click();await expect(page.locator('#details-modal')).toBeHidden();await expect(page.locator('#loan-modal')).toBeVisible();await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('#speed-4')).toHaveAttribute('aria-pressed','true');await assertSingleScreen(page,true);
 await page.locator('#speed-0').click();await page.getByRole('button',{name:'玩法指南',exact:true}).click();await page.locator('#help-next').click();await expect(page.locator('#help-page')).toHaveText('2 / 3');await page.getByRole('button',{name:'关闭玩法指南',exact:true}).click();await expect(page.locator('#speed-0')).toHaveAttribute('aria-pressed','true');
});
test('small-phone optional panels fit without scrolling and menu navigation clears dialog focus traps',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 for(const action of ['openGoal()','openDetails()','openLoanModal()','openHelp()','selectLevel(0)']){
  await page.goto('/');await page.evaluate(()=>startLevelGame(2));await page.evaluate(action);
  const sizing=await page.locator('[aria-modal="true"]').evaluate(el=>{const sheet=el.firstElementChild;return {height:sheet.clientHeight,scroll:sheet.scrollHeight}});expect(sizing.scroll,action).toBeLessThanOrEqual(sizing.height+1);
  await page.evaluate(()=>showCampaign());await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);await assertSingleScreen(page);
 }
});

test('research observations stay visible and real cash/energy changes are shown on the main screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(()=>startLevelGame(2));
 for(const id of ['ui-last-profit','ui-tick-profit','ui-weather-eff','ui-forecast','ui-daily-cost','ui-loan-payment','ui-weekly-rent','ui-rent-countdown','ui-battery','batt-status-text','ui-load-text'])await expect(page.locator('#'+id)).toBeVisible();
 await page.locator('#btn-battery').click();await expect(page.locator('#ui-tick-profit')).toHaveText('−$600.00');await expect(page.locator('.float-text')).toContainText('购买 -$600');
 await page.evaluate(()=>{state.hour=2;state.batteryKwh=0;processEnergy(.2);updateUI()});await expect(page.locator('#ui-tick-profit')).toHaveClass(/cash-negative/);await expect(page.locator('#batt-status-text')).toHaveText('充电中');
 await page.evaluate(()=>{state.cars=[{type:'slow',slot:0,kwhNeeded:5,kwhReceived:0,priceLocked:1.8,ticksLeft:100}];state.hour=13;processEnergy(1);updateUI();state.paused=false;tick();setSpeed(0)});
 await expect(page.locator('#ui-tick-profit')).toHaveClass(/cash-positive/);await expect(page.locator('#chart-container canvas')).toHaveCount(1);
 const chart=await page.evaluate(()=>myChart.getOption().series.map(s=>({name:s.name,count:s.data.filter(v=>v!==null).length})));expect(chart.map(s=>s.name)).toEqual(['昨日','光伏','储能','电网','负荷']);expect(chart.find(s=>s.name==='负荷').count).toBeGreaterThan(0);
 await page.evaluate(()=>{delete state.chartData.demand;saveGame(true);showCampaign();resumeGame()});await expect(page.locator('#chart-container canvas')).toHaveCount(1);await assertSingleScreen(page,true);
});
test('real customers drive in, pause with the game, and drive away without charging twice',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.evaluate(()=>startLevelGame(2));
 await page.evaluate(()=>{window.animationCustomer={...createVehicle('🚗',()=>.5),type:'slow',slot:0,priceLocked:2,ticksLeft:100};state.cars.push(animationCustomer);draw();setSpeed(500);clearTimeout(state.timer)});
 await expect.poll(()=>page.evaluate(()=>StationArt.inspect().find(v=>v.phase==='entering')?.pose?.x??-100)).toBeGreaterThan(0);
 await page.evaluate(()=>{setSpeed(0);draw()});const frozen=await page.evaluate(()=>StationArt.inspect()[0].pose);await page.waitForTimeout(200);expect(await page.evaluate(()=>StationArt.inspect()[0].pose)).toEqual(frozen);
 await page.evaluate(()=>{setSpeed(500);clearTimeout(state.timer)});await expect.poll(()=>page.evaluate(()=>StationArt.inspect()[0].phase)).toBe('parked');
 const before=await page.evaluate(()=>state.served||0);await page.evaluate(()=>{animationCustomer.kwhReceived=animationCustomer.kwhNeeded-.01;tick();clearTimeout(state.timer)});
 expect(await page.evaluate(()=>state.cars.includes(animationCustomer))).toBe(false);expect(await page.evaluate(()=>state.served)).toBe(before+1);
 await expect.poll(()=>page.evaluate(()=>StationArt.inspect().some(v=>v.phase==='leaving'))).toBe(true);await expect.poll(()=>page.evaluate(()=>StationArt.inspect().some(v=>v.phase==='leaving'))).toBe(false);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{state.cars.push({...createVehicle('🚐',()=>.5),type:'slow',slot:2,priceLocked:2,ticksLeft:100});draw()});expect(await page.evaluate(()=>StationArt.inspect().some(v=>v.phase==='entering'))).toBe(false);await page.evaluate(()=>setSpeed(0));await assertSingleScreen(page,true);
});
