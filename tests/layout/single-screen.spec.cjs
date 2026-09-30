const {test,expect}=require('@playwright/test');
const sizes=[{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:414,height:736},{width:1280,height:800},{width:844,height:390}];
async function assertSingleScreen(page, game=false){
 const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
 expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height);expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
 const selectors=game?['.hud','.game-status','.station-stage','.pricing','.asset-grid','.bottom-controls']:['.home-actions','#mission-list'];
 for(const selector of selectors){const box=await page.locator(selector).boundingBox();expect(box,selector).not.toBeNull();expect(box.y,selector).toBeGreaterThanOrEqual(0);expect(box.y+box.height,selector).toBeLessThanOrEqual(dimensions.height+1);expect(box.x+box.width,selector).toBeLessThanOrEqual(dimensions.width+1)}
 for(const selector of game?['.asset-button']:['.mission']){
  const fitting=await page.locator(selector).evaluateAll(elements=>elements.every(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1));expect(fitting,selector+' content must fit, not be clipped').toBeTruthy();
 }
 if(game){const stage=await page.locator('.station-stage').boundingBox();expect(stage.height).toBeGreaterThan(65)}
}
for(const size of sizes)test(`${size.width}×${size.height}: menu and gameplay fit one screen even after expansion`,async({page})=>{
 await page.setViewportSize(size);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.mission')).toHaveCount(6);await assertSingleScreen(page);
 await page.getByRole('button',{name:'第 1 关 第一度电，运营 7 天，保持资金为正',exact:true}).click();await assertSingleScreen(page,true);
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
 await page.locator('#card-loan-status').click();await expect(page.locator('#details-modal')).toBeHidden();await expect(page.locator('#loan-modal')).toBeVisible();await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('#speed-4')).toHaveAttribute('aria-pressed','true');await assertSingleScreen(page,true);
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
