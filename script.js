/* ==========================================================
   PENGATURAN — ubah di sini saja
   ========================================================== */
const CONFIG = {
    // Suara peringatan seatbelt. Kosongkan ('') kalau belum ada file audionya.
    // Nanti isi dengan nama file, contoh: 'seatbelt.mp3'
    seatbeltSound: '',
    seatbeltVolume: 0.6,

    // true  = peringatan hanya aktif kalau mesin hidup
    // false = aktif terus selama seatbelt belum dipakai
    warnOnlyWhenEngineOn: true,

    gearCount: 7,            // gear maju tertinggi yang ditampilkan (0 sampai 7)
    zeroGearLabel: 'N',      // tampilan gear 0 (netral/mundur), contoh: 'N' atau 'R'
    rpmScaleMax: 9,          // angka maksimum di tachometer (x1000)
    redline: 0.8,            // batas zona merah (0 sampai 1)
    topSpeed: 90,            // m/s, kecepatan yang membuat ring di sekitar foto penuh
    lowFuel: 0.2,            // di bawah ini fuel jadi merah
    lowHealth: 0.3,          // di bawah ini health jadi merah
    blinkIndicators: true,   // lampu sein berkedip lewat CSS
    startupSweep: true,      // jarum menyapu penuh saat mesin dinyalakan
    odometerUnit: 'mi'       // 'mi' atau 'km' (input setOdometer tetap dalam mil)
};

/* ========================================================== */

let elements = {};
let speedMode = 1;           // 0: KMH, 1: MPH, 2: Knots
let lastSpeed = 0;           // m/s
let lastRpm = 0;
let sweeping = false;

const state = {
    engine: false,
    seatbelts: false,
    locked: false,
    left: false,
    right: false
};

const R_RPM = 150;
const C_RPM = 2 * Math.PI * R_RPM;
const ARC_RPM = C_RPM * 0.75;            // busur 270 derajat

const R_SIDE = 100;
const C_SIDE = 2 * Math.PI * R_SIDE;
const ARC_SIDE = R_SIDE * (50 * Math.PI / 180);   // busur 50 derajat

const C_SPD = 2 * Math.PI * 37;

const clamp01 = n => Math.min(1, Math.max(0, Number(n) || 0));

/* ---------- Seatbelt alarm ---------- */

let seatbeltAudio = null;

function initAudio() {
    if (!CONFIG.seatbeltSound) return;
    seatbeltAudio = new Audio(CONFIG.seatbeltSound);
    seatbeltAudio.loop = true;
    seatbeltAudio.volume = CONFIG.seatbeltVolume;
}

function setAlarm(on) {
    if (!seatbeltAudio) return;
    if (on) {
        if (seatbeltAudio.paused) {
            const p = seatbeltAudio.play();
            if (p && p.catch) p.catch(() => {});
        }
    } else if (!seatbeltAudio.paused) {
        seatbeltAudio.pause();
        seatbeltAudio.currentTime = 0;
    }
}

function updateSeatbeltWarning() {
    const warn = !state.seatbelts && (!CONFIG.warnOnlyWhenEngineOn || state.engine);

    elements.warning.classList.toggle('show', warn);
    elements.hud.classList.toggle('no-belt', warn);
    elements.seatbelts.classList.toggle('on', state.seatbelts);
    elements.seatbelts.classList.toggle('bad', warn);
    setAlarm(warn);
}

/* ---------- Tampilan RPM (jarum, busur, reaksi foto) ---------- */

function applyRpm(v) {
    elements.rpmArc.style.strokeDasharray = `${ARC_RPM * v} ${C_RPM}`;
    elements.pointer.style.transform = `rotate(${135 + 270 * v}deg)`;
    elements.medallionInner.style.setProperty('--rpm', v.toFixed(3));
    elements.hud.classList.toggle('redline', !sweeping && state.engine && v >= CONFIG.redline);
}

function sweep() {
    sweeping = true;
    elements.hud.classList.add('sweeping', 'ignite');
    applyRpm(1);
    setTimeout(() => applyRpm(0), 550);
    setTimeout(() => {
        sweeping = false;
        elements.hud.classList.remove('sweeping');
        applyRpm(lastRpm);
    }, 1150);
    setTimeout(() => elements.hud.classList.remove('ignite'), 1000);
}

/* ---------- Fungsi publik (sama seperti template asli) ---------- */

/**
 * @param {boolean} state - true jika mesin hidup.
 */
function setEngine(on) {
    const was = state.engine;
    state.engine = !!on;

    elements.engine.classList.toggle('on', state.engine);
    elements.hud.classList.toggle('engine-off', !state.engine);

    if (state.engine && !was && CONFIG.startupSweep) sweep();
    if (!state.engine) elements.hud.classList.remove('redline');

    updateSeatbeltWarning();
}

