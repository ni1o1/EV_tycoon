const LOAN_DAILY_RATE = 0.02;
// 金额增减统一配色：加钱绿、扣钱红；警示文案一律红色。
const GAIN = '#2f8f63', LOSS = '#c0503c';
const CITY_CONFIG = {
    bj: { name: "北京", prices: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.75, 0.75, 0.75, 1.50, 1.50, 1.50, 0.75, 0.75, 0.75, 0.75, 1.50, 1.50, 1.50, 1.50, 1.50, 0.75, 0.35] },
    gz: { name: "广州", prices: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.75, 0.75, 1.50, 1.50, 0.75, 0.75, 1.50, 1.50, 1.50, 1.50, 1.50, 0.75, 0.75, 0.75, 0.75, 0.75] },
    sh: { name: "上海", prices: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.75, 0.75, 1.50, 1.50, 1.50, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 1.50, 1.50, 1.50, 0.75, 0.35, 0.35] }
};

const LOC_CONFIG = {
    res: { name: "居民区", traffic: [0.3, 0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 0.5, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.6, 0.8, 0.9, 1.0, 0.9, 0.7, 0.5, 0.4] }, 
    com: { name: "商业区", traffic: [0.05, 0.05, 0.0, 0.0, 0.0, 0.0, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 0.8, 0.7, 0.7, 0.6, 0.7, 0.9, 1.0, 1.0, 0.9, 0.6, 0.3, 0.1] }, 
    ind: { name: "就业中心", traffic: [0.05, 0.05, 0.05, 0.05, 0.1, 0.2, 0.5, 0.9, 1.0, 0.8, 0.6, 0.5, 0.5, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05] } 
};
// 每条曲线只描述一天内的相对形状；除以自身均值后，日均到站量由关卡客流强度决定。
Object.values(LOC_CONFIG).forEach(loc => { loc.avgTraffic = loc.traffic.reduce((a, b) => a + b, 0) / loc.traffic.length; });

const CONFIG = {
    initialMoney: 2800,
    dailyCost: { slowCharger: 12, fastCharger: 35, solar: 8, battery: 18, transformer: 15 },
    baseWeeklyRent: 1150,
    rentGrowth: 220,
    baseCosts: { slowCharger: 800, fastCharger: 2400, solar: 1200, battery: 1800, transformer: 1000 },
    inflationRate: 1.10, 
    batteryCap: 100, batteryRate: 20, solarMax: 10, 
    baseLoadLimit: 20, transformerBoost: 20, 
    chargerPower: { slow: 7, fast: 30 },
    // 自由经营的日均到站车辆数；关卡用各自的 traffic 覆盖。客流没有每日上限，能接住多少只看空闲桩位与配电。
    baseDailyTraffic: 50,
    weather: {
        types: ['sunny', 'cloudy', 'rainy'],
        probs: [0.6, 0.25, 0.15],
        eff: { sunny: 1.0, cloudy: 0.6, rainy: 0.1, foggy: 0.4, stormy: 0.0, snowy: 0.25 },
        names: { sunny: '晴', cloudy: '多云', rainy: '雨', foggy: '雾', stormy: '暴雨', snowy: '雪' },
        icons: { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', foggy: '🌫️', stormy: '⛈️', snowy: '❄️' }
    },
    carEmojis: ['🚗', '🚕', '🚙', '🏎️', '🚓', '🚑', '🚐', '🛻'],
    targetDays: 100
};

function generateTimeLabels() {
    const labels = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 10) {
            labels.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
    }
    return labels;
}
const TIME_LABELS = generateTimeLabels();

const weatherSystem = { sunAngle: 0, clouds: [], rainDrops: [], init: false };
function initWeatherSystem(w, h) {
    weatherSystem.clouds = [];
    for(let i=0; i<5; i++) { weatherSystem.clouds.push({ x: Math.random() * w, y: 20 + Math.random() * 60, speed: 0.2 + Math.random() * 0.3, scale: 0.8 + Math.random() * 0.5 }); }
    weatherSystem.rainDrops = [];
    for(let i=0; i<100; i++) { weatherSystem.rainDrops.push({ x: Math.random() * w, y: Math.random() * h, speed: 10 + Math.random() * 10, len: 10 + Math.random() * 15 }); }
    weatherSystem.init = true;
}

// ================= 状态管理 =================
let state = getInitialState();
let selectedSettings = { city: 'sh', loc: 'ind', mode: 'std' };
let modalOpenCount = 0;
let myChart = null;
let loanConfig = { type: 'installment' }; // 'installment' (等额本息) or 'principal' (等额本金)
let currentLevel = 0; // 当前选择的关卡
let unlockedLevels = []; // 已解锁的关卡

function getInitialState() {
    return {
        campaignRevision: 3, claimedMilestones: [], money: CONFIG.initialMoney, day: 1, hour: 8, minute: 0,
        paused: true, gameSpeed: 500, lastGameSpeed: 500,
        assets: { slowCharger: 1, fastCharger: 0, solar: 0, battery: 0, transformer: 0 }, 
        currentCosts: { ...CONFIG.baseCosts },
        batteryKwh: 0, price: 1.5, dailyTraffic: CONFIG.baseDailyTraffic,
        cars: [], 
        lastTickData: { load: 0, solar: 0, batt: 0, grid: 0, limit: CONFIG.baseLoadLimit, battAction: 'idle' },
        chartData: { demand: new Array(144).fill(null), solar: new Array(144).fill(null), battery: new Array(144).fill(null), load: new Array(144).fill(null), yesterdayLoad: new Array(144).fill(null) },
        weeksSurvived: 0,
        nextEventTime: null,
        activeBuffs: [],
        timer: null,
        currentDayProfit: 0, lastDayProfit: null,
        pendingRent: 0,
        weather: rollWeather(),
        forecast: rollWeather(),
        victoryAchieved: false,
        settings: { city: 'bj', loc: 'res', mode: 'std' },
        // 新增贷款状态
        loan: { active: false, principal: 0, totalRemaining: 0, daysLeft: 0, type: 'installment', originalDays: 0, originalPrincipal: 0 }
    };
}

// ================= UI & Setup =================

function selectOption(type, val) {
    const choices = { city: ['sh','gz','bj'], loc: ['ind','com','res'], mode: ['std','super','offgrid','ghost','luxury','powerlimit','inflation','rain','shark'] };
    if (!choices[type]?.includes(val)) return;
    selectedSettings[type] = val;
    document.getElementById(type + '-select').value = val;
    if (type === 'city') document.getElementById('city-desc').textContent = { sh: '日间平价时段长，适合新手。', gz: '下午电价高，留意储能。', bj: '晚高峰较长，留意夜间成本。' }[val];
    if (type === 'loc') document.getElementById('loc-desc').textContent = { ind: '早高峰客流较旺。', com: '日间和晚间都有客流。', res: '晚间客流集中。' }[val];
}

function selectLevel(level) {
    if (level > 0 && !isLevelUnlocked(level)) return;
    if (level === 0) { openModal('start-modal'); return; }
    startLevelGame(level);
}


function startLevelGame(level) {
    clearTimeout(state.timer);
    if(!CAMPAIGN.some(l=>l.id===level))return;
    currentLevel = level;
    state = getInitialState();
    const mission = CAMPAIGN.find(l => l.id === level);
    state.settings = { city: mission.city, loc: mission.loc, mode: mission.mode };
    state.targetDays = mission.days;
    state.levelName = mission.name;
    state.money = mission.money;
    state.assets = { ...state.assets, ...mission.assets };
    state.dailyTraffic = mission.traffic || CONFIG.baseDailyTraffic;
    state.weather = 'sunny'; state.forecast = 'sunny';
    launchGame();
}


