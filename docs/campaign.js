const CAMPAIGN = [
    { id: 1, name: '第一度电', subtitle: '从一座小站开始', tag: '入门', days: 7, money: 5000, city: 'sh', loc: 'ind', mode: 'std', assets: { slowCharger: 3, transformer: 1 }, pool: 24,
      objective: '运营 7 天，保持资金为正', detail: '专注慢充与定价。首周租金 $300，无随机事件；先学会留出日维护费。', lesson: '维护费每天结算；价格越高，愿意进站的客户越少。', goal: s => s.money >= 0 },
    { id: 2, name: '阳光合伙人', subtitle: '让屋顶也赚点钱', tag: '基础', days: 14, money: 6000, city: 'sh', loc: 'ind', mode: 'std', assets: { slowCharger: 3, transformer: 1 }, pool: 28,
      objective: '运营 14 天，建成 2 组光伏', detail: '解锁光伏、储能与银行。光伏优先供电，多余电量可进入电池。', lesson: '白天客流与光伏发电重叠，先投光伏，再考虑储能。', goal: s => s.assets.solar >= 2 },
    { id: 3, name: '快充时代', subtitle: '效率带来新机会', tag: '进阶', days: 21, money: 7500, city: 'gz', loc: 'com', mode: 'super', assets: { slowCharger: 0, fastCharger: 2, transformer: 2 }, pool: 32,
      objective: '运营 21 天，拥有 3 台快充', detail: '只允许快充。广州下午电价高，投资配电与储能，平衡速度和成本。', lesson: '每台快充需要 30 kW。扩建充电桩时，也要留意配电上限。', goal: s => s.assets.fastCharger >= 3 },
    { id: 4, name: '离网绿洲', subtitle: '把阳光留到夜里', tag: '进阶', days: 14, money: 7500, city: 'sh', loc: 'res', mode: 'offgrid', assets: { slowCharger: 2, solar: 4, battery: 3, transformer: 0 }, pool: 24,
      objective: '运营 14 天，累计交付 250 kWh', detail: '完全断开电网。以光伏与储能供电，设备采购优惠 25%，初始储能 200 kWh。', lesson: '晚间客流依赖白天储下的电；没电时不会产生虚假的充电收入。', goal: s => (s.totalEnergy || 0) >= 250 },
    { id: 5, name: '峰谷博弈', subtitle: '有限功率，无限策略', tag: '挑战', days: 28, money: 8500, city: 'bj', loc: 'res', mode: 'powerlimit', assets: { slowCharger: 2, fastCharger: 1, transformer: 2, battery: 1 }, pool: 32,
      objective: '运营 28 天，最终资金 ≥ $5,000', detail: '配电扩容仅 +10 kW。北京晚高峰更长，控制维护开支，利用谷电储能。', lesson: '租金准备金比账面余额更有参考价值。扩建后不要一次花光。', goal: s => s.money >= 5000 },
    { id: 6, name: '城市旗舰', subtitle: '经营你的充电帝国', tag: '大师', days: 40, money: 12000, city: 'gz', loc: 'com', mode: 'luxury', assets: { slowCharger: 3, fastCharger: 2, transformer: 3, solar: 2, battery: 2 }, pool: 40,
      objective: '运营 40 天，拥有 8 台充电桩', detail: '高客流伴随高租金。综合运用定价、扩建、推广和能源调度完成最后挑战。', lesson: '先把已有设备用起来，再扩建；客流、功率和现金都要跟得上。', goal: s => s.assets.slowCharger + s.assets.fastCharger >= 8 }
];
let progress = readStorage('ev_tycoon_progress_v2', {});
if (!progress || typeof progress !== 'object' || Array.isArray(progress)) progress = {};
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
function launchGame() {
    document.querySelectorAll('[id$="-modal"]').forEach(el => el.classList.add('hidden'));
    modalOpenCount = 0;
    document.getElementById('game-main-container').classList.remove('hidden');
    document.getElementById('campaign-screen').classList.add('hidden');
    window.scrollTo(0, 0);
    state.lastTickData.limit = powerLimit(state, CONFIG);
    state.initialMoney = state.money;
    state.totalEnergy = 0; state.totalRevenue = 0; state.served = 0; state.lost = 0; state.history = [];
    state.ended = false;
    if (state.settings.mode === 'offgrid') {
        Object.keys(state.currentCosts).forEach(k => state.currentCosts[k] = Math.floor(state.currentCosts[k] * 0.75));
        state.batteryKwh = currentLevel === 4 ? 200 : 100;
    }
    if (state.settings.mode === 'rain') {
        state.weather = 'rainy'; state.forecast = 'rainy';
        state.activeBuffs.push({ name: '永恒雨季', type: 'forcedWeather', val: 'rainy', daysLeft: 9999, icon: '🌧️' });
    }
    CONFIG.inflationRate = state.settings.mode === 'inflation' ? 1.5 : 1.1;
    document.getElementById('price-slider').value = state.price;
    document.getElementById('price-display').textContent = `$${state.price.toFixed(2)}`;
    scheduleNextEvent();
    if (currentLevel === 1) state.nextEventTime = null;
    initChart(); resizeCanvas();
    state.paused = true;
    updateUI(); saveGame(true);
    document.getElementById('speed-1').focus({ preventScroll: true });
    toast('准备就绪。先查看经营目标，再点击 1× 开始营业。');
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
}
function renderCampaign() {
    const complete = CAMPAIGN.filter(l => progress[l.id]).length;
    document.getElementById('campaign-complete').textContent = `${complete} / 6 已完成`;
    document.getElementById('campaign-progress').style.width = `${complete / 6 * 100}%`;
    document.getElementById('mission-list').innerHTML = CAMPAIGN.map(l => {
        const unlocked = isLevelUnlocked(l.id), stars = progress[l.id] || 0;
        return `<button type="button" class="mission ${unlocked ? '' : 'locked'} ${stars ? 'completed' : ''}" onclick="selectLevel(${l.id})" ${unlocked ? '' : 'disabled'} aria-label="第 ${l.id} 关 ${l.name}，${unlocked ? l.objective : '完成上一关后解锁'}">
            <span class="mission-no">${String(l.id).padStart(2, '0')}</span>
            <span class="mission-body"><span class="mission-top"><strong>${l.name}</strong><span class="tag">${stars ? '已通关 ' + '★'.repeat(stars) : l.tag}</span></span><span class="mission-sub">${l.subtitle}</span><span class="mission-objective">${l.objective}</span><span class="mission-meta">${CITY_CONFIG[l.city].name} · ${LOC_CONFIG[l.loc].name} · 启动资金 $${l.money.toLocaleString('en-US')}</span></span>
            <span class="mission-arrow">${unlocked ? '↗' : '锁定'}</span></button>`;
    }).join('');
    const saved = readStorage('ev_tycoon_save_v2', null);
    document.getElementById('resume-game').classList.toggle('hidden', !validSave(saved));
    if (validSave(saved)) document.getElementById('resume-detail').textContent = `${saved.state.levelName || '自由经营'} · 第 ${saved.state.day} 天`;
}
function showCampaign() {
    if (!state.ended && !document.getElementById('game-main-container').classList.contains('hidden')) { setSpeed(0); modalWasRunning = false; saveGame(true); }
    clearTimeout(state.timer);
    state.paused = true;
    document.getElementById('game-main-container').classList.add('hidden');
    document.getElementById('campaign-screen').classList.remove('hidden');
    document.querySelectorAll('[id$="-modal"]').forEach(el => el.classList.add('hidden'));
    modalOpenCount = 0;
    renderCampaign();
    window.scrollTo(0, 0);
    document.getElementById('campaign-title').focus({ preventScroll: true });
}
function saveGame(force = false) {
    if (state.ended || !state.levelName || (document.getElementById('game-main-container').classList.contains('hidden') && !force)) return;
    if (!force && Date.now() - lastSavedAt < 3000) return;
    lastSavedAt = Date.now();
    const data = { version: 2, currentLevel, state: { ...state, timer: null, paused: true } };
    const saved = writeStorage('ev_tycoon_save_v2', data);
    document.getElementById('save-status').textContent = saved ? '已自动保存' : '存档不可用';
}
function validSave(data) {
    return data?.version === 2 && Number.isInteger(data.currentLevel) && data.currentLevel >= 0 && data.currentLevel <= 6
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
    state = { ...getInitialState(), ...saved.state, paused: true, timer: null };
    currentLevel = saved.currentLevel;
    CONFIG.inflationRate = state.settings.mode === 'inflation' ? 1.5 : 1.1;
    modalOpenCount = 0; modalWasRunning = false;
    document.getElementById('game-main-container').classList.remove('hidden');
    document.getElementById('campaign-screen').classList.add('hidden');
    document.getElementById('price-slider').value = state.price;
    document.getElementById('price-display').textContent = `$${state.price.toFixed(2)}`;
    window.scrollTo(0, 0);
    initChart(); resizeCanvas(); updateUI();
    if (state.pendingRent > 0) showBillModal();
    else if (state.pendingEvent) {
        const ev = state.pendingEvent;
        document.getElementById('ev-title').textContent = ev.title;
        document.getElementById('ev-desc').textContent = ev.description;
        document.getElementById('ev-icon').textContent = ev.icon;
        document.getElementById('ev-amt').textContent = ev.amount;
        openModal('event-modal');
    }
    toast('存档已恢复，点击速度按钮继续营业。');
}
function retryCurrentGame() {
    closeModal('game-over-modal');
    if (currentLevel) startLevelGame(currentLevel);
    else { selectedSettings = { ...state.settings }; startGame(); }
}
function openHelp() { openModal('help-modal'); }
function closeHelp() { closeModal('help-modal'); resumeAfterModal(); }
function updateDashboard() {
    const mission = CAMPAIGN.find(l => l.id === currentLevel);
    document.getElementById('station-context').textContent = `${CITY_CONFIG[state.settings.city].name} / ${LOC_CONFIG[state.settings.loc].name}`;
    document.getElementById('mission-title').textContent = state.levelName || '经营工作台';
    document.getElementById('mission-goal').textContent = mission ? mission.objective : '自由经营 · 生存 100 天';
    const days = state.targetDays || CONFIG.targetDays;
    document.getElementById('day-progress').textContent = `${Math.min(state.day - 1, days)} / ${days} 天`;
    document.getElementById('day-progress-bar').style.width = `${Math.min(100, (state.day - 1) / days * 100)}%`;
    const metric = currentLevel === 2 ? `光伏 ${state.assets.solar} / 2 组` : currentLevel === 3 ? `快充 ${state.assets.fastCharger} / 3 台` : currentLevel === 4 ? `交付 ${Math.floor(state.totalEnergy || 0)} / 250 kWh` : currentLevel === 5 ? `资金 $${Math.floor(state.money)} / $5,000` : currentLevel === 6 ? `充电桩 ${state.assets.slowCharger + state.assets.fastCharger} / 8 台` : '保持资金为正';
    document.getElementById('mission-metric').textContent = metric;
    const nextPayment = loanPayment(state.loan, LOAN_DAILY_RATE).amount;
    const reserve = calcWeeklyRent() + calcDailyCost() * 3 + nextPayment * 3;
    const available = state.money - reserve;
    document.getElementById('cash-reserve').textContent = `$${Math.ceil(reserve).toLocaleString('en-US')}`;
    document.getElementById('available-cash').textContent = `${available < 0 ? '−' : ''}$${Math.abs(Math.floor(available)).toLocaleString('en-US')}`;
    document.getElementById('available-cash').classList.toggle('danger', available < 0);
    document.getElementById('reserve-note').textContent = available < 0 ? '准备金不足，放缓扩建' : '本期租金 + 3 天维护与还贷';
    const d = state.lastTickData;
    document.getElementById('ui-battery').textContent = `${Math.round(state.batteryKwh)} / ${state.assets.battery * CONFIG.batteryCap} kWh`;
    document.getElementById('ui-occupancy').textContent = `${state.cars.length} / ${state.assets.slowCharger + state.assets.fastCharger} 正在充电`;
    document.getElementById('ui-today-profit').textContent = `${state.currentDayProfit >= 0 ? '+' : '−'}$${Math.abs(state.currentDayProfit).toFixed(1)}`;
    document.getElementById('ui-total-energy').textContent = `${Math.round(state.totalEnergy || 0)} kWh`;
    const margin = state.price - currentGridPrice();
    document.getElementById('price-note').textContent = state.settings.mode === 'offgrid' ? '离网供电 · 光伏优先，储能补充' : `每度电价差 ${margin < 0 ? '−' : '+'}$${Math.abs(margin).toFixed(2)} · 不含维护与租金`;
    document.getElementById('price-note').classList.toggle('danger', margin < 0);
    let advice = mission?.lesson || '关注客流与电价，先提高设备利用率，再投入扩建。';
    if (available < 0) advice = '资金低于准备金。先暂停扩建，留出即将到期的租金和维护费。';
    else if (state.settings.mode === 'offgrid' && d.unmet > 0) advice = '光储供电不足，车辆正在限速。增加光伏或储能，并为夜间客流留电。';
    else if (d.reqLoad > d.limit) advice = '需求超过配电上限，充电正在限速。扩建配电比继续增加充电桩更有效。';
    else if (margin < 0 && state.settings.mode !== 'offgrid') advice = '当前售价低于购电价。适当提价，或用光伏和储能减少高峰购电。';
    document.getElementById('advisor-text').textContent = advice;
    document.getElementById('count-marketing').textContent = state.marketingPurchases || 0;
    const ids = { slowCharger: 'slow', fastCharger: 'fast', solar: 'solar', battery: 'battery', transformer: 'transformer', marketing: 'marketing' };
    for (const [key, id] of Object.entries(ids)) {
        const btn = document.getElementById('btn-' + id);
        const restricted = currentLevel === 1 && ['fastCharger', 'solar', 'battery'].includes(key) || key === 'slowCharger' && state.settings.mode === 'super' || key === 'transformer' && state.settings.mode === 'offgrid';
        btn.disabled = restricted || state.money < getAssetCost(key);
        btn.title = restricted ? '本关不可购买' : state.money < getAssetCost(key) ? '资金不足' : `购买后每日维护增加 $${CONFIG.dailyCost[key] || 0}`;
        btn.querySelector('.asset-state').textContent = restricted ? '本关限制' : state.money < getAssetCost(key) ? '资金不足' : '购买 +';
    }
    document.getElementById('btn-loan').disabled = currentLevel === 1;
    document.getElementById('card-loan-status').disabled = currentLevel === 1;
    document.getElementById('mission-detail').textContent = mission?.detail || '按自己的节奏投资，体验不同城市、地段与挑战模式。';
    const speeds = { '0': 0, '1': 500, '4': 125, '8': 62.5 };
    for (const [id, ms] of Object.entries(speeds)) {
        const active = state.paused ? ms === 0 : ms === state.gameSpeed;
        document.getElementById('speed-' + id).classList.toggle('active', active);
        document.getElementById('speed-' + id).setAttribute('aria-pressed', String(active));
    }
    document.getElementById('station-live').textContent = state.paused ? '已暂停' : '营业中';
    const overload = d.reqLoad > d.limit || (state.settings.mode === 'offgrid' && d.unmet > 0);
    document.getElementById('ui-overload-msg').classList.toggle('hidden', !overload);
    document.getElementById('ui-overload-msg').textContent = state.settings.mode === 'offgrid' ? '光储不足 · 充电限速' : '配电过载 · 充电限速';
    const history = state.history || [];
    document.getElementById('ledger-list').innerHTML = history.length ? history.slice(-5).reverse().map(h => `<div class="ledger-row"><span>第 ${h.day} 天</span><span class="${h.profit < 0 ? 'danger' : ''}">${h.profit >= 0 ? '+' : '−'}$${Math.abs(h.profit).toFixed(1)}</span></div>`).join('') : '<p class="empty-note">首日结算后，收支会显示在这里。</p>';
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
        if (!document.getElementById('help-modal').classList.contains('hidden')) closeHelp();
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
