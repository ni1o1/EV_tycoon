// Net cash prevents borrowing immediately before the deadline from satisfying a cash target.
function campaignCash(s) { return s.money - (s.loan?.active ? Math.max(0, s.loan.principal || 0) : 0); }
function cashMetric(s, target) { return `净$${Math.floor(campaignCash(s)).toLocaleString('en-US')}/${target/1000}k`; }
const LEGACY_CAMPAIGN = [
    { id: 1, name: '第一度电', subtitle: '从一座小站开始', tag: '入门', days: 7, money: 1800, city: 'sh', loc: 'ind', mode: 'std', assets: { slowCharger: 3, transformer: 1 }, traffic:60,rent: 350, rentGrowth: 0, stars: [2600, 3200],
      objective: '7 天交付 1,600 kWh，净资金 ≥ $2,300', short: '7 天 · 1,600 kWh + $2,300', detail: '专注慢充与定价。首周租金 $350，无随机事件；付清租金后，交付量与净资金均需达标。', lesson: '维护费每天结算；价格越高，愿意进站的客户越少。', goal: s => campaignCash(s) >= 2300 && (s.totalEnergy || 0) >= 1600, metric: s => `${Math.floor(s.totalEnergy || 0)}/1600kWh · ${cashMetric(s,2300)}` },
    { id: 2, name: '阳光合伙人', subtitle: '让屋顶也赚点钱', tag: '基础', days: 14, money: 3200, city: 'sh', loc: 'ind', mode: 'std', assets: { slowCharger: 3, transformer: 1 }, traffic:70,rent: 900, rentGrowth: 180, stars: [3500, 4500],
      objective: '14 天建成 2 组光伏，净资金 ≥ $2,000', short: '14 天 · 2 组光伏 + $2,000', detail: '解锁光伏、储能与银行。光伏 $1,200/组，储能 $1,800/组；两次租金分别为 $900、$1,080。', lesson: '先让光伏直接供车；储能投资更高，不必把全部余款都投入设备。', goal: s => s.assets.solar >= 2 && campaignCash(s) >= 2000, metric: s => `光伏${s.assets.solar}/2 · ${cashMetric(s,2000)}` },
    { id: 3, name: '快充时代', subtitle: '效率带来新机会', tag: '进阶', days: 21, money: 3800, city: 'gz', loc: 'com', mode: 'super', assets: { slowCharger: 0, fastCharger: 2, transformer: 2 }, traffic:80,rent: 1200, rentGrowth: 220, stars: [6500, 8500],
      objective: '21 天拥有 3 台快充，净资金 ≥ $4,500', short: '21 天 · 3 台快充 + $4,500', detail: '只允许快充。快充 $2,400/台，日维护 $35；扩建要同时考虑配电、广州峰时电费和租金。', lesson: '每台快充额定 30 kW。先检查能源曲线与配电上限，再决定下一笔投资。', goal: s => s.assets.fastCharger >= 3 && campaignCash(s) >= 4500, metric: s => `快充${s.assets.fastCharger}/3 · ${cashMetric(s,4500)}` },
    { id: 4, name: '离网绿洲', subtitle: '把阳光留到夜里', tag: '进阶', days: 14, money: 2800, city: 'sh', loc: 'res', mode: 'offgrid', assets: { slowCharger: 2, solar: 2, battery: 1, transformer: 0 }, traffic:60,rent: 650, rentGrowth: 130, startBattery: 50, stars: [3000, 4500],
      objective: '14 天交付 2,200 kWh，净资金 ≥ $500', short: '14 天 · 2,200 kWh + $500', detail: '完全断开电网。初始 2 组光伏、1 组储能，仅存电 50 kWh；采购优惠 25%。阴雨天与晚高峰考验储能准备。', lesson: '晚间充电依赖白天存下的电。观察缺电时段，平衡发电量与储能容量。', goal: s => (s.totalEnergy || 0) >= 2200 && campaignCash(s) >= 500, metric: s => `${Math.floor(s.totalEnergy || 0)}/2200kWh · ${cashMetric(s,500)}` },
    { id: 5, name: '峰谷博弈', subtitle: '有限功率，无限策略', tag: '挑战', days: 28, money: 3600, city: 'bj', loc: 'res', mode: 'powerlimit', assets: { slowCharger: 2, fastCharger: 1, transformer: 2, battery: 1 }, traffic:80,rent: 900, rentGrowth: 200, stars: [12500, 16000],
      objective: '运营 28 天，净资金 ≥ $9,000', short: '28 天 · 净资金 $9,000', detail: '配电扩容仅 +10 kW。北京晚高峰较长，每周租金递增 $200；存量设备、定价和扩建节奏共同决定结余。', lesson: '客户按进站时售价结算，可能持续充到峰时。比较整段充电成本，留好租金。', goal: s => campaignCash(s) >= 9000, metric: s => cashMetric(s,9000) },
    { id: 6, name: '城市旗舰', subtitle: '经营你的充电帝国', tag: '大师', days: 40, money: 4500, city: 'gz', loc: 'com', mode: 'luxury', assets: { slowCharger: 3, fastCharger: 2, transformer: 3, solar: 2, battery: 2 }, traffic:100,rent: 3000, rentGrowth: 700, stars: [35000, 45000],
      objective: '40 天建成 12 台桩，其中 5 台快充，净资金 ≥ $26,000', short: '40 天 · 12 台桩 / 5 快充 + $26k', detail: '高客流伴随高租金：首周 $3,000，每周递增 $700。需要分阶段扩建配电和充电桩，付清所有到期费用。', lesson: '扩建快充时同步检查功率瓶颈；预留租金和维护费，避免一次花光。', goal: s => s.assets.slowCharger + s.assets.fastCharger >= 12 && s.assets.fastCharger >= 5 && campaignCash(s) >= 26000, metric: s => `桩${s.assets.slowCharger+s.assets.fastCharger}/12 快${s.assets.fastCharger}/5 · ${cashMetric(s,26000)}` }
];
const CAMPAIGN_REVISION = 3;
const LEGACY_LEVEL_MAP = {1:1,2:2,3:3,4:6,5:5,6:8};
const ASSET_NAMES = {slowCharger:'慢充',transformer:'配电',fastCharger:'快充',solar:'光伏',battery:'储能',bank:'银行'};
// 解锁跟着关卡走：打赢前一关，下一件设备才开放，跨关永久保留。
const TECHNOLOGIES = [
 {key:'fastCharger',name:'快充',level:1,requirement:'通关第 1 关《街角开业》'},
 {key:'solar',name:'光伏',level:2,requirement:'通关第 2 关《阳光合伙》'},
 {key:'battery',name:'储能',level:3,requirement:'通关第 3 关《超充时代》'},
 {key:'bank',name:'银行',level:4,requirement:'通关第 4 关《峰谷博弈》'}
];
const TECHNOLOGY_BY_KEY = Object.fromEntries(TECHNOLOGIES.map(t => [t.key, t]));
// 十关都是"活过 100 天"的标准经营，差别在设定：客流、租金、模式与前四关的逐件解锁。
const CAMPAIGN = [
 {id:1,name:'街角开业',modeName:'标准 · 单桩教学',tag:'教学',days:100,money:1800,city:'sh',loc:'ind',mode:'std',assets:{slowCharger:1,transformer:0},traffic:45,rent:380,rentGrowth:115,stars:[4500,8000],unlock:'fastCharger',
  objective:'经营 100 天，活到第 100 天且不破产；净资金越高星级越高',short:'100 天 · 从 1 台慢充起步',detail:'开局只有一台慢充桩，也只买得起慢充与配电。通关本关才解锁快充；教学关没有随机事件，先熟悉售价、电费与充电曲线。',lesson:'先观察售价、实际电费和充电曲线，再扩建第二台慢充。',goal:()=>true,metric:s=>cashMetric(s,8000)},
 {id:2,name:'阳光合伙',modeName:'标准 · 光储成长',tag:'成长',days:100,money:2600,city:'sh',loc:'ind',mode:'std',assets:{slowCharger:2,transformer:1},traffic:70,rent:940,rentGrowth:196,stars:[9000,17000],unlock:'solar',
  objective:'经营 100 天，带着已解锁的快充把站点做稳；净资金越高星级越高',short:'100 天 · 快充与光伏',detail:'已解锁的设备跨关保留。租金每周递增 $95，靠慢充很难撑满 100 天，需要按客流逐步扩建。',lesson:'光伏先直接供车，再考虑把余电留到夜里；租金每周都在涨。',goal:()=>true,metric:s=>cashMetric(s,17000)},
 {id:3,name:'超充时代',modeName:'超充狂热 · 禁止慢充',tag:'进阶',days:100,money:4200,city:'gz',loc:'com',mode:'super',assets:{slowCharger:0,fastCharger:1,transformer:1},traffic:85,rent:1020,rentGrowth:241,stars:[14000,26000],unlock:'battery',
  objective:'经营 100 天，只准建快充；净资金越高星级越高',short:'100 天 · 快充与配电同步扩建',detail:'只允许建设快充，车辆直流上限与站点配电共同限速。广州下午峰价考验能源投资。',lesson:'只增加快充而不扩配电就会限速。看曲线和实际功率，决定先买桩还是先扩容。',goal:()=>true,metric:s=>cashMetric(s,26000)},
 {id:4,name:'峰谷博弈',modeName:'限电挑战 · 扩容减半',tag:'能源',days:100,money:4800,city:'bj',loc:'res',mode:'powerlimit',assets:{slowCharger:2,fastCharger:1,transformer:2,battery:1},traffic:90,rent:1140,rentGrowth:321,stars:[11000,21000],unlock:'bank',
  objective:'经营 100 天，在有限配电下调度峰谷；净资金越高星级越高',short:'100 天 · 峰谷调度与有限配电',detail:'每次配电扩容仅 +10 kW。北京晚间峰价较长，谷电储能、调价与分阶段扩建共同决定收益。通关后解锁银行。',lesson:'客户按进站时售价结算，可能充到峰时。留意整段充电的成本和电网进口曲线。',goal:()=>true,metric:s=>cashMetric(s,21000)},
 {id:5,name:'冷清街区',modeName:'鬼城危机 · 客流减半',tag:'经营',days:100,money:4200,city:'sh',loc:'res',mode:'ghost',assets:{slowCharger:2,transformer:1,solar:1},traffic:105,rent:940,rentGrowth:251,stars:[18000,34000],
  objective:'经营 100 天，在低客流街区活下来；净资金越高星级越高',short:'100 天 · 低客流下提高利用率',detail:'鬼城模式：基础客流减半。预设两台慢充与一组光伏，过度扩建会把收入吃在维护费里。',lesson:'降价可能带来更多客户，过度扩建却增加固定开销。先观察空闲车位，再投资。',goal:()=>true,metric:s=>cashMetric(s,34000)},
 {id:6,name:'离网绿洲',modeName:'离网挑战 · 只靠光储',tag:'能源',days:100,money:5500,city:'sh',loc:'res',mode:'offgrid',assets:{slowCharger:2,solar:3,battery:2,transformer:0},startBattery:150,traffic:110,rent:820,rentGrowth:220,stars:[6000,11000],
  objective:'经营 100 天，全靠光储供电；净资金越高星级越高',short:'100 天 · 光储独立供电',detail:'完全禁止购电和购买配电。初始存电 150 kWh，设备采购优惠 25%，需要扩大发电和夜间储备。',lesson:'先看缺电发生在白天还是夜晚。更多光伏不等于更大的夜间供电能力。',goal:()=>true,metric:s=>cashMetric(s,11000)},
 {id:7,name:'漫长雨季',modeName:'永恒雨季 · 光伏低效',tag:'挑战',days:100,money:7000,city:'gz',loc:'com',mode:'rain',assets:{slowCharger:1,fastCharger:2,transformer:2,battery:1,solar:2},traffic:95,rent:1440,rentGrowth:416,stars:[17000,31000],
  objective:'经营 100 天，在持续阴雨里保持盈利；净资金越高星级越高',short:'100 天 · 雨季下重选投资策略',detail:'雨季模式：持续下雨，光伏只有正常效率的 10%。预设保留光伏用于对比，依靠定价、快充与谷电储能维持经营。',lesson:'晴天有效的投资未必适合雨季。比较实际发电与日维护，避免照搬上一关的光伏扩建。',goal:()=>true,metric:s=>cashMetric(s,31000)},
 {id:8,name:'繁华商圈',modeName:'豪华地段 · 高流量高租金',tag:'规模',days:100,money:7500,city:'gz',loc:'com',mode:'luxury',assets:{slowCharger:3,fastCharger:2,transformer:3,solar:2,battery:2},traffic:125,rent:3100,rentGrowth:700,stars:[43000,80000],
  objective:'经营 100 天，用高客流养住高租金；净资金越高星级越高',short:'100 天 · 高流量下扩成旗舰站',detail:'豪华模式：客流翻倍，客户对售价更宽容。租金每周上涨 $280，扩建和现金储备都要跟上。',lesson:'高客流能支持扩建，但高租金也持续上涨。先保证电力跟得上，再增加车位。',goal:()=>true,metric:s=>cashMetric(s,80000)},
 {id:9,name:'成本风暴',modeName:'恶性通胀 · 设备涨价',tag:'资本',days:100,money:9000,city:'gz',loc:'com',mode:'inflation',assets:{slowCharger:2,fastCharger:2,transformer:2,solar:2,battery:2},traffic:105,rent:1940,rentGrowth:566,stars:[23000,42000],
  objective:'经营 100 天，在设备不断涨价中扩建；净资金越高星级越高',short:'100 天 · 涨价前规划投资',detail:'通胀模式：每次同类设备采购价格上涨 50%。设备买得越晚、同类买得越多，后续扩建越贵。',lesson:'提前规划桩、配电和光储的比例；不要只盯着眼前售价，忽略下一次设备报价。',goal:()=>true,metric:s=>cashMetric(s,42000)},
 {id:10,name:'资金长跑',modeName:'高频租金 · 每 3 天交租',tag:'终局',days:100,money:11000,city:'gz',loc:'com',mode:'shark',assets:{slowCharger:3,fastCharger:2,transformer:3,solar:2,battery:2},traffic:110,rent:900,rentGrowth:122,stars:[30000,55000],
  objective:'经营 100 天，每三天交一次租；净资金越高星级越高',short:'100 天 · 高频交租的资金考验',detail:'高频租金模式：每三天交租，每期递增 $44。全部设备都已解锁，考验持续盈利与准备金管理。',lesson:'交租周期只有三天。扩建前预留下一期租金和维护费，别把账面余额全当成可投资资金。',goal:()=>true,metric:s=>cashMetric(s,55000)}
];
function currentMission() { return (state.campaignRevision===CAMPAIGN_REVISION ? CAMPAIGN : LEGACY_CAMPAIGN).find(l=>l.id===currentLevel); }
const legacyProgress=(()=>{const raw=readStorage('ev_tycoon_progress_v2',{});return raw&&typeof raw==='object'&&!Array.isArray(raw)?Object.fromEntries(Object.entries(raw).filter(([id,stars])=>LEGACY_LEVEL_MAP[id]&&Number.isInteger(stars)&&stars>=1&&stars<=3)):{};})();
function readCareer() {
 const raw=readStorage('ev_tycoon_career_v3',null);
 if(raw?.version===3) return {version:3,unlocks:TECHNOLOGIES.map(t=>t.key).filter(k=>Array.isArray(raw.unlocks)&&raw.unlocks.includes(k))};
 const old=legacyProgress;
 const unlocks=old?.[2] ? TECHNOLOGIES.map(t=>t.key) : old?.[1] ? ['fastCharger','solar'] : [];
 return {version:3,unlocks};
}
let career=readCareer();
function technologyAvailable(key) {
 if(['slowCharger','transformer'].includes(key)||!currentLevel) return true;
 if(state.campaignRevision!==CAMPAIGN_REVISION) return true;
 return career.unlocks.includes(key);
}
function purchaseRestriction(key) {
 if(key==='slowCharger'&&state.settings.mode==='super')return '模式禁止';
 if(key==='transformer'&&state.settings.mode==='offgrid')return '离网禁止';
 if(!technologyAvailable(key))return `${TECHNOLOGY_BY_KEY[key]?.level||0}关解锁`;
 return '';
}
// 通关后按关卡解锁对应设备，并弹一次卡片说明入口。
function unlockTechnologiesForLevel(id) {
 const mission=CAMPAIGN.find(l=>l.id===id);
 const tech=mission&&mission.unlock?TECHNOLOGY_BY_KEY[mission.unlock]:null;
 if(!tech)return null;
 if(!career.unlocks.includes(tech.key)){career.unlocks.push(tech.key);writeStorage('ev_tycoon_career_v3',career)}
 announceUnlock(tech,0);
 return tech;
}
function openResearch(){renderResearch();openModal('research-modal')}
function renderResearch(){
 document.getElementById('research-note').textContent=state.campaignRevision!==CAMPAIGN_REVISION&&currentLevel?'经典存档沿用旧关卡规则。选择新战役体验成长解锁；原存档可继续经营。':'解锁跟着关卡走：打赢前一关，下一件设备才会开放，并且跨关永久保留。1 度＝1 kWh。';
 document.getElementById('research-list').innerHTML=TECHNOLOGIES.map(t=>`<div class="research-row ${technologyAvailable(t.key)?'researched':''}"><b>${t.name}<small>${technologyAvailable(t.key)?'已解锁':'未解锁'}</small></b><span>${t.requirement}</span></div>`).join('');
}