function startGame() {
    clearTimeout(state.timer);
    closeModal('start-modal');
    currentLevel = 0;
    state = getInitialState();
    state.settings = { ...selectedSettings };
    state.levelName = '自由经营';
    state.dailyTraffic = state.settings.mode === 'luxury' ? 100 : CONFIG.baseDailyTraffic;
    if (state.settings.mode === 'super') { state.assets.slowCharger = 0; state.assets.fastCharger = 1; state.assets.transformer = 1; }
    if (state.settings.mode === 'offgrid') { state.assets.solar = 3; state.assets.battery = 2; state.batteryKwh = 100; }
    launchGame();
}


// 还没有光伏或储能时，曲线与图例不展示对应项目。
function energySeries() {
    const list = [{ key: 'yesterdayLoad', name: '昨日', color: '#9aa6b2', dashed: true }];
    if (state.assets.solar > 0) list.push({ key: 'solar', name: '光伏', color: '#e9a62b' });
    if (state.assets.battery > 0) list.push({ key: 'battery', name: '储能', color: '#24a27b' });
    list.push({ key: 'load', name: '电网', color: '#3f8bdd' });
    list.push({ key: 'demand', name: '负荷', color: '#9363bd' });
    return list;
}
let chartSeriesKey = '';
function initChart() {
    const chartDom = document.getElementById('chart-container');
    if (myChart) { myChart.dispose(); myChart = null; }
    if (!chartDom.clientWidth) return;
    myChart = echarts.init(chartDom);
    if (!state.chartData.demand) state.chartData.demand = new Array(144).fill(null);
    const series = energySeries();
    chartSeriesKey = series.map(s => s.key).join(',');
    const line = s => ({ id: s.key, name: s.name, type: 'line', data: state.chartData[s.key], showSymbol: false, smooth: false, itemStyle: { color: s.color }, lineStyle: { width: s.dashed ? 1 : 1.8, type: s.dashed ? 'dashed' : 'solid' } });
    const option = {
        animation: false, backgroundColor: 'transparent',
        graphic: [{id:'empty-note',type:'text',left:'center',top:'50%',invisible:state.chartData.load.some(v=>v!==null)||state.chartData.yesterdayLoad.some(v=>v!==null),style:{text:'营业后记录功率 · 点按曲线读取数值',fill:'#98a6ae',font:'9px sans-serif'}}],
        grid: { left: 30, right: 12, bottom: 18, top: 24 },
        legend: { data: series.map(s => s.name), top: 0, textStyle: { color: '#526477', fontSize: 9 }, itemWidth: 12, itemHeight: 5, itemGap: 10 },
        tooltip: { trigger: 'axis', confine: true, textStyle: { fontSize: 11 }, valueFormatter: value => value == null ? '—' : Number(value).toFixed(1) + ' kW' },
        xAxis: { type: 'category', boundaryGap: false, data: TIME_LABELS, axisLine: { lineStyle: { color: '#dce4e9' } }, axisTick: { show: false }, axisLabel: { color: '#83919c', fontSize: 8, interval: 35, showMaxLabel: true } },
        yAxis: { type: 'value', min: 0, splitNumber: 2, splitLine: { lineStyle: { color: '#e5ebef', type: 'dashed' } }, axisLabel: { color: '#748391', fontSize: 8 } },
        series: series.map(line)
    };
    myChart.setOption(option, true);
}
// 买下第一组光伏或储能后重建曲线，之后按 id 增量更新。
function refreshChartSeries() {
    if (!myChart) return;
    if (energySeries().map(s => s.key).join(',') !== chartSeriesKey) initChart();
}

function restartGame() {
    clearTimeout(state.timer);
    closeModal('game-over-modal');
    showCampaign();
}


function continueGame() {
    closeModal('game-over-modal');
    state.ended = false;
    setSpeed(state.lastGameSpeed);
    saveGame(true);
}


function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal || !modal.classList.contains('hidden')) return;
    if (modalOpenCount === 0) modalWasRunning = !state.paused;
    modal.classList.remove('hidden');
    modalOpenCount++;
    modal.setAttribute('aria-modal', 'true');
    state.paused = true;
    clearTimeout(state.timer);
    const first = modal.querySelector('button:not([disabled]), input');
    if (first) first.focus({ preventScroll: true });
    updateUI();
}


function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    modal.removeAttribute('aria-modal');
    modalOpenCount = Math.max(0, modalOpenCount - 1);
}


// ================= 贷款系统逻辑 =================
function openLoanModal() {
    if (!technologyAvailable('bank')) {openResearch();return;}
    openModal('loan-modal');
    if (state.loan.active) {
        document.getElementById('loan-form').classList.add('hidden');
        document.getElementById('loan-status-view').classList.remove('hidden');
        document.getElementById('status-principal').innerText = `$${Math.round(state.loan.principal)}`;
        document.getElementById('status-days').innerText = state.loan.daysLeft;
    } else {
        document.getElementById('loan-form').classList.remove('hidden');
        document.getElementById('loan-status-view').classList.add('hidden');
        updateLoanPreview();
    }
}

function setLoanType(type) {
    loanConfig.type = type;
    document.getElementById('btn-installment').className = type === 'installment' 
        ? "border-2 border-blue-500 bg-blue-50 text-blue-700 rounded-lg p-2 text-center cursor-pointer transition-colors"
        : "border border-slate-200 text-slate-600 rounded-lg p-2 text-center cursor-pointer transition-colors";
        
    document.getElementById('btn-principal').className = type === 'principal' 
        ? "border-2 border-blue-500 bg-blue-50 text-blue-700 rounded-lg p-2 text-center cursor-pointer transition-colors"
        : "border border-slate-200 text-slate-600 rounded-lg p-2 text-center cursor-pointer transition-colors";
    updateLoanPreview();
}
function updateLoanPreview() {
    const principal = parseInt(document.getElementById('loan-amt-slider').value);
    const days = parseInt(document.getElementById('loan-days-slider').value);
    const plan = loanPlan(principal, days, loanConfig.type, LOAN_DAILY_RATE);
    window.previewLoanData = plan;
    document.getElementById('loan-amt-val').innerText = `$${principal}`;
    document.getElementById('loan-days-val').innerText = `${days}天`;
    document.getElementById('loan-total-repay').innerText = `$${plan.totalRepay.toFixed(2)}`;
    document.getElementById('loan-daily-repay').innerText = `$${plan.firstDayPayment.toFixed(2)}`;
}

function takeLoan() {
    const data = window.previewLoanData;
    if (!data || state.loan.active || !technologyAvailable('bank')) return;

    state.money += data.principal;
    
    state.loan = {
        active: true,
        type: data.type,
        
        // 通用数据
        principal: data.principal,       // 当前剩余本金
        daysLeft: data.days,             // 剩余天数
        originalDays: data.days,         // 原始天数（计算等额本金利息需要）
        
        // 等额本息专用数据
        fixedDaily: data.fixedDaily || 0,
        
        // 等额本金专用数据
        dailyBasePrincipal: data.dailyBasePrincipal || 0
    };

    spawnFloatText(`贷款 +$${data.principal}`, GAIN);
    closeLoanModal(); 
    updateUI();
}

function closeLoanModal() {
    closeModal('loan-modal');
    resumeAfterModal(); saveGame(true);
}


// ================= 核心循环 =================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let canvasWidth, canvasHeight;