/**
 * @param {number} speed - Kecepatan dalam meter per detik (m/s).
 */
function setSpeed(speed) {
    lastSpeed = Number(speed) || 0;
    let value, unit;

    switch (speedMode) {
        case 1:  value = lastSpeed * 2.236936; unit = 'mph';   break;
        case 2:  value = lastSpeed * 1.943844; unit = 'knots'; break;
        default: value = lastSpeed * 3.6;      unit = 'km/h';
    }

    elements.speed.textContent = Math.round(value);
    elements.speedUnit.textContent = unit;

    const frac = clamp01(lastSpeed / CONFIG.topSpeed);
    elements.spdArc.style.strokeDasharray = `${C_SPD * frac} ${C_SPD}`;
    elements.spdArc.classList.toggle('fast', frac > 0.75);
}

/**
 * @param {number} rpm - Nilai RPM dari 0 sampai 1.
 */
function setRPM(rpm) {
    lastRpm = clamp01(rpm);
    if (!sweeping) applyRpm(lastRpm);
}

function setSideMeter(arcEl, infoEl, textEl, value, lowLimit) {
    const v = clamp01(value);
    arcEl.style.strokeDasharray = `${ARC_SIDE * v} ${C_SIDE}`;
    textEl.textContent = Math.round(v * 100);
    const low = v <= lowLimit;
    arcEl.classList.toggle('low', low);
    infoEl.classList.toggle('low', low);
}

/**
 * @param {number} fuel - Level bensin dari 0 sampai 1.
 */
function setFuel(fuel) {
    setSideMeter(elements.fuelArc, elements.fuelInfo, elements.fuel, fuel, CONFIG.lowFuel);
}

/**
 * @param {number} health - Kondisi kendaraan dari 0 sampai 1.
 */
function setHealth(health) {
    setSideMeter(elements.healthArc, elements.healthInfo, elements.health, health, CONFIG.lowHealth);
}

/**
 * @param {number|string} gear - Gear saat ini (0 sampai 7). 0 dianggap netral/mundur.
 */
function setGear(gear) {
    const n = Math.min(CONFIG.gearCount, Math.max(0, Math.floor(Number(gear) || 0)));
    const label = n === 0 ? CONFIG.zeroGearLabel : String(n);
    const el = elements.gear;

    if (el.textContent !== label) {
        el.textContent = label;
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
    }
}

/**
 * @param {number} state - 0: Off, 1: On, 2: High Beam.
 */
function setHeadlights(level) {
    const el = elements.headlights;
    el.classList.toggle('on', level === 1);
    el.classList.toggle('high', level === 2);
}

/**
 * @param {boolean} state - true untuk menyalakan sein kiri.
 */
function setLeftIndicator(on) {
    state.left = !!on;
    elements.indLeft.classList.toggle('on', state.left);
}

/**
 * @param {boolean} state - true untuk menyalakan sein kanan.
 */
function setRightIndicator(on) {
    state.right = !!on;
    elements.indRight.classList.toggle('on', state.right);
}

/**
 * @param {boolean} state - true jika seatbelt dipakai.
 */
function setSeatbelts(on) {
    state.seatbelts = !!on;
    updateSeatbeltWarning();
}

/**
 * Tambahan: status kunci kendaraan.
 * @param {boolean} locked - true jika kendaraan terkunci.
 */
function setLocked(locked) {
    state.locked = !!locked;
    elements.lock.classList.toggle('on', state.locked);
}

/**
 * @param {number} mode - 0: KMH, 1: MPH, 2: Knots.
 */
function setSpeedMode(mode) {
    speedMode = mode;
    setSpeed(lastSpeed);
}

/**
 * @param {number} distance - Jarak dalam mil.
 */
function setOdometer(distance) {
    const miles = Number(distance) || 0;
    const km = CONFIG.odometerUnit === 'km';
    elements.odometer.textContent = `${(km ? miles * 1.609344 : miles).toFixed(1)} ${km ? 'km' : 'mi'}`;
}

/**
 * Tambahan: tampilkan atau sembunyikan seluruh HUD (alarm ikut berhenti saat disembunyikan).
 * @param {boolean} visible
 */
function setVisible(visible) {
    elements.hud.classList.toggle('hidden', !visible);
    if (!visible) setAlarm(false);
    else updateSeatbeltWarning();
}

/* ---------- Pembuatan elemen dial ---------- */