let progress = readStorage('ev_tycoon_progress_v3', {});
if (!progress || typeof progress !== 'object' || Array.isArray(progress)) progress = {};
progress=Object.fromEntries(Object.entries(progress).filter(([id,stars])=>CAMPAIGN.some(m=>m.id===Number(id))&&Number.isInteger(stars)&&stars>=1&&stars<=3));
let modalWasRunning = false;
let lastSavedAt = 0;
let toastTimer;
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } }
function writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}
// 解锁说明：弹窗只负责讲清「新开放的入口在哪」，不改变游戏节奏。
const TECHNOLOGY_DETAIL = {
    fastCharger: { icon: '⚡', effect: '新增 30 kW 快充桩：$2,400/台，日维护 $35。车辆直流上限与站点配电共同限速。', hint: '入口：底部设备栏「快充」' },
    solar: { icon: '☀️', effect: '新增屋顶光伏：$1,200/组，日维护 $8，白天直接供车、减少购电。', hint: '入口：底部设备栏「光伏」' },
    battery: { icon: '🔋', effect: '新增储能柜：$1,800/组，日维护 $18，谷时存电、峰时放电。', hint: '入口：底部设备栏「储能」' },
    bank: { icon: '🏦', effect: '开放银行贷款：模拟日利率 2%，按日还款，可提前结清。', hint: '入口：顶部「银行」按钮' }
};
let unlockQueue = [], unlockTimer, unlockCurrent = null, unlockDeferred = false;
function announceUnlock(tech, reward = 0) {
    unlockQueue.push({ tech, reward });
    if (!unlockCurrent) showUnlock();
}
function paintUnlock() {
    const current = unlockCurrent;
    if (!current) return;
    const detail = TECHNOLOGY_DETAIL[current.tech.key] || { icon: '✦', effect: '', hint: '' };
    document.getElementById('unlock-icon').textContent = detail.icon;
    document.getElementById('unlock-eyebrow').textContent = '新解锁';
    document.getElementById('unlock-title').textContent = current.tech.name;
    document.getElementById('unlock-desc').textContent = detail.effect;
    document.getElementById('unlock-hint').textContent = detail.hint;
    document.getElementById('unlock-popup').classList.remove('hidden');
    unlockDeferred = false;
    clearTimeout(unlockTimer); unlockTimer = setTimeout(dismissUnlock, 6000);
}
function showUnlock() {
    // 有结算或账单窗口挡在前面时先排队，等窗口关掉再完整显示。
    if (modalOpenCount > 0) { unlockDeferred = true; return; }
    unlockCurrent = unlockQueue.shift() || null;
    if (unlockCurrent) paintUnlock();
}
function syncUnlockPopup() {
    const popup = document.getElementById('unlock-popup');
    if (modalOpenCount > 0) {
        if (!popup.classList.contains('hidden')) { popup.classList.add('hidden'); unlockDeferred = true; clearTimeout(unlockTimer); }
        return;
    }
    if (unlockCurrent) { if (unlockDeferred) paintUnlock(); }
    else if (unlockQueue.length) showUnlock();
}
function dismissUnlock() {
    clearTimeout(unlockTimer);
    unlockCurrent = null; unlockDeferred = false;
    document.getElementById('unlock-popup').classList.add('hidden');
    if (unlockQueue.length) unlockTimer = setTimeout(showUnlock, 260);
}
function clearUnlockPopup() {
    clearTimeout(unlockTimer); unlockQueue = []; unlockCurrent = null; unlockDeferred = false;
    document.getElementById('unlock-popup').classList.add('hidden');
}
function launchGame() {
    document.querySelectorAll('[id$="-modal"]').forEach(el => { el.classList.add('hidden'); el.removeAttribute('aria-modal'); });
    modalOpenCount = 0;
    clearUnlockPopup();
    document.getElementById('game-main-container').classList.remove('hidden');
    document.getElementById('campaign-screen').classList.add('hidden');
    window.scrollTo(0, 0);
    state.lastTickData.limit = powerLimit(state, CONFIG);
    state.initialMoney = state.money;
    state.totalEnergy = 0; state.totalRevenue = 0; state.served = 0; state.lost = 0; state.history = [];
    state.ended = false;
    if (state.settings.mode === 'offgrid') {
        Object.keys(state.currentCosts).forEach(k => state.currentCosts[k] = Math.floor(state.currentCosts[k] * 0.75));
        state.batteryKwh = currentMission()?.startBattery ?? Math.min(100,state.assets.battery*CONFIG.batteryCap);
    }
    if (state.settings.mode === 'rain') {
        state.weather = 'rainy'; state.forecast = 'rainy';
        state.activeBuffs.push({ name: '永恒雨季', type: 'forcedWeather', val: 'rainy', daysLeft: 9999, icon: '🌧️' });
    }
    CONFIG.inflationRate = state.settings.mode === 'inflation' ? 1.5 : 1.1;
    refreshPriceWheel();
    scheduleNextEvent();
    if (currentLevel === 1) state.nextEventTime = null;
    initChart(); resizeCanvas();
    setSpeed(500);
    toast('营业开始 · 1×，可随时调整速度或暂停');
}
function currentGridPrice() {
    if (state.settings.mode === 'offgrid') return 0;
    let price = CITY_CONFIG[state.settings.city].prices[state.hour] || 0;
    if (state.settings.mode === 'collapse') price = state.hour >= 6 && state.hour < 18 ? 10 : 0.2;
    for (const b of state.activeBuffs) if (['gridDiscount', 'gridPriceMult'].includes(b.type)) price *= b.val;
    return price;
}
function resumeAfterModal() {
    if (modalOpenCount === 0 && modalWasRunning && !state.ended) setSpeed(state.lastGameSpeed);
    else updateUI();
    syncUnlockPopup();
}
function renderCampaign() {
    const complete = CAMPAIGN.filter(l => progress[l.id]).length;
    document.getElementById('campaign-complete').textContent = `${complete} / ${CAMPAIGN.length} 已完成`;
    document.getElementById('campaign-progress').style.width = `${complete / CAMPAIGN.length * 100}%`;
    document.getElementById('mission-list').innerHTML = CAMPAIGN.map(l => {
        const unlocked = isLevelUnlocked(l.id), stars = progress[l.id] || 0;
        const oldId=Object.keys(LEGACY_LEVEL_MAP).find(id=>LEGACY_LEVEL_MAP[id]===l.id);
        const oldStars=legacyProgress?.[oldId]||0;
        const objective = l.short;
        return `<button type="button" class="mission ${unlocked ? '' : 'locked'} ${stars ? 'completed' : ''}" onclick="selectLevel(${l.id})" ${unlocked ? '' : 'disabled'} aria-label="第 ${l.id} 关 ${l.name}，${unlocked ? l.objective : '完成上一关后解锁'}">
            <span class="mission-top"><strong><i>${String(l.id).padStart(2,'0')}</i>${l.name}</strong><span class="tag">${stars ? '★'.repeat(stars) : oldStars ? '旧'+'★'.repeat(oldStars) : l.tag}</span></span><span class="mission-mode">${l.modeName}</span><span class="mission-objective">${objective}</span><span class="mission-arrow">${unlocked ? '↗' : '锁定'}</span></button>`;
    }).join('');
    const saved = readStorage('ev_tycoon_save_v2', null);
    document.getElementById('resume-game').classList.toggle('hidden', !validSave(saved));
    if (validSave(saved)) document.getElementById('resume-detail').textContent = `${saved.state.levelName || '自由经营'} · 第 ${saved.state.day} 天`;
}
function showCampaign() {
    clearTimeout(toastTimer); document.getElementById('toast').classList.add('hidden');
    clearUnlockPopup();
    syncGoalChip();
    if (!state.ended && !document.getElementById('game-main-container').classList.contains('hidden')) { setSpeed(0); modalWasRunning = false; saveGame(true); }
    clearTimeout(state.timer);
    state.paused = true;
    document.getElementById('game-main-container').classList.add('hidden');
    document.getElementById('campaign-screen').classList.remove('hidden');
    document.querySelectorAll('[id$="-modal"]').forEach(el => { el.classList.add('hidden'); el.removeAttribute('aria-modal'); });
    modalOpenCount = 0;
    renderCampaign();
    window.scrollTo(0, 0);
    document.getElementById('campaign-title').focus({ preventScroll: true });
}
function saveGame(force = false) {
    if (state.ended || !state.levelName || (document.getElementById('game-main-container').classList.contains('hidden') && !force)) return;
    if (!force && Date.now() - lastSavedAt < 3000) return;
    lastSavedAt = Date.now();
    const data = { version: 3, currentLevel, state: { ...state, timer: null, paused: true } };
    const saved = writeStorage('ev_tycoon_save_v2', data);
    document.getElementById('save-status').textContent = saved ? '已自动保存' : '存档不可用';
}
function validSave(data) {
    return [2,3].includes(data?.version) && (data.version===2 || [2,3].includes(data.state?.campaignRevision)) && Number.isInteger(data.currentLevel) && data.currentLevel >= 0 && data.currentLevel <= (data.state?.campaignRevision===CAMPAIGN_REVISION?CAMPAIGN.length:LEGACY_CAMPAIGN.length)
        && data.state && !data.state.ended && Number.isFinite(data.state.money) && data.state.day >= 1
        && data.state.hour >= 0 && data.state.hour < 24 && data.state.minute >= 0 && data.state.minute < 60
        && CITY_CONFIG[data.state.settings?.city] && LOC_CONFIG[data.state.settings?.loc]
        && data.state.assets && Object.keys(CONFIG.dailyCost).every(k => Number.isInteger(data.state.assets[k]) && data.state.assets[k] >= 0)
        && Array.isArray(data.state.cars) && Array.isArray(data.state.activeBuffs) && data.state.chartData
        && ['load', 'solar', 'battery', 'yesterdayLoad'].every(k => Array.isArray(data.state.chartData[k]) && data.state.chartData[k].length === 144)
        && data.state.loan && Number.isFinite(data.state.batteryKwh);
}
function resumeGame() {
    const saved = readStorage('ev_tycoon_save_v2', null);
    if (!validSave(saved)) { toast('没有可恢复的存档，请开始新的关卡。'); return; }
    clearTimeout(state.timer);
    state = { ...getInitialState(), ...saved.state, campaignRevision:saved.state.campaignRevision===CAMPAIGN_REVISION?CAMPAIGN_REVISION:2, paused: true, timer: null };
    currentLevel = saved.currentLevel;
    CONFIG.inflationRate = state.settings.mode === 'inflation' ? 1.5 : 1.1;
    modalOpenCount = 0; modalWasRunning = false;
    clearUnlockPopup();
    document.getElementById('game-main-container').classList.remove('hidden');
    document.getElementById('campaign-screen').classList.add('hidden');
    refreshPriceWheel();
    window.scrollTo(0, 0);
    initChart(); resizeCanvas();
    setSpeed(state.lastGameSpeed || 500);
    if (state.pendingRent > 0) showBillModal();
    else if (state.pendingEvent) {
        const ev = state.pendingEvent;
        document.getElementById('ev-title').textContent = ev.title;
        document.getElementById('ev-desc').textContent = ev.description;
        document.getElementById('ev-icon').textContent = ev.icon;
        document.getElementById('ev-amt').textContent = ev.amount;
        openModal('event-modal');
    }
    toast('已恢复 · 继续营业');
}
function retryCurrentGame() {
    closeModal('game-over-modal');
    if (currentLevel) startLevelGame(state.campaignRevision===CAMPAIGN_REVISION?currentLevel:LEGACY_LEVEL_MAP[currentLevel]);
    else { selectedSettings = { ...state.settings }; startGame(); }
}
let helpPage = 0;
const HELP_PAGES = [
    ['开始经营', '默认 1× 自动开始，4× / 8× 加速；暂停键或空格键可暂停。\n速度、经营与关卡在屏幕顶部；调价和购买设备在底部。'],
    ['让资金转起来', '售价高，愿意进站的客户会减少。\n电费实时扣，维护与还款每天扣。\n留好租金；详细收支点「经营」查看。'],
    ['能源与车辆', '主屏曲线可点按读取功率。光伏优先，储能低价充、高价放。\n车型参数为模拟值；到站电量均值20%、标准差7%，限制在5%～50%。\n车旁显示容量、当前电量、实际/车辆上限功率。桩与站点供电也会限速。']
];
function openHelp() { helpPage = 0; renderHelp(); openModal('help-modal'); }
function renderHelp() {
    document.getElementById('help-title').textContent = HELP_PAGES[helpPage][0];
    document.getElementById('help-text').textContent = HELP_PAGES[helpPage][1];
    document.getElementById('help-page').textContent = `${helpPage + 1} / ${HELP_PAGES.length}`;
    document.getElementById('help-prev').disabled = helpPage === 0;
    document.getElementById('help-next').disabled = helpPage === HELP_PAGES.length - 1;
}
function changeHelp(delta) { helpPage = Math.max(0, Math.min(HELP_PAGES.length - 1, helpPage + delta)); renderHelp(); }
function closeHelp() { closePanel('help-modal'); }
function openGoal() {
    // 没有正在经营的局时，顶部「目标」直接回到选关页。
    if (!state.levelName || state.ended || document.getElementById('game-main-container').classList.contains('hidden')) { showCampaign(); return; }
    openModal('goal-modal');
}
function syncGoalChip() {
    const chip = document.getElementById('goal-chip');
    if (chip) chip.disabled = !state.levelName || state.ended;
}
function closePanel(id) { closeModal(id); resumeAfterModal(); }
function openBankFromGoal() {
    if (!technologyAvailable('bank')) { openResearch(); return; }
    openLoanModal(); closeModal('goal-modal');
}
function updateDashboard() {
    const mission = currentMission();
    document.getElementById('station-context').textContent = `${CITY_CONFIG[state.settings.city].name} / ${LOC_CONFIG[state.settings.loc].name}${mission?.modeName ? ' · '+mission.modeName.split(' · ')[0] : ''}`;
    document.getElementById('mission-goal').textContent = mission ? mission.objective : '自由经营 · 生存 100 天';
    const days = state.targetDays || CONFIG.targetDays;
    document.getElementById('day-progress').textContent = `${Math.min(state.day - 1, days)} / ${days} 天`;
    document.getElementById('day-progress-bar').style.width = `${Math.min(100, (state.day - 1) / days * 100)}%`;
    const metric = mission ? mission.metric(state) : '生存 100 天';
    document.getElementById('mission-metric').textContent = metric;
    const nextPayment = loanPayment(state.loan, LOAN_DAILY_RATE).amount;
    const reserve = calcWeeklyRent() + calcDailyCost() * 3 + nextPayment * 3;
    const available = state.money - reserve;
    document.getElementById('cash-reserve').textContent = `$${Math.ceil(reserve).toLocaleString('en-US')}`;
    document.getElementById('available-cash').textContent = `${available < 0 ? '−' : ''}$${Math.abs(Math.floor(available)).toLocaleString('en-US')}`;
    document.getElementById('available-cash').classList.toggle('danger', available < 0);
    document.getElementById('reserve-note').textContent = available < 0 ? '准备金不足，放缓扩建' : '本期租金 + 3 天维护与还贷';
    const d = state.lastTickData;
    for (const [id, value] of Object.entries({solar:d.solar, battery:d.batt, grid:d.grid, load:d.load})) document.getElementById('reading-' + id).textContent = `${Number(value || 0).toFixed(1)}`;
    document.getElementById('batt-status-text').textContent = d.battAction === 'charge' ? '充电中' : d.battAction === 'discharge' ? '放电中' : '待机';
    document.getElementById('ui-battery').textContent = `${Math.round(state.batteryKwh)} / ${state.assets.battery * CONFIG.batteryCap} kWh`;
    document.getElementById('ui-occupancy').textContent = `${state.cars.length} / ${state.assets.slowCharger + state.assets.fastCharger} 正在充电`;
    const todayProfitEl = document.getElementById('ui-today-profit');
    todayProfitEl.textContent = `${state.currentDayProfit >= 0 ? '+' : '−'}$${compactMoney(state.currentDayProfit)}`;
    todayProfitEl.className = state.currentDayProfit >= 0 ? 'cash-positive' : 'cash-negative';
    document.getElementById('ui-total-energy').textContent = `${Math.round(state.totalEnergy || 0)} kWh`;
    const hasBattery = state.assets.battery > 0;
    document.getElementById('ui-battery').classList.toggle('hidden', hasBattery === false);
    document.getElementById('batt-status-text').classList.toggle('hidden', hasBattery === false);
    document.getElementById('compact-battery').classList.toggle('hidden', hasBattery === false);
    document.getElementById('compact-battery').textContent = hasBattery ? `储能 ${Math.round(state.batteryKwh)} kWh` : '';
    const margin = state.price - currentGridPrice();
    let advice = mission?.lesson || '关注客流与电价，先提高设备利用率，再投入扩建。';
    if (available < 0) advice = '资金低于准备金。先暂停扩建，留出即将到期的租金和维护费。';
    else if (state.settings.mode === 'offgrid' && d.unmet > 0) advice = '光储供电不足，车辆正在限速。增加光伏或储能，并为夜间客流留电。';
    else if (d.reqLoad > d.limit) advice = '需求超过配电上限，充电正在限速。扩建配电比继续增加充电桩更有效。';
    else if (margin < 0 && state.settings.mode !== 'offgrid') advice = '当前售价低于购电价。适当提价，或用光伏和储能减少高峰购电。';
    document.getElementById('advisor-text').textContent = advice;
    const ids = { slowCharger: 'slow', fastCharger: 'fast', solar: 'solar', battery: 'battery', transformer: 'transformer' };
    for (const [key, id] of Object.entries(ids)) {
        const btn = document.getElementById('btn-' + id);
        const restricted = purchaseRestriction(key);
        btn.disabled = Boolean(restricted) || state.money < getAssetCost(key);
        btn.classList.toggle('hidden', Boolean(restricted));
        btn.title = restricted ? (TECHNOLOGY_BY_KEY[key]?.requirement || restricted) : state.money < getAssetCost(key) ? '资金不足' : `购买后每日维护增加 $${CONFIG.dailyCost[key] || 0}`;
        btn.querySelector('.asset-state').textContent = restricted ? restricted : state.money < getAssetCost(key) ? '资金不足' : '购买 +';
    }
    document.getElementById('btn-loan').disabled = false;
    document.getElementById('btn-loan').textContent = technologyAvailable('bank') ? '银行' : '银行 🔒';
    document.getElementById('btn-loan').title = technologyAvailable('bank') ? '借款与还款计划' : (TECHNOLOGY_BY_KEY.bank?.requirement || '未解锁');
    document.getElementById('card-loan-status').disabled = false;
    const bankAvailable = technologyAvailable('bank');
    const loanButton = document.getElementById('btn-loan');
    const loanCard = document.getElementById('card-loan-status');
    const bankDetails = document.getElementById('btn-bank-details');
    loanButton.classList.toggle('hidden', bankAvailable === false);
    loanCard.classList.toggle('hidden', bankAvailable === false);
    if (bankDetails) bankDetails.classList.toggle('hidden', bankAvailable === false);
    if(!technologyAvailable('bank'))document.getElementById('ui-loan-payment').textContent='未解锁';
    document.getElementById('mission-detail').textContent = mission ? `${mission.detail} 活到第 ${mission.days} 天并付清所有到期费用即为通关；净资金＝余额减未还贷款本金，$${mission.stars[0].toLocaleString('en-US')} 两星，$${mission.stars[1].toLocaleString('en-US')} 三星。` : '按自己的节奏投资，体验不同城市、地段与挑战模式。';
    const nextTech=TECHNOLOGIES.find(t=>!technologyAvailable(t.key));
    const liveChip=document.getElementById('station-live');
    liveChip.title=nextTech?`下一件解锁：${nextTech.name} · ${nextTech.requirement}`:'全部设备已解锁';
    liveChip.setAttribute('aria-label',nextTech?`设备与技术解锁进度：下一件是${nextTech.name}，${nextTech.requirement}`:'全部设备已解锁');
    syncGoalChip();
    if(!document.getElementById('research-modal').classList.contains('hidden'))renderResearch();
    const overload = d.reqLoad > d.limit || (state.settings.mode === 'offgrid' && d.unmet > 0);
    document.getElementById('ui-overload-msg').classList.toggle('hidden', !overload);
    document.getElementById('ui-overload-msg').textContent = state.settings.mode === 'offgrid' ? '光储不足 · 充电限速' : '配电过载 · 充电限速';
    const history = state.history || [];
    document.getElementById('ledger-list').innerHTML = history.length ? history.slice(-3).reverse().map(h => `<div class="ledger-row"><span>第 ${h.day} 天</span><span class="${h.profit >= 0 ? 'cash-positive' : 'cash-negative'}">${h.profit >= 0 ? '+' : '−'}$${Math.abs(h.profit).toFixed(1)}</span></div>`).join('') : '<p class="empty-note">首日结算后，收支会显示在这里。</p>';
    syncUnlockPopup();
}
window.addEventListener('pagehide', () => saveGame(true));
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !document.getElementById('game-main-container').classList.contains('hidden')) { setSpeed(0); modalWasRunning = false; saveGame(true); }
});
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && modalOpenCount === 0 && !document.getElementById('game-main-container').classList.contains('hidden')) {
        e.preventDefault(); setSpeed(state.paused ? state.lastGameSpeed : 0);
    }
    if (e.key === 'Escape') {
        if (!document.getElementById('unlock-popup').classList.contains('hidden')) { dismissUnlock(); return; }
        if (!document.getElementById('research-modal').classList.contains('hidden')) {closePanel('research-modal');return;}
        if (!document.getElementById('goal-modal').classList.contains('hidden')) closePanel('goal-modal');
        else if (!document.getElementById('help-modal').classList.contains('hidden')) closeHelp();
        else if (!document.getElementById('loan-modal').classList.contains('hidden')) closeLoanModal();
        else if (!document.getElementById('start-modal').classList.contains('hidden')) showCampaign();
    }
    const dialog = document.querySelector('[aria-modal="true"]');
    if (e.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
});
loadUnlockedLevels();
renderCampaign();
updateUI();