function tick() {
    clearTimeout(state.timer);
    if (state.paused || modalOpenCount > 0 || state.ended) return;
    let gridPrice = currentGridPrice();
    trySpawnCar(state.hour);
    processEnergy(gridPrice);
    const i = state.hour * 6 + state.minute / 10;
    state.chartData.solar[i] = state.lastTickData.solar;
    state.chartData.battery[i] = state.lastTickData.batt;
    state.chartData.load[i] = state.lastTickData.grid;
    if (!state.chartData.demand) state.chartData.demand = new Array(144).fill(null);
    state.chartData.demand[i] = state.lastTickData.load;
    if (myChart) myChart.setOption({ graphic: [{id:'empty-note',invisible:true}], series: energySeries().map(s => ({ id: s.key, data: state.chartData[s.key] })) });
    state.cars = state.cars.filter(car => {
        if (car.kwhReceived >= car.kwhNeeded - 0.001) { state.served = (state.served || 0) + 1; return false; }
        car.ticksLeft--;
        if (car.ticksLeft <= 0) { state.lost = (state.lost || 0) + 1; return false; }
        return true;
    });
    state.minute += 10;
    if (state.minute >= 60) {
        state.minute = 0; state.hour++;
        if (state.hour >= 24) { state.hour = 0; dailySettle(); }
        if (!checkEndGame() && modalOpenCount === 0 && state.nextEventTime && state.day === state.nextEventTime.day && state.hour === state.nextEventTime.hour) triggerRandomEvent();
    }
    if (checkEndGame()) return;
    updateUI(); draw(); saveGame();
    if (!state.paused && modalOpenCount === 0) state.timer = setTimeout(tick, state.gameSpeed);
}


function checkEndGame() {
    if (state.ended) return true;
    if (state.money < 0) { showGameOver(false); return true; }
    if (state.pendingRent > 0) return false;
    const mission = currentMission();
    const days = state.targetDays || CONFIG.targetDays;
    if (state.day > days && !state.victoryAchieved) {
        const passed = !mission || mission.goal(state);
        if (passed) state.victoryAchieved = true;
        showGameOver(passed, !passed);
        return true;
    }
    return false;
}


function showGameOver(victory, missedGoal = false) {
    state.paused = true; state.ended = true; clearTimeout(state.timer);
    document.querySelectorAll('[id$="-modal"]').forEach(el => { if (el.id !== 'game-over-modal') { el.classList.add('hidden'); el.removeAttribute('aria-modal'); } });
    modalOpenCount = 0;
    const mission = currentMission();
    const completedId=state.campaignRevision===CAMPAIGN_REVISION?currentLevel:LEGACY_LEVEL_MAP[currentLevel];
    if (victory && currentLevel) {
        unlockLevel(completedId + 1);
        const unlockedTech = state.campaignRevision === CAMPAIGN_REVISION ? unlockTechnologiesForLevel(completedId) : null;
        if (unlockedTech) setTimeout(() => toast(`新解锁：${unlockedTech.name} · 可在本关与后续关卡直接购买`), 400);
        const net = campaignCash(state);
        const score = net >= mission.stars[1] ? 3 : net >= mission.stars[0] ? 2 : 1;
        if(state.campaignRevision===CAMPAIGN_REVISION){
            progress[completedId]=Math.max(progress[completedId]||0,score);
            writeStorage('ev_tycoon_progress_v3',progress);
        }else{
            legacyProgress[currentLevel]=Math.max(legacyProgress[currentLevel]||0,score);
            writeStorage('ev_tycoon_progress_v2',legacyProgress);
            const learned=currentLevel>=2?TECHNOLOGIES.map(t=>t.key):['fastCharger','solar'];
            career.unlocks=[...new Set([...career.unlocks,...learned])];writeStorage('ev_tycoon_career_v3',career);
        }
    }
    document.getElementById('go-icon').innerText = victory ? '✦' : '↺';
    document.getElementById('go-title').innerText = victory ? (completedId === CAMPAIGN.length ? '充电帝国，建成！' : '经营目标达成') : missedGoal ? '离目标还差一点' : '资金链断裂';
    document.getElementById('go-desc').innerText = victory ? `${state.levelName}完成，最终资金 $${state.money.toFixed(0)}。${currentLevel && completedId < CAMPAIGN.length ? '下一关已解锁。' : '继续挑战更好的经营成绩。'}` : missedGoal ? `已完成 ${state.targetDays} 天经营，但还未达成「${mission.objective}」。调整投资节奏，再试一次。` : '提前预留租金，优先提高充电桩利用率，再逐步扩建。';
    document.getElementById('final-days').innerText = Math.max(0, state.day - 1);
    document.getElementById('btn-continue').classList.toggle('hidden', !victory);
    const next = document.getElementById('btn-next-level');
    next.classList.toggle('hidden', !victory || !currentLevel || completedId >= CAMPAIGN.length);
    next.onclick = () => { closeModal('game-over-modal'); startLevelGame(completedId + 1); };
    try { localStorage.removeItem('ev_tycoon_save_v2'); } catch (_) {}
    openModal('game-over-modal');
}


function processEnergy(gridPrice) {
    const result = dispatchEnergy(state, CONFIG, gridPrice);
    const profit = result.revenue - result.cost;
    state.money += profit; state.currentDayProfit += profit;
    state.totalRevenue = (state.totalRevenue || 0) + result.revenue;
    state.totalEnergy = (state.totalEnergy || 0) + result.delivered;
    state.lastTickData = result;
    // 每十分钟刷新一次资金变化；没有车辆充电、也没有购电时不闪 0 元，避免刷屏。
    if (Math.abs(profit) > 0.005) showMoneyChange(profit, '充电净收');
}


function scheduleNextEvent() {
    const offset = 2 + Math.floor(Math.random() * 4); 
    const hour = 9 + Math.floor(Math.random() * 9); 
    state.nextEventTime = { day: state.day + offset, hour: hour };
}