function buildTicks() {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.getElementById('ticks');
    const max = CONFIG.rpmScaleMax;
    const steps = max * 2;

    for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        const major = i % 2 === 0;
        const red = frac >= CONFIG.redline - 0.001;
        const angle = (135 + 270 * frac) * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const r1 = 140;
        const r2 = major ? 130 : 135;

        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', 170 + r1 * cos);
        line.setAttribute('y1', 170 + r1 * sin);
        line.setAttribute('x2', 170 + r2 * cos);
        line.setAttribute('y2', 170 + r2 * sin);
        line.setAttribute('class', 'tick' + (major ? ' major' : '') + (red ? ' red' : ''));
        g.appendChild(line);

        if (major) {
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', 170 + 116 * cos);
            t.setAttribute('y', 170 + 116 * sin);
            t.setAttribute('class', 'tick-label' + (red ? ' red' : ''));
            t.textContent = i / 2;
            g.appendChild(t);
        }
    }
}

function buildArcs() {
    const track = document.getElementById('rpmTrack');
    const redzone = document.getElementById('rpmRed');

    track.setAttribute('transform', 'rotate(135 170 170)');
    track.style.strokeDasharray = `${ARC_RPM} ${C_RPM}`;

    redzone.setAttribute('transform', `rotate(${135 + 270 * CONFIG.redline} 170 170)`);
    redzone.style.strokeDasharray = `${ARC_RPM * (1 - CONFIG.redline)} ${C_RPM}`;

    elements.rpmArc.setAttribute('transform', 'rotate(135 170 170)');

    ['healthTrack', 'healthArc', 'fuelTrack', 'fuelArc'].forEach(id => {
        document.getElementById(id).setAttribute('transform', 'rotate(155 170 170)');
    });
    document.getElementById('healthTrack').style.strokeDasharray = `${ARC_SIDE} ${C_SIDE}`;
    document.getElementById('fuelTrack').style.strokeDasharray = `${ARC_SIDE} ${C_SIDE}`;
}

/* ---------- Mode demo: buka index.html?demo untuk tes di browser ---------- */

function runDemo() {
    let t = 0;
    setEngine(true);
    setOdometer(1234.5);
    setHealth(0.88);

    setInterval(() => {
        t += 0.05;
        const sp = (Math.sin(t * 0.4 - 1.5) + 1) / 2;
        setSpeed(sp * 82);

        const band = sp * CONFIG.gearCount;
        const gear = Math.min(CONFIG.gearCount, Math.floor(band) + 1);
        setGear(sp < 0.02 ? 0 : gear);
        setRPM(0.3 + (band % 1) * 0.62);

        const s = Math.floor(t);
        setLeftIndicator(s % 12 < 3);
        setRightIndicator(s % 12 >= 6 && s % 12 < 9);
        setHeadlights(Math.floor(t / 8) % 3);
        setSeatbelts(Math.floor(t / 14) % 2 === 1);
        setLocked(Math.floor(t / 10) % 2 === 0);
        setFuel(0.62 - (t % 60) / 200);
    }, 50);
}

/* ---------- Inisialisasi ---------- */

function init() {
    elements = {
        hud: document.getElementById('hud'),
        warning: document.getElementById('warning'),
        engine: document.getElementById('engine'),
        speed: document.getElementById('speed'),
        speedUnit: document.getElementById('speedUnit'),
        gear: document.getElementById('gear'),
        lock: document.getElementById('lock'),
        spdArc: document.getElementById('spdArc'),
        rpmArc: document.getElementById('rpmArc'),
        pointer: document.getElementById('pointer'),
        medallionInner: document.querySelector('.medallion-inner'),
        fuel: document.getElementById('fuel'),
        fuelArc: document.getElementById('fuelArc'),
        fuelInfo: document.getElementById('fuelInfo'),
        health: document.getElementById('health'),
        healthArc: document.getElementById('healthArc'),
        healthInfo: document.getElementById('healthInfo'),
        headlights: document.getElementById('headlights'),
        indicators: document.getElementById('indicators'),
        indLeft: document.getElementById('indLeft'),
        indRight: document.getElementById('indRight'),
        seatbelts: document.getElementById('seatbelts'),
        odometer: document.getElementById('odometer')
    };

    elements.hud.classList.toggle('blink', CONFIG.blinkIndicators);

    buildArcs();
    buildTicks();
    initAudio();

    setEngine(false);
    setSpeed(0);
    setRPM(0);
    setFuel(1);
    setHealth(1);
    setGear(0);
    setHeadlights(0);
    setLeftIndicator(false);
    setRightIndicator(false);
    setSeatbelts(false);
    setLocked(false);
    setOdometer(0);

    if (/[?&]demo\b/.test(location.search)) runDemo();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
