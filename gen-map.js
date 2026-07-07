// Tiled 맵 생성기 v2 — 두 Terrain 폴더의 모든 PNG를 타일셋으로 embed
const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/user/repositories/rilybox/rilybox-game';
const ASSETS = path.join(ROOT, 'assets');

const W = 20, H = 12, TS = 64;                    // 20x12 타일 (1280x768px, 한 화면)
const ISL = { L: 2, R: W - 3, T: 2, B: H - 3 };   // 시작 잔디 대륙

function pngSize(p) {
    const b = fs.readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// assets 하위 절대경로 → { image: map용(../assets/..), path: phaser용(assets/..) }
function rel(absPath) {
    const r = path.relative(ASSETS, absPath).replace(/\\/g, '/');
    return { image: '../assets/' + r, phaser: 'assets/' + r };
}

// 폴더 재귀 스캔 → .png 목록 (aseprite/__MACOSX 제외)
function listPng(dir) {
    const out = [];
    for (const name of fs.readdirSync(dir)) {
        if (name === '__MACOSX') continue;
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) out.push(...listPng(full));
        else if (/\.png$/i.test(name)) out.push(full);
    }
    return out;
}

// 아틀라스(격자 슬라이스) 판별: Ground/Tileset/Bridge, 물/물거품 시트
function isAtlas(p) {
    const s = p.replace(/\\/g, '/');
    return /\/(Ground|Tileset|Bridge)\//.test(s) || /\/Water\/(Foam\/|Water\.png)/.test(s);
}

// --- 타일셋 목록 만들기 ---
const tilesets = [];
const usedImages = new Set();
let firstgid = 1;
const usedNames = new Set();

function uniqueName(base) {
    let n = base, i = 2;
    while (usedNames.has(n)) n = `${base}_${i++}`;
    usedNames.add(n);
    return n;
}

function addTileset(absPath, forcedName) {
    const { image, phaser } = rel(absPath);
    if (usedImages.has(image)) return;
    usedImages.add(image);
    const { w, h } = pngSize(absPath);
    const atlas = isAtlas(absPath) && w % 64 === 0 && h % 64 === 0;
    const tw = atlas ? 64 : w;
    const th = atlas ? 64 : h;
    const cols = atlas ? w / 64 : 1;
    const rows = atlas ? h / 64 : 1;
    const count = cols * rows;
    const name = uniqueName(forcedName || path.basename(absPath, '.png'));
    tilesets.push({
        firstgid, name, image, imagewidth: w, imageheight: h,
        tilewidth: tw, tileheight: th, columns: cols, tilecount: count,
        margin: 0, spacing: 0, _phaser: phaser
    });
    firstgid += count;
}

// 1) 섬 그리기에 쓰는 4종을 고정 이름으로 먼저 등록 (gid 순서 고정)
const U = path.join(ASSETS, 'Tiny Swords/Tiny Swords (Update 010)/Terrain');
addTileset(path.join(U, 'Ground/Tilemap_Flat.png'), 'grass');
addTileset(path.join(U, 'Water/Water.png'), 'water');
addTileset(path.join(U, 'Ground/Tilemap_Elevation.png'), 'elevation');
addTileset(path.join(U, 'Water/Foam/Foam.png'), 'foam');

// 2) 두 Terrain 폴더의 나머지 PNG 전부 추가
const dirs = [
    path.join(ASSETS, 'Tiny Swords/Tiny Swords (Update 010)/Terrain'),
    path.join(ASSETS, 'Tiny Swords (Free Pack)/Tiny Swords (Free Pack)/Terrain'),
];
for (const d of dirs) for (const f of listPng(d)) addTileset(f);

// --- 섬 레이어 데이터 ---
const GRASS_FG = tilesets.find(t => t.name === 'grass').firstgid;   // 1
const WATER_FG = tilesets.find(t => t.name === 'water').firstgid;   // 41
function grassGid(c, r) {
    if (c < ISL.L || c > ISL.R || r < ISL.T || r > ISL.B) return 0;
    const col = (c === ISL.L) ? 0 : (c === ISL.R) ? 2 : 1;
    const row = (r === ISL.T) ? 0 : (r === ISL.B) ? 2 : 1;
    return GRASS_FG + (row * 10 + col);
}
const water = [], ground = [], elevation = [], foam = [];
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    water.push(WATER_FG); ground.push(grassGid(c, r)); elevation.push(0); foam.push(0);
}

// --- 언덕(플래토) 배치 ---
// Tilemap_Elevation 로컬 인덱스(사용자 분류):
//   윗면 0~11 (4열x3행: 0=뒤좌,1/2=뒤,3=뒤우 / 4=좌,5/6=가운데,7=우 / 8=앞좌,9/10=앞,11=앞우)
//   앞벽(옆면) 12~15,  계단 28~31
const ELEV_FG = tilesets.find(t => t.name === 'elevation').firstgid;   // 42
function setElev(c, r, local) { if (c < 0 || c >= W || r < 0 || r >= H) return; elevation[r * W + c] = ELEV_FG + local; }
function plateau(x0, y0, w, h, stairs) {
    const x1 = x0 + w - 1, y1 = y0 + h - 1;
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
        const rr = (r === y0) ? 0 : (r === y1) ? 2 : 1;      // 뒤/중간/앞
        const co = (c === x0) ? 0 : (c === x1) ? 3 : 1;      // 좌/중간/우 (시트 4열)
        setElev(c, r, rr * 4 + co);                          // 윗면 0~11
    }
    for (let c = x0; c <= x1; c++) {                          // 앞벽(절벽) 행
        const co = (c === x0) ? 0 : (c === x1) ? 3 : 1;
        setElev(c, y1 + 1, 12 + co);                          // 12/13/15
    }
    if (stairs) setElev(x0 + Math.floor(w / 2), y1 + 1, 29);  // 계단(가운데 앞벽 자리)
}
plateau(14, 7, 5, 3, true);    // 동쪽 언덕
plateau(3, 8, 4, 3, true);     // 남서 언덕
const layer = (id, name, data) => ({ id, name, type: 'tilelayer', x: 0, y: 0, width: W, height: H, opacity: 1, visible: true, data });

const map = {
    compressionlevel: -1, infinite: false, orientation: 'orthogonal', renderorder: 'right-down',
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    width: W, height: H, tilewidth: TS, tileheight: TS, nextlayerid: 6, nextobjectid: 1,
    tilesets: tilesets.map(({ _phaser, ...t }) => t),   // _phaser 는 맵에서 제외
    layers: [layer(1, 'water', water), layer(4, 'foam', foam), layer(2, 'ground', ground), layer(3, 'elevation', elevation)],
};

fs.mkdirSync(path.join(ROOT, 'map'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'map/level1.json'), JSON.stringify(map, null, 1));

// Phaser 매니페스트 (이름 → 이미지 경로)
const manifest = 'const TILESETS = ' + JSON.stringify(tilesets.map(t => ({ name: t.name, path: t._phaser })), null, 1) + ';\n';
fs.writeFileSync(path.join(ROOT, 'js/tileset-manifest.js'), manifest);

console.log('✓ 맵 재생성 완료');
console.log('타일셋 수:', tilesets.length);
console.log('마지막 gid:', firstgid - 1);