const EVENTS = {
    instant: [
        { t: "政府补贴", d: "新能源基建补助到账。", amt: 500, type: 'money' },
        { t: "设备过热", d: "几个模块烧坏了，需紧急维修。", amt: -300, type: 'money' },
        { t: "网红打卡", d: "某车评人来这充电，瞬间引流。", amt: 400, type: 'money' },
        { t: "偷电贼", d: "有人私接电线偷电被抓，罚款。", amt: -150, type: 'money' },
        { t: "环保罚单", d: "电池废液处理不当，环保局找上门。", amt: -500, type: 'money' },
        { t: "彩票中奖", d: "你在休息室捡到的彩票中了二等奖！", amt: 800, type: 'money' },
        { t: "设备老化", d: "部分设备老化严重，需要更换零件。", amt: -250, type: 'money' },
        { t: "客户打赏", d: "土豪车主觉得你服务不错，给了小费。", amt: 100, type: 'money' },
        { t: "保险理赔", d: "上次雷击损坏的设备，保险公司赔付了。", amt: 600, type: 'money' },
        { t: "员工培训", d: "组织员工参加专业培训，提升服务质量。", amt: -200, type: 'money' },
        { t: "银行利息", d: "账户余额产生的利息到账。", amt: 150, type: 'money' },
        { t: "设备被盗", d: "有人夜间偷走了部分充电设备。", amt: -400, type: 'money' },
        { t: "政府奖励", d: "被评为绿色能源示范站点，获得奖励。", amt: 700, type: 'money' },
        { t: "维修事故", d: "维修过程中发生意外，需要额外赔偿。", amt: -350, type: 'money' },
        { t: "广告收入", d: "在充电桩上投放广告获得收入。", amt: 300, type: 'money' },
        { t: "税务抽查", d: "税务部门抽查发现漏税问题，补缴税款。", amt: -450, type: 'money' },
        { t: "节能补贴", d: "使用节能设备获得额外补贴。", amt: 250, type: 'money' },
        { t: "客户投诉", d: "服务态度问题导致客户投诉，赔偿损失。", amt: -180, type: 'money' },
        { t: "技术升级", d: "系统技术升级，提升充电效率。", amt: -320, type: 'money' },
        { t: "合作推广", d: "与附近商家合作推广，获得推广费。", amt: 350, type: 'money' }
    ],
    longTerm: [
        { t: "台风过境", d: "台风'皮卡丘'来袭！暴雨不断，光伏发电基本报废。", type: 'forcedWeather', val: 'rainy', icon: '⛈️' },
        { t: "原材料暴跌", d: "国际铜价崩盘！电网电价打8折。", type: 'gridDiscount', val: 0.8, icon: '📉' },
        { t: "城市马拉松", d: "全城封路跑马拉松。客流减半。", type: 'trafficMult', val: 0.5, icon: '🏃' },
        { t: "高温预警", d: "连日高温，大家都不想出门。但光伏效率爆表(120%)！", type: 'multiBuff', buffs: [ { type: 'forcedWeather', val: 'sunny' }, { type: 'solarEfficiency', val: 1.2 } ], icon: '🥵' },
        { t: "油价暴涨", d: "国际油价起飞，开油车的都哭了。客流 +50%。", type: 'trafficMult', val: 1.5, icon: '⛽' },
        { t: "电池技术突破", d: "宁王发布新电池，储能设备采购打7折！", type: 'assetDiscount', target: 'battery', val: 0.7, icon: '🔋' },
        { t: "光伏产能过剩", d: "组件厂清库存，光伏板采购打7折！", type: 'assetDiscount', target: 'solar', val: 0.7, icon: '📉' },
        { t: "基建狂魔", d: "工程队大促销，充电桩和变压器安装费8折！", type: 'assetDiscount', target: 'infra', val: 0.8, icon: '🏗️' },
        { t: "极寒天气", d: "寒潮来袭！电池效率下降30%，但电网需求激增电价上涨。", type: 'multiBuff', buffs: [ { type: 'batteryEfficiency', val: 0.7 }, { type: 'gridPriceMult', val: 1.4 } ], icon: '❄️' },
        { t: "充电联盟", d: "加入城市充电联盟，客流增加但需支付联盟费用。", type: 'multiBuff', buffs: [ { type: 'trafficMult', val: 1.4 }, { type: 'dailyCostMult', val: 1.2 } ], icon: '🤝' },
        { t: "技术革新", d: "新技术让充电速度提升20%，但设备维护成本增加。", type: 'multiBuff', buffs: [ { type: 'chargeSpeedMult', val: 1.2 }, { type: 'dailyCostMult', val: 1.15 } ], icon: '⚡' },
        { t: "政策补贴", d: "政府推出新能源补贴政策，电价打7折。", type: 'gridDiscount', val: 0.7, icon: '🏛️' },
        { t: "用电高峰", d: "夏季用电高峰期，电网价格飙升50%。", type: 'gridPriceMult', val: 1.5, icon: '📈' },
        { t: "设备升级", d: "智能化升级完成，设备效率提升但维护成本增加。", type: 'multiBuff', buffs: [ { type: 'solarEfficiency', val: 1.3 }, { type: 'batteryEfficiency', val: 1.2 }, { type: 'dailyCostMult', val: 1.25 } ], icon: '🤖' },
        { t: "市场竞争", d: "附近新开充电站，客流减少25%。", type: 'trafficMult', val: 0.75, icon: '⚔️' },
        { t: "能源危机", d: "国际能源危机，所有能源价格上涨。", type: 'multiBuff', buffs: [ { type: 'gridPriceMult', val: 1.6 }, { type: 'dailyCostMult', val: 1.3 } ], icon: '🛢️' },
        { t: "绿色认证", d: "获得环保认证，设备采购享受折扣。", type: 'assetDiscount', target: 'all', val: 0.85, icon: '🌱' },
        { t: "智能化浪潮", d: "AI技术普及，智能化设备成本大幅下降。", type: 'assetDiscount', target: 'infra', val: 0.6, icon: '🧠' },
        { t: "经济衰退", d: "经济不景气，客流减少但运营成本下降。", type: 'multiBuff', buffs: [ { type: 'trafficMult', val: 0.7 }, { type: 'dailyCostMult', val: 0.8 } ], icon: '📉' },
        { t: "充电热潮", d: "电动车销量暴增，客流增加40%。", type: 'trafficMult', val: 1.4, icon: '🚗' },
        { t: "维护困难", d: "专业技术人员短缺，维护成本大幅上升。", type: 'dailyCostMult', val: 1.5, icon: '🔧' },
        { t: "创新补贴", d: "创新技术获得政府补贴，研发成本降低。", type: 'assetDiscount', target: 'battery', val: 0.5, icon: '💡' }
    ]
};

function triggerRandomEvent() {
    const hasActiveLongTerm = state.activeBuffs.some(b => b.isEventLongTerm);
    const isLongTerm = !hasActiveLongTerm && Math.random() < 0.4;
    let ev;
    let duration = 0;

    if (isLongTerm) {
        ev = EVENTS.longTerm[Math.floor(Math.random() * EVENTS.longTerm.length)];
        duration = 2 + Math.floor(Math.random() * 6);
        if (ev.type === 'multiBuff') {
            ev.buffs.forEach(subBuff => {
                state.activeBuffs.push({ name: ev.t, type: subBuff.type, val: subBuff.val, daysLeft: duration, icon: ev.icon, isEventLongTerm: true });
            });
        } else {
            state.activeBuffs.push({ name: ev.t, type: ev.type, val: ev.val, daysLeft: duration, icon: ev.icon, isEventLongTerm: true, target: ev.target });
        }
        document.getElementById('ev-amt').innerText = `持续 ${duration} 天`;
        document.getElementById('ev-amt').className = "font-bold text-blue-600";
    } else {
        let candidateEvents = EVENTS.instant;
        const currentRent = calcWeeklyRent(); 
        
        if (state.money < currentRent) {
            candidateEvents = candidateEvents.filter(e => e.amt > 0);
        } else if (state.money < currentRent * 1.5) {
            const goodEvents = candidateEvents.filter(e => e.amt > 0);
            candidateEvents = [...candidateEvents, ...goodEvents, ...goodEvents];
        }

        ev = candidateEvents[Math.floor(Math.random() * candidateEvents.length)];
        
        let inflation = 0;
        if (ev.amt !== 0) { inflation = (ev.amt > 0 ? 1 : -1) * state.day * 5; }
        let amount = ev.amt + inflation;
        
        state.money += amount;
        showMoneyChange(amount, ev.t);
        document.getElementById('ev-amt').innerText = (amount >= 0 ? "+" : "−") + `$${Math.abs(amount)}`;
        document.getElementById('ev-amt').className = amount > 0 ? "font-bold font-mono text-lg cash-positive" : "font-bold font-mono text-lg cash-negative";
    }

    document.getElementById('ev-icon').innerText = isLongTerm ? ev.icon : (ev.amt > 0 ? '💰' : '💸');
    document.getElementById('ev-title').innerText = ev.t;
    document.getElementById('ev-desc').innerText = ev.d;
    openModal('event-modal');
    updateUI(); 
    state.pendingEvent = { title: ev.t, description: ev.d, icon: document.getElementById('ev-icon').innerText, amount: document.getElementById('ev-amt').innerText };
    scheduleNextEvent(); saveGame(true);
}

function dailySettle() {
    state.day++;
    state.weather = state.forecast;
    const forcedWeather = state.activeBuffs.find(b => b.type === 'forcedWeather');
    if (forcedWeather) state.weather = forcedWeather.val;
    state.forecast = rollWeather();

    state.activeBuffs.forEach(b => b.daysLeft--);
    state.activeBuffs = state.activeBuffs.filter(b => b.daysLeft > 0);

    const dailyCost = calcDailyCost();
    state.money -= dailyCost;
    let loanPaid = 0;
    spawnFloatText(`日维护 -$${dailyCost}`, LOSS);
    
        if (state.loan.active) {
        const payment = loanPayment(state.loan, LOAN_DAILY_RATE);
        state.money -= payment.amount;
        loanPaid = payment.amount;
        state.loan.principal = Math.round(Math.max(0, state.loan.principal - payment.principal) * 100) / 100;
        state.loan.daysLeft--;
        spawnFloatText(`还贷 -$${payment.amount.toFixed(2)}`, LOSS);
        if (state.loan.daysLeft <= 0 || state.loan.principal <= 0.001) {
            state.loan.active = false; state.loan.principal = 0;
            spawnFloatText('贷款结清', '#49735b');
        }
    }

    state.lastDayProfit = state.currentDayProfit - dailyCost - loanPaid;
    state.history = state.history || [];
    state.history.push({ day: state.day - 1, profit: state.lastDayProfit });
    state.history = state.history.slice(-30);
    state.currentDayProfit = 0;

    state.chartData.yesterdayLoad = [...state.chartData.load];
    state.chartData.load.fill(null);
    state.chartData.solar.fill(null);
    state.chartData.battery.fill(null);
    if (state.chartData.demand) state.chartData.demand.fill(null);
    
    if(myChart) {
        const blanks = { yesterdayLoad: state.chartData.yesterdayLoad, solar: [], battery: [], load: [], demand: [] };
        myChart.setOption({ series: energySeries().map(s => ({ id: s.key, data: blanks[s.key] })) });
    }

    let rentInterval = 7;
    if (state.settings.mode === 'shark') rentInterval = 3;

    if (state.day > 1 && (state.day - 1) % rentInterval === 0) {
        const rent = calcWeeklyRent();
        state.pendingRent = rent;
        showBillModal();
    }
}

function rollWeather() {
    const r = Math.random();
    let cumulativeProb = 0;
    for (let i = 0; i < CONFIG.weather.types.length; i++) {
        cumulativeProb += CONFIG.weather.probs[i];
        if (r < cumulativeProb) return CONFIG.weather.types[i];
    }
    return CONFIG.weather.types[0];
}

function calcDailyCost() {
    let cost = 0;
    cost += state.assets.slowCharger * CONFIG.dailyCost.slowCharger;
    cost += state.assets.fastCharger * CONFIG.dailyCost.fastCharger;
    cost += state.assets.solar * CONFIG.dailyCost.solar;
    cost += state.assets.battery * CONFIG.dailyCost.battery;
    cost += state.assets.transformer * CONFIG.dailyCost.transformer;
    const dailyCostMultBuff = state.activeBuffs.find(b => b.type === 'dailyCostMult');
    if (dailyCostMultBuff) cost *= dailyCostMultBuff.val;
    return cost;
}

function calcWeeklyRent() {
    const mission = currentMission();
    if (mission) return mission.rent + state.weeksSurvived * mission.rentGrowth;
    let base = CONFIG.baseWeeklyRent; 
    let growth = CONFIG.rentGrowth;
    if (state.settings.mode === 'offgrid' || state.settings.mode === 'powerlimit') { base = 650; growth = 130; }
    if (state.settings.mode === 'luxury') { base = 3000; growth = 700; }
    if (state.settings.mode === 'inflation') return Math.floor(base * Math.pow(1.3, state.weeksSurvived));
    if (state.settings.mode === 'shark') { base = 1700; growth = 250; }
    return base + (state.weeksSurvived * growth);
}

function dailyTrafficDemand() {
    let demand = state.dailyTraffic || CONFIG.baseDailyTraffic;
    if (state.weather === 'rainy') demand *= 0.9;
    if (state.settings.mode === 'ghost') demand *= 0.5;
    if (['jam', 'luxury'].includes(state.settings.mode)) demand *= 2;
    const buff = state.activeBuffs.find(b => b.type === 'trafficMult');
    if (buff) demand *= buff.val;
    return demand;
}
// 客流只是期望值，没有每日上限：想接住更多车只能扩建桩位与配电。
function trySpawnCar(hour) {
    const loc = LOC_CONFIG[state.settings.loc];
    const shape = loc.traffic[hour] / loc.avgTraffic;
    const expected = dailyTrafficDemand() * shape / 144;
    let arrivals = Math.floor(expected);
    if (Math.random() < expected - arrivals) arrivals++;
    for (let i = 0; i < arrivals; i++) attemptSingleSpawn();
}

function attemptSingleSpawn() {
    const myPrice = state.price;
    let acceptChance = 1.0;
    if (myPrice > 2.0) {
        const excess = myPrice - 2.0;
        acceptChance = 0.2 / (excess * 2 + 1); 
    } else {
        if (myPrice <= 1.2) acceptChance = 1.0;
        else { const t = (myPrice - 1.2) / 0.8; acceptChance = 1.0 - (t * 0.7); }
    }
    if (state.settings.mode === 'luxury') acceptChance = Math.min(1.0, acceptChance * 1.3); 

    if (Math.random() > acceptChance) return; 

    const wantFast = Math.random() < 0.3; 
    let spawnType = null;
    let slot = -1;

    if (state.settings.mode === 'super') {
        slot = findFreeSlot('fast');
        if (slot !== -1) spawnType = 'fast';
    } else {
        if (wantFast) {
            slot = findFreeSlot('fast');
            if (slot !== -1) spawnType = 'fast';
            else if (Math.random() < 0.5) { 
                slot = findFreeSlot('slow');
                if (slot !== -1) spawnType = 'slow';
            }
        } else {
            slot = findFreeSlot('slow');
            if (slot !== -1) {
                spawnType = 'slow';
            } else if (findFreeSlot('fast') !== -1) {
                slot = findFreeSlot('fast');
                spawnType = 'fast'; 
            }
        }
    }

    if (spawnType && slot !== -1) {
        const emoji = CONFIG.carEmojis[Math.floor(Math.random() * CONFIG.carEmojis.length)];
        const vehicle = createVehicle(emoji);
        const power = Math.min(CONFIG.chargerPower[spawnType], spawnType === 'slow' ? vehicle.maxAcKw : vehicle.maxDcKw);
        const idealTicks = Math.ceil((vehicle.kwhNeeded / power) * 6);
        const patience = Math.ceil(idealTicks * 1.5);
        state.cars.push({ ...vehicle, type: spawnType, slot, ticksLeft: patience, priceLocked: state.price });
    }
}

function findFreeSlot(type) {
    const limit = state.assets[type + 'Charger'];
    for(let i=0; i<limit; i++) {
        if (!state.cars.some(c => c.type === type && c.slot === i)) return i;
    }
    return -1;
}

function getAssetCost(type) {
    let cost = state.currentCosts[type];
    const discount = state.activeBuffs.find(b => b.type === 'assetDiscount' && b.target === type);
    if (discount) cost *= discount.val;
    if (['slowCharger', 'fastCharger', 'transformer'].includes(type)) {
        const infraDiscount = state.activeBuffs.find(b => b.type === 'assetDiscount' && b.target === 'infra');
        if (infraDiscount) cost *= infraDiscount.val;
    }
    const allDiscount = state.activeBuffs.find(b => b.type === 'assetDiscount' && b.target === 'all');
    if (allDiscount) cost *= allDiscount.val;
    return Math.floor(cost);
}

function buyAsset(type) {
    if (!Object.hasOwn(CONFIG.baseCosts, type) || purchaseRestriction(type)) return;
    const cost = getAssetCost(type);
    if (type === 'slowCharger' && state.settings.mode === 'super') { spawnFloatText("模式限制: 禁止慢充", "#ef4444"); return; }
    if (state.money >= cost) {
        state.money -= cost;
        state.assets[type]++; spawnFloatText(`购买 -$${cost}`, LOSS);
        state.currentCosts[type] = Math.floor(state.currentCosts[type] * CONFIG.inflationRate);
        refreshChartSeries(); updateUI(); resizeCanvas(); saveGame(true);
    } else {
        spawnFloatText("资金不足", "#ef4444");
    }
}

function spawnFloatText(txt, col) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.innerText = txt;
    el.style.color = col;
    el.style.left = '50%';
    el.style.top = '42%';
    const feedback = document.getElementById('fx-container');
    if (feedback.children.length >= 3) feedback.firstElementChild.remove();
    feedback.appendChild(el);
    const match = txt.match(/([+−-])\$(\d+(?:\.\d+)?)/);
    if (match) showMoneyChange((match[1] === '+' ? 1 : -1) * Number(match[2]), txt.split(' ')[0]);
    setTimeout(()=>el.remove(), 1200);
}

function showMoneyChange(amount, reason) {
    const el = document.getElementById('ui-tick-profit');
    if (!el) return;
    const shown = Math.abs(amount) >= 1000 ? compactMoney(amount) : Math.abs(amount).toFixed(1);
    el.textContent = `${amount < 0 ? '−' : '+'}$${shown}`;
    el.title = `${reason}：${el.textContent}`;
    el.className = amount < 0 ? 'cash-negative' : 'cash-positive';
    el.classList.remove('cash-flash'); void el.offsetWidth; el.classList.add('cash-flash');
}

function updateUI() {
    refreshPriceWheel(); refreshChartSeries(); updateSpeedButton();
    document.querySelector('.money-card').classList.toggle('wealthy',state.money>=100000&&state.money<1000000);
    document.getElementById('ui-money').innerText = state.money >= 1000000 ? `$${(state.money / 1000000).toFixed(1)}M` : `$${state.money.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    const dCost = calcDailyCost();
    document.getElementById('ui-daily-cost').innerText = `-$${compactMoney(dCost)}`;
    const wRent = calcWeeklyRent();
    document.getElementById('ui-weekly-rent').innerText = `-$${compactMoney(wRent)}`;
    
// 更新贷款卡片
    const loanCard = document.getElementById('card-loan-status');
    const loanPaymentEl = document.getElementById('ui-loan-payment');
    
    if (state.loan.active) {
        loanCard.className = "repayment-active";
        
        const nextPayment = loanPayment(state.loan, LOAN_DAILY_RATE).amount;
        loanPaymentEl.innerText = `-$${compactMoney(nextPayment)}`;
    } else {
        loanCard.className = "repayment-idle";
        loanPaymentEl.innerText = "--";
    }

    const daysLeft = 8 - ((state.day - 1) % 7 + 1);
    let rentLabel = '周租';
    if(state.settings.mode === 'shark') {
        const sharkDaysLeft = 4 - ((state.day - 1) % 3 + 1);
        document.getElementById('ui-rent-countdown').innerText = sharkDaysLeft === 1 ? '明日' : `${sharkDaysLeft}d`;
        rentLabel = '高频租金';
    } else {
        document.getElementById('ui-rent-countdown').innerText = daysLeft === 1 ? '明日' : `${daysLeft}d`;
    }
    // Update label text logic if needed, currently fixed in HTML structure or controlled here
    
    const transformerLabel = document.getElementById('transformer-sub');
    if (state.settings.mode === 'powerlimit') transformerLabel.innerText = '+10kW';
    else transformerLabel.innerText = '+20kW';

    const lastProfitEl = document.getElementById('ui-last-profit');
    if (state.lastDayProfit !== null) {
        const sign = state.lastDayProfit >= 0 ? '+' : '−';
        const color = state.lastDayProfit >= 0 ? 'cash-positive' : 'cash-negative';
        lastProfitEl.innerHTML = `<span class="${color}">${sign}$${compactMoney(state.lastDayProfit)}</span>`;
    } else {
        lastProfitEl.innerText = "--";
    }

    const h = state.hour.toString().padStart(2,'0');
    const m = state.minute.toString().padStart(2,'0');
    document.getElementById('ui-clock').innerText = `${h}:${m}`;
    document.getElementById('ui-day').innerText = `D${state.day}`;

    const w = state.weather;
    document.getElementById('ui-weather-icon').innerText = CONFIG.weather.icons[w];
    document.getElementById('ui-weather-name').innerText = CONFIG.weather.names[w] || '';
    let eff = CONFIG.weather.eff[w] * 100;
    
    const forced = state.activeBuffs.find(b => b.type === 'forcedWeather');
    const boosted = state.activeBuffs.find(b => b.type === 'solarEfficiency');
    if (boosted) eff *= boosted.val;

    document.getElementById('ui-weather-eff').innerText = `PV:${eff.toFixed(0)}%${forced ? '(锁)' : ''}`;
    // 光伏效率也按涨跌色：效率高＝涨＝红，阴雨低效＝跌＝绿。
    const effColor = boosted ? 'cash-positive font-black' : eff >= 60 ? 'cash-positive' : 'cash-negative';
    document.getElementById('ui-weather-eff').className = `text-[8px] font-bold ${effColor} whitespace-nowrap`;

    let forecastW = state.forecast;
    if (forced && forced.daysLeft > 1) forecastW = forced.val;
    const fIcon = CONFIG.weather.icons[forecastW];
    document.getElementById('ui-forecast').innerText = `明:${fIcon}`;

    let gp = CITY_CONFIG[state.settings.city].prices[state.hour] || 0;
    if (state.settings.mode === 'collapse') { if (state.hour >= 6 && state.hour < 18) gp = 10.0; else gp = 0.2; }
    if (state.settings.mode === 'offgrid') gp = 0; 
    const discountBuff = state.activeBuffs.find(b => b.type === 'gridDiscount');
    if (discountBuff) gp *= discountBuff.val;
    const gpMult = state.activeBuffs.find(b => b.type === 'gridPriceMult');
    if (gpMult) gp *= gpMult.val;

    const gpEl = document.getElementById('ui-grid-price');
    gpEl.innerText = state.settings.mode === 'offgrid' ? '离网' : `$${gp.toFixed(2)}`;
    gpEl.className = `font-mono font-bold text-lg ${gp>=1.5 ? 'text-red-500' : 'text-slate-700'}`;
    // 每度毛利＝售价 − 成本电价；车旁跳出的金额就是它乘以这一回合送出的度数。
    const marginEl = document.getElementById('ui-margin-rate');
    if (marginEl) {
        const rate = state.price - (state.settings.mode === 'offgrid' ? 0 : gp);
        marginEl.innerText = `${rate >= 0 ? '+' : '−'}$${Math.abs(rate).toFixed(2)}`;
        marginEl.className = rate >= 0 ? 'cash-positive' : 'cash-negative';
    }

    const d = state.lastTickData;

    // 读数行同样只显示已经拥有的项目。
    document.querySelector('.solar-reading').classList.toggle('hidden', state.assets.solar === 0);
    document.querySelector('.battery-reading').classList.toggle('hidden', state.assets.battery === 0);

    document.getElementById('count-slow').innerText = state.assets.slowCharger;
    document.getElementById('count-fast').innerText = state.assets.fastCharger;
    document.getElementById('count-solar').innerText = state.assets.solar;
    document.getElementById('count-battery').innerText = state.assets.battery;
    document.getElementById('count-transformer').innerText = state.assets.transformer;
    
    const updateCostDisplay = (type, elId) => {
        const raw = state.currentCosts[type];
        const actual = getAssetCost(type);
        const el = document.getElementById(elId);
        if (actual < raw) {
            el.innerHTML = `<span class="opacity-50 line-through text-[8px] mr-1">$${raw}</span><span>$${actual}</span>`;
        } else {
            el.innerText = `$${raw}`;
        }
    };

    updateCostDisplay('slowCharger', 'cost-slow');
    updateCostDisplay('fastCharger', 'cost-fast');
    updateCostDisplay('transformer', 'cost-transformer');
    updateCostDisplay('solar', 'cost-solar');
    updateCostDisplay('battery', 'cost-battery');

    const buffBar = document.getElementById('ui-buff-bar');
    if (state.activeBuffs.length > 0) {
        buffBar.classList.remove('hidden');
        const uniqueBuffs = [];
        const seen = new Set();
        state.activeBuffs.forEach(b => {
            if(!seen.has(b.name)) { uniqueBuffs.push(b); seen.add(b.name); }
        });
        buffBar.innerHTML = uniqueBuffs.map(b => `
            <div class="flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                <span class="text-xs">${b.icon}</span>
                <span class="text-[9px] font-bold text-indigo-700">${b.name} ${b.daysLeft}d</span>
            </div>
        `).join('');
    } else {
        buffBar.classList.add('hidden');
    }

    updateDashboard();
    requestStationFrame();
}

function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper || wrapper.clientWidth === 0 || wrapper.clientHeight === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = wrapper.clientWidth;
    canvasHeight = wrapper.clientHeight;
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (myChart) myChart.resize();
    draw();
}
window.addEventListener('resize', resizeCanvas);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(document.getElementById('canvas-wrapper'));
let stationFrame = null;
let lastStationFrame = 0;
function requestStationFrame() {
    if (stationFrame === null && typeof requestAnimationFrame === 'function' && !document.getElementById('game-main-container').classList.contains('hidden')) stationFrame = requestAnimationFrame(animateStation);
}
function animateStation(stamp) {
    stationFrame = null;
    if (document.getElementById('game-main-container').classList.contains('hidden')) return;
    if (stamp - lastStationFrame >= 32 || state.paused) { draw(); lastStationFrame = stamp; }
    if (!state.paused && !state.ended && !document.hidden && !StationArt.reducedMotion()) requestStationFrame();
}
function draw() {
    if (!canvasWidth || !canvasHeight) return;
    StationArt.draw(ctx, canvasWidth, canvasHeight, state);
}


function closeEventModal() {
    closeModal('event-modal');
    state.pendingEvent = null;
    if (checkEndGame()) return;
    resumeAfterModal();
    saveGame(true);
}


function showBillModal() {
    const balance = state.money;
    const rent = state.pendingRent;
    const final = balance - rent;

    document.getElementById('bill-balance').innerText = `$${balance.toFixed(2)}`;
    document.getElementById('bill-rent').innerText = `-$${rent.toFixed(2)}`;
    document.getElementById('bill-final').innerText = `$${final.toFixed(2)}`;
    
    const finalEl = document.getElementById('bill-final');
    finalEl.className = final < 0 ? "font-mono font-bold cash-negative" : "font-mono font-bold cash-positive";

    openModal('bill-modal'); 
}

function payBill() {
    const rent = state.pendingRent;
    state.money -= rent;
    spawnFloatText(`租金 -$${rent}`, LOSS);
    if (state.lastDayProfit !== null) state.lastDayProfit -= rent;
    if (state.history?.length) state.history[state.history.length - 1].profit -= rent;
    state.pendingRent = 0; state.weeksSurvived++;
    closeModal('bill-modal');
    if (checkEndGame()) return;
    resumeAfterModal(); updateUI(); saveGame(true);
}


// 资金卡下方的小字账本用紧凑写法：1234 → 1.2k，211000 → 211k。
function compactMoney(value) {
    const a = Math.abs(value);
    if (a >= 100000) return `${Math.round(a / 1000)}k`;
    if (a >= 1000) return `${(a / 1000).toFixed(1)}k`;
    return `${Math.round(a)}`;
}

const PRICE_MIN = 0.5, PRICE_MAX = 3, PRICE_STEP = 0.1;
const PRICE_VALUES = (() => {
    const out = [];
    for (let v = PRICE_MIN; v <= PRICE_MAX + 1e-9; v = Math.round((v + PRICE_STEP) * 10) / 10) out.push(v);
    return out;
})();
function priceIndexOf(value) {
    let best = 0, gap = Infinity;
    PRICE_VALUES.forEach((v, i) => { const d = Math.abs(v - value); if (d < gap) { gap = d; best = i; } });
    return best;
}
function priceRowHeight() {
    const wheel = document.getElementById('price-wheel');
    const raw = wheel ? parseFloat(getComputedStyle(wheel).getPropertyValue('--row')) : 13;
    return Number.isFinite(raw) && raw > 4 ? raw : 13;
}
// 窗口里露出几行（由 CSS 高度决定），居中偏移与淡出曲线都按它算。
function priceWindowRows() {
    const wheel = document.getElementById('price-wheel');
    const row = priceRowHeight();
    const height = wheel ? wheel.clientHeight : row * 5;
    const rows = Math.round(height / row);
    return Number.isFinite(rows) && rows > 0 ? rows : 5;
}
function wheelOffsetFor(index) { return (priceWindowRows() / 2 - index - 0.5) * priceRowHeight(); }
function wheelIndexForOffset(offset) { return Math.round(priceWindowRows() / 2 - 0.5 - offset / priceRowHeight()); }
function prefersReducedMotion() { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }

let wheelIndex = 0, wheelDragging = false;
// 连续取值列：按偏移量把整列滑动到窗口里，越靠边越淡越小，中间一格高亮。
function paintWheel(offsetPx) {
    const list = document.getElementById('price-list');
    if (!list) return;
    const row = priceRowHeight(), centre = priceWindowRows() / 2;
    list.style.transform = `translateY(${offsetPx.toFixed(2)}px)`;
    const items = list.children;
    for (let i = 0; i < items.length; i++) {
        const distance = Math.abs(i + 0.5 + offsetPx / row - centre);
        const el = items[i];
        el.style.opacity = String(Math.max(0, Math.min(1, 1 - distance * 0.42)));
        el.style.transform = `scale(${Math.max(0.74, 1 - distance * 0.13).toFixed(3)})`;
        el.classList.toggle('is-current', distance < 0.5);
    }
}
function snapWheelTo(index, animate = false) {
    wheelIndex = Math.max(0, Math.min(PRICE_VALUES.length - 1, index));
    const list = document.getElementById('price-list');
    if (!list) return;
    list.style.transition = animate && !prefersReducedMotion() ? 'transform .2s cubic-bezier(.22,.9,.3,1)' : 'none';
    paintWheel(wheelOffsetFor(wheelIndex));
}
function refreshPriceWheel() {
    const wheel = document.getElementById('price-wheel');
    if (!wheel) return;
    const display = document.getElementById('price-display');
    if (display) display.textContent = `$${state.price.toFixed(2)}`;
    wheel.setAttribute('aria-valuenow', state.price.toFixed(1));
    wheel.setAttribute('aria-valuetext', `$${state.price.toFixed(2)}`);
    const target = priceIndexOf(state.price);
    if (!wheelDragging && target !== wheelIndex) snapWheelTo(target, true);
}
function updatePrice(v) {
    const next = Math.round(Math.max(PRICE_MIN, Math.min(PRICE_MAX, Number(v) || 1.5)) * 10) / 10;
    if (next === state.price) { refreshPriceWheel(); return; }
    state.price = next;
    refreshPriceWheel();
    updateUI(); saveGame(true);
}
function adjustPrice(delta) { updatePrice(state.price + delta); }

// 轮盘交互：拖动（带惯性吸附）、滚轮、上下键，点某一格也直接选中。
function initPriceWheel() {
    const wheel = document.getElementById('price-wheel'), list = document.getElementById('price-list');
    if (!wheel || !list) return;
    if (!list.children.length) {
        PRICE_VALUES.forEach(v => {
            const el = document.createElement('span');
            el.className = 'wheel-item';
            el.textContent = `$${v.toFixed(2)}`;
            list.appendChild(el);
        });
    }
    snapWheelTo(priceIndexOf(state.price), false);
    let startY = 0, startOffset = 0, lastY = 0, lastT = 0, velocity = 0;
    const offsetFor = index => wheelOffsetFor(index);
    const commit = (index, animate = true) => {
        index = Math.max(0, Math.min(PRICE_VALUES.length - 1, index));
        snapWheelTo(index, animate);
        const value = PRICE_VALUES[index];
        if (value !== state.price) { state.price = value; updateUI(); saveGame(true); }
        else refreshPriceWheel();
    };
    wheel.addEventListener('pointerdown', e => {
        wheelDragging = true;
        startY = lastY = e.clientY; startOffset = offsetFor(wheelIndex);
        lastT = performance.now(); velocity = 0;
        list.style.transition = 'none';
        wheel.setPointerCapture?.(e.pointerId);
    });
    wheel.addEventListener('pointermove', e => {
        if (!wheelDragging) return;
        const now = performance.now();
        velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
        lastY = e.clientY; lastT = now;
        const offset = startOffset + (e.clientY - startY);
        paintWheel(offset);
        const index = wheelIndexForOffset(offset);
        if (index !== wheelIndex && index >= 0 && index < PRICE_VALUES.length) {
            wheelIndex = index;
            state.price = PRICE_VALUES[index];
            const display = document.getElementById('price-display');
            if (display) display.textContent = `$${state.price.toFixed(2)}`;
            wheel.setAttribute('aria-valuenow', state.price.toFixed(1));
            wheel.setAttribute('aria-valuetext', `$${state.price.toFixed(2)}`);
            updateUI();
        }
    });
    const finish = e => {
        if (!wheelDragging) return;
        wheelDragging = false;
        wheel.releasePointerCapture?.(e.pointerId);
        const row = priceRowHeight();
        const dragged = startOffset + (e.clientY - startY);
        if (Math.abs(e.clientY - startY) < 5) {
            // 直接点某一格：选中手指底下那一格，而不是按位移内容。
            const rect = wheel.getBoundingClientRect();
            const rows = Math.round((e.clientY - (rect.top + rect.height / 2)) / row);
            commit(wheelIndex + rows);
        } else {
            // 拖动松手后按速度多滑一点，再吸附到最近一格。
            commit(wheelIndexForOffset(dragged + velocity * 140));
        }
        wheel.focus({ preventScroll: true });
    };
    wheel.addEventListener('pointerup', finish);
    wheel.addEventListener('pointercancel', finish);
    wheel.addEventListener('wheel', e => {
        if (!e.deltaY) return;
        e.preventDefault();
        commit(priceIndexOf(state.price) + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
    wheel.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp') { e.preventDefault(); commit(priceIndexOf(state.price) + 1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); commit(priceIndexOf(state.price) - 1); }
    });
}

// 顶栏那个按钮循环切换 1× → 4× → 8× → 暂停，只显示图标。
const SPEED_ORDER = [500, 125, 62.5, 0], SPEED_TRIANGLES = [1, 2, 3, 0];
function speedIconSVG(triangles) {
    if (!triangles) return '<rect x="5" y="2.4" width="3.6" height="11.2" rx="1.2"></rect><rect x="11.4" y="2.4" width="3.6" height="11.2" rx="1.2"></rect>';
    const w = triangles === 1 ? 6.4 : triangles === 2 ? 5.2 : 4.2, gap = triangles === 3 ? 0.9 : 1.2;
    const total = triangles * w + (triangles - 1) * gap, x0 = (20 - total) / 2;
    let out = '';
    for (let i = 0; i < triangles; i++) { const x = x0 + i * (w + gap); out += `<path d="M${x.toFixed(1)} 2.6 L${(x + w - 1).toFixed(1)} 8 L${x.toFixed(1)} 13.4 Z"></path>`; }
    return out;
}
function currentSpeedStep() {
    if (state.paused) return 3;
    return state.gameSpeed === 500 ? 0 : state.gameSpeed === 125 ? 1 : 2;
}
let speedIconKey = '';
function updateSpeedButton() {
    const btn = document.getElementById('speed-toggle');
    if (!btn) return;
    const step = currentSpeedStep();
    if (String(step) !== speedIconKey) {
        speedIconKey = String(step);
        btn.innerHTML = `<svg viewBox="0 0 20 16" aria-hidden="true">${speedIconSVG(SPEED_TRIANGLES[step])}</svg>`;
        btn.classList.toggle('paused', step === 3);
    }
    btn.setAttribute('aria-label', `游戏速度：${['1 倍', '4 倍', '8 倍', '已暂停'][step]}，点击切换`);
}
function cycleSpeed() {
    setSpeed(SPEED_ORDER[(currentSpeedStep() + 1) % SPEED_ORDER.length]);
}

function setSpeed(ms) {
    clearTimeout(state.timer);
    if (ms === 0) state.paused = true;
    else {
        state.gameSpeed = ms; state.lastGameSpeed = ms;
        state.paused = modalOpenCount > 0 || !!state.ended;
        if (!state.paused) state.timer = setTimeout(tick, ms);
    }
    updateUI(); saveGame(true);
}


// 加载已解锁的关卡
function loadUnlockedLevels() {
    const saved=readStorage('ev_tycoon_unlocked_levels_v3',null);
    if(Array.isArray(saved))unlockedLevels=[...new Set([1,...saved.filter(n=>Number.isInteger(n)&&n>=1&&n<=CAMPAIGN.length)])];
    else {const old=readStorage('ev_tycoon_unlocked_levels',[1]);unlockedLevels=[...new Set([1,...(Array.isArray(old)?old.map(n=>LEGACY_LEVEL_MAP[n]).filter(Boolean):[]),...Object.keys(legacyProgress||{}).map(id=>LEGACY_LEVEL_MAP[id]+1).filter(id=>id<=CAMPAIGN.length),...Object.keys(progress).filter(id=>progress[id]).map(id=>Number(id)+1).filter(id=>id<=CAMPAIGN.length)])];saveUnlockedLevels()}
    writeStorage('ev_tycoon_career_v3',career);
}


// 保存已解锁的关卡
function saveUnlockedLevels() { writeStorage('ev_tycoon_unlocked_levels_v3', unlockedLevels); }


// 解锁新关卡
function unlockLevel(level) {
    if (level >= 1 && level <= CAMPAIGN.length && !unlockedLevels.includes(level)) {
        unlockedLevels.push(level);
        saveUnlockedLevels();
    }
}

// 检查关卡是否已解锁
function isLevelUnlocked(level) {
    return unlockedLevels.includes(level);
}

// 更新关卡选择界面的显示状态
function updateLevelSelectUI() { renderCampaign(); }

initPriceWheel();
