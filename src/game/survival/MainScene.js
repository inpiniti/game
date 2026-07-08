// 딸기 서바이벌 — Main Scene (Tiled 맵 모드, ESM). 서바이벌 앱에서는 미마운트.
import Phaser from 'phaser';
import { U, F, GAME_W, GAME_H, TILESETS } from '../assets-manifest';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    // ---------- 1) 자산 로드 ----------
    preload() {
        this.load.spritesheet('warrior', `${U}/Factions/Knights/Troops/Warrior/Blue/Warrior_Blue.png`,
            { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('tree', `${U}/Resources/Trees/Tree.png`,
            { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('sheep', `${U}/Resources/Sheep/HappySheep_Idle.png`,
            { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('archer', `${U}/Factions/Knights/Troops/Archer/Blue/Archer_Blue.png`,
            { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('pawn', `${U}/Factions/Knights/Troops/Pawn/Blue/Pawn_Blue.png`,
            { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('goblin_torch', `${U}/Factions/Goblins/Troops/Torch/Red/Torch_Red.png`,
            { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('goblin_tnt', `${U}/Factions/Goblins/Troops/TNT/Red/TNT_Red.png`,
            { frameWidth: 192, frameHeight: 192 });

        // 타일맵(Tiled로 편집) + 맵에 든 모든 타일셋 자동 로드 (js/tileset-manifest.js)
        this.load.tilemapTiledJSON('level1', '/map/level1.json');
        TILESETS.forEach((t) => this.load.image(t.name, t.path));

        this.load.spritesheet('gold', `${F}/Terrain/Resources/Gold/Gold Resource/Gold_Resource_Highlight.png`,
            { frameWidth: 128, frameHeight: 128 });
        this.load.image('goldBase', `${F}/Terrain/Resources/Gold/Gold Stones/Gold Stone 3.png`);
        this.load.image('house', `${U}/Factions/Knights/Buildings/House/House_Blue.png`);
        this.load.image('houseR', `${U}/Factions/Knights/Buildings/House/House_Red.png`);
        this.load.image('houseY', `${U}/Factions/Knights/Buildings/House/House_Yellow.png`);
        this.load.image('houseP', `${U}/Factions/Knights/Buildings/House/House_Purple.png`);
        this.load.image('castle', `${U}/Factions/Knights/Buildings/Castle/Castle_Blue.png`);
        this.load.image('tower', `${U}/Factions/Knights/Buildings/Tower/Tower_Blue.png`);
        this.load.spritesheet('tree1', `${F}/Terrain/Resources/Wood/Trees/Tree1.png`, { frameWidth: 192, frameHeight: 256 });
        this.load.spritesheet('tree2', `${F}/Terrain/Resources/Wood/Trees/Tree2.png`, { frameWidth: 192, frameHeight: 256 });
        this.load.spritesheet('tree3', `${F}/Terrain/Resources/Wood/Trees/Tree3.png`, { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('tree4', `${F}/Terrain/Resources/Wood/Trees/Tree4.png`, { frameWidth: 192, frameHeight: 192 });
        // 덤불 4종 (1024x128 = 128x8 프레임 애니메이션)
        this.load.spritesheet('bushe1', `${F}/Terrain/Decorations/Bushes/Bushe1.png`, { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('bushe2', `${F}/Terrain/Decorations/Bushes/Bushe2.png`, { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('bushe3', `${F}/Terrain/Decorations/Bushes/Bushe3.png`, { frameWidth: 128, frameHeight: 128 });
        this.load.spritesheet('bushe4', `${F}/Terrain/Decorations/Bushes/Bushe4.png`, { frameWidth: 128, frameHeight: 128 });
        this.load.image('rock1', `${F}/Terrain/Decorations/Rocks/Rock1.png`);
        this.load.image('rock2', `${F}/Terrain/Decorations/Rocks/Rock2.png`);
        for (let i = 1; i <= 8; i++) {
            this.load.image(`cloud${i}`, `${F}/Terrain/Decorations/Clouds/Clouds_0${i}.png`);
        }
        // Deco 장식물들 (Update 010)
        for (let i = 1; i <= 18; i++) {
            const num = i.toString().padStart(2, '0');
            this.load.image(`deco${i}`, `${U}/Deco/${num}.png`);
        }
    }

    // ---------- 2) 배치 ----------
    create() {
        // 애니메이션
        this.anims.create({ key: 'warrior_idle',
            frames: this.anims.generateFrameNumbers('warrior', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'warrior_attack',
            frames: this.anims.generateFrameNumbers('warrior', { start: 12, end: 17 }), frameRate: 14, repeat: 0 });
        this.anims.create({ key: 'tree_sway',
            frames: this.anims.generateFrameNumbers('tree', { start: 0, end: 5 }), frameRate: 3, repeat: -1 });
        this.anims.create({ key: 'sheep_idle',
            frames: this.anims.generateFrameNumbers('sheep', { start: 0, end: 7 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'archer_idle',
            frames: this.anims.generateFrameNumbers('archer', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'pawn_idle',
            frames: this.anims.generateFrameNumbers('pawn', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'goblin_torch_idle',
            frames: this.anims.generateFrameNumbers('goblin_torch', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'goblin_tnt_idle',
            frames: this.anims.generateFrameNumbers('goblin_tnt', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'goblin_torch_attack',
            frames: this.anims.generateFrameNumbers('goblin_torch', { start: 12, end: 17 }), frameRate: 14, repeat: 0 });
        this.anims.create({ key: 'goblin_tnt_attack',
            frames: this.anims.generateFrameNumbers('goblin_tnt', { start: 12, end: 17 }), frameRate: 14, repeat: 0 });
        this.anims.create({ key: 'gold_sparkle',
            frames: this.anims.generateFrameNumbers('gold', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'bushe1_sway',
            frames: this.anims.generateFrameNumbers('bushe1', { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'bushe2_sway',
            frames: this.anims.generateFrameNumbers('bushe2', { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'bushe3_sway',
            frames: this.anims.generateFrameNumbers('bushe3', { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'bushe4_sway',
            frames: this.anims.generateFrameNumbers('bushe4', { start: 0, end: 7 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'tree1_sway',
            frames: this.anims.generateFrameNumbers('tree1', { start: 0, end: 7 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'tree2_sway',
            frames: this.anims.generateFrameNumbers('tree2', { start: 0, end: 7 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'tree3_sway',
            frames: this.anims.generateFrameNumbers('tree3', { start: 0, end: 7 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'tree4_sway',
            frames: this.anims.generateFrameNumbers('tree4', { start: 0, end: 7 }), frameRate: 4, repeat: -1 });

        // 지형(Tiled 맵) + 카메라/월드 경계
        this.buildTerrain();

        // 상태
        this.resources = { wood: 0, gold: 0, meat: 0 };
        this.gatherables = [];
        this.attacking = false;

        // 고정물(나무·금·건물) 충돌 그룹
        this.solids = this.physics.add.group({ immovable: true, allowGravity: false });

        // 그림1식 왕국 배치
        this.composeWorld();

        // 플레이어 — 배치해둔 시작 지점
        this.player = this.physics.add.sprite(this.spawnX, this.spawnY, 'warrior').play('warrior_idle');
        this.player.setScale(0.6);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(56, 60).setOffset(68, 84);
        this.player.on('animationcomplete', (anim) => {
            if (anim.key === 'warrior_attack') this.attacking = false;
        });

        // 카메라가 기사를 부드럽게 따라감 → 기사는 늘 화면 중앙
        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

        // 충돌 (고정물 + 물 + 절벽)
        this.physics.add.collider(this.player, this.solids);
        this.physics.add.collider(this.player, this.waterLayer);
        this.physics.add.collider(this.player, this.elevationLayer);

        // 입력 (키보드 + 터치)
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.addPointer(2);              // 멀티터치(조이스틱+버튼 동시)
        this.moveVec = new Phaser.Math.Vector2(0, 0);
        this.createTouchControls();

        // HUD (화면에 고정)
        this.hud = this.add.text(16, 14, '', {
            fontSize: '22px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setScrollFactor(0).setDepth(20000);
        this.instr = this.add.text(16, 44, '이동: 화살표 / 왼쪽 조이스틱   ·   채집·공격: Space / 오른쪽 버튼', {
            fontSize: '15px', color: '#e8e8e8', stroke: '#000000', strokeThickness: 3
        }).setScrollFactor(0).setDepth(20000);
        this.updateHud();

        // UI를 화면 크기에 맞게 배치 + 화면 크기 변경 시 다시 배치
        this.layoutUI();
        this.scale.on('resize', this.layoutUI, this);

        // 구름들 (떠다니는 배경)
        this.clouds = [];
        this.spawnClouds();
    }

    // ---------- 지형: Tiled 맵 ----------
    buildTerrain() {
        const map = this.make.tilemap({ key: 'level1' });
        // 맵에 든 모든 타일셋을 이름 기준으로 자동 연결
        // (Tiled에서 새 타일셋을 'Embed'로 추가하면 여기서도 자동으로 잡힘)
        const all = map.tilesets
            .map((ts) => (this.textures.exists(ts.name) ? map.addTilesetImage(ts.name, ts.name) : null))
            .filter(Boolean);

        const waterLayer = map.createLayer('water', all, 0, 0).setDepth(-2000);
        map.createLayer('foam', all, 0, 0).setDepth(-1950);
        const groundLayer = map.createLayer('ground', all, 0, 0).setDepth(-1000);
        const elevationLayer = map.createLayer('elevation', all, 0, 0).setDepth(-900);
        this.waterLayer = waterLayer;
        this.elevationLayer = elevationLayer;

        // === 타일 충돌 ===
        // 물: 일단 모든 물 타일을 막고,
        waterLayer.setCollisionByExclusion([-1]);
        // 잔디(ground)가 덮인 칸은 다시 통과 가능하게 해제 (물이 잔디 밑에 깔려 있으므로)
        groundLayer.forEachTile((t) => {
            if (t.index !== -1) {
                const wt = waterLayer.getTileAt(t.x, t.y);
                if (wt) wt.setCollision(false);
            }
        });
        // 절벽(elevation): 앞벽(옆면) 타일만 막음. 윗면·계단은 통과.
        //   로컬 인덱스 12~15, 20~23 = 앞벽 (사용자 분류)  →  gid = firstgid + local
        const elevTs = map.tilesets.find((t) => t.name === 'elevation');
        if (elevTs) {
            const fg = elevTs.firstgid;
            elevationLayer.setCollision([12, 13, 14, 15, 20, 21, 22, 23].map((i) => fg + i));
        }

        this.worldW = map.widthInPixels;
        this.worldH = map.heightInPixels;

        // 카메라가 맵 밖을 안 보이게 / 플레이어는 맵 전체 범위(충돌이 물·절벽을 막음)
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    }

    // ---------- 그림1식 왕국 배치 ----------
    composeWorld() {
        const rng = new Phaser.Math.RandomDataGenerator(['rilybox-kingdom']);
        const jit = (v) => rng.between(-v, v);

        const forest = (cx, cy, n, s) => { for (let i = 0; i < n; i++) this.addTree(cx + jit(s), cy + jit(s)); };
        const flock = (cx, cy, n, s) => { for (let i = 0; i < n; i++) this.addSheep(cx + jit(s), cy + jit(s)); };
        const goldVein = (cx, cy, n, s) => { for (let i = 0; i < n; i++) this.addGold(cx + jit(s), cy + jit(s)); };
        const goblinParty = (cx, cy, n, s) => { for (let i = 0; i < n; i++) this.addGoblin(cx + jit(s), cy + jit(s)); };
        const rocks = (cx, cy, n, s) => {
            for (let i = 0; i < n; i++) {
                const k = 'Rock' + rng.between(1, 4);
                if (this.textures.exists(k)) {
                    const rk = this.add.image(cx + jit(s), cy + jit(s), k);
                    rk.setDepth(rk.y);
                }
            }
        };

        // 북서쪽 성채 (성 + 망루 2)
        this.addBuilding('castle', 130, 100, 0.9, 220, 90, 55, 150);
        this.addBuilding('tower', 80, 140, 0.9, 84, 52, 22, 176);
        this.addBuilding('tower', 180, 145, 0.9, 84, 52, 22, 176);

        // 동쪽 마을 (집 5색 + 망루)
        this.addBuilding('house', 450, 170, 0.9, 96, 55, 16, 120);
        this.addBuilding('houseR', 490, 190, 0.9, 96, 55, 16, 120);
        this.addBuilding('houseY', 465, 240, 0.9, 96, 55, 16, 120);
        this.addBuilding('houseP', 430, 220, 0.9, 96, 55, 16, 120);
        this.addBuilding('house', 520, 250, 0.9, 96, 55, 16, 120);
        this.addBuilding('tower', 400, 140, 0.9, 84, 52, 22, 176);

        // 숲 (나무 다양화 + 기존 Tree 혼합)
        forest(300, 100, 2, 60);
        this.addTreeVariety(300, 100, 2, 60);
        forest(500, 300, 2, 60);
        this.addTreeVariety(500, 300, 2, 60);
        forest(150, 300, 2, 60);
        this.addTreeVariety(150, 300, 2, 60);

        // 데코 (바위·덤불 여러 곳에 무리로 배치)
        const decoRng = new Phaser.Math.RandomDataGenerator(['deco']);
        const decoZones = [
            { x: 200, y: 180, count: 2 },
            { x: 400, y: 250, count: 2 },
            { x: 280, y: 280, count: 2 },
        ];
        for (const zone of decoZones) {
            for (let i = 0; i < zone.count; i++) {
                const kind = decoRng.pick(['bushe1', 'bushe2', 'bushe3', 'bushe4', 'rock1', 'rock2']);
                const x = zone.x + decoRng.between(-50, 50);
                const y = zone.y + decoRng.between(-50, 50);
                this.addDeco(x, y, kind, 0.4);
            }
        }

        // 양 목초지 (마을 근처 + 중앙)
        flock(420, 250, 3, 50);
        flock(280, 220, 2, 50);

        // 금 광맥 (남서 + 북동 귀퉁이)
        goldVein(150, 280, 2, 50);
        goldVein(500, 180, 2, 50);

        // 고블린 파티 (성 근처 + 남동쪽)
        goblinParty(320, 280, 2, 60);
        goblinParty(500, 350, 2, 60);

        // 바위 장식 (비충돌)
        rocks(200, 200, 2, 50);
        rocks(380, 300, 2, 50);

        // Deco 장식물들 (여러 위치에 분산)
        const decoRng2 = new Phaser.Math.RandomDataGenerator(['deco2']);
        const decoZones2 = [
            { x: 200, y: 180, count: 2 },
            { x: 400, y: 250, count: 2 },
        ];
        for (const zone of decoZones2) {
            for (let i = 0; i < zone.count; i++) {
                const decoNum = decoRng2.between(1, 18);
                const x = zone.x + decoRng2.between(-80, 80);
                const y = zone.y + decoRng2.between(-80, 80);
                const scale = 0.5 + decoRng2.frac() * 0.3;
                const deco = this.add.image(x, y, `deco${decoNum}`).setScale(scale);
                deco.setDepth(y);
            }
        }

        // 왕국을 지키고 일하는 유닛들 (일부는 돌아다님)
        this.addNpc('warrior_idle', 110, 130, false, false);   // 성 경비병
        this.addNpc('warrior_idle', 160, 125, true, true);     // 순찰병 (돌아다님)
        this.addNpc('archer_idle', 80, 120, false, false);     // 망루 궁수
        this.addNpc('archer_idle', 180, 120, true, true);      // 순찰궁수 (돌아다님)
        this.addNpc('pawn_idle', 450, 220, false, true);       // 마을 일꾼 (일하러 돌아다님)
        this.addNpc('pawn_idle', 480, 240, true, true);

        // 플레이어 시작 지점 (성채와 마을 사이 트인 곳)
        this.spawnX = 300;
        this.spawnY = 220;
    }

    // 유닛(NPC) — idle 또는 돌아다니기
    addNpc(anim, x, y, flip, wander = false, type = null) {
        const unit = anim.split('_')[0];
        const s = this.add.sprite(x, y, unit).play(anim).setScale(0.6);
        if (flip) s.setFlipX(true);
        s.setDepth(y);
        if (wander) {
            // 돌아다니는 유닛: 위치 + 속도 + 방향 타이머
            s.npcData = { x, y, vx: 0, vy: 0, dirTimer: 0, dirInterval: 180, type, attacking: false, attackTimer: 0 };
            this.npcs ||= [];
            this.npcs.push(s);
        }
    }

    addBuilding(key, x, y, scale, bw, bh, ox, oy) {
        const b = this.solids.create(x, y, key).setScale(scale);
        b.body.setSize(bw, bh).setOffset(ox, oy);
        b.body.moves = false;
        b.setDepth(y);
    }

    addTree(x, y) {
        const t = this.solids.create(x, y, 'tree').play('tree_sway').setScale(0.65);
        t.body.setSize(46, 30).setOffset(73, 132);
        t.body.moves = false;
        t.setDepth(y);
        this.gatherables.push({ sprite: t, type: 'wood', hp: 3, range: 95, depleted: false });
    }

    addGold(x, y) {
        const g = this.solids.create(x, y, 'gold').play('gold_sparkle').setScale(0.7);
        g.body.setSize(96, 60).setOffset(16, 60);
        g.body.moves = false;
        g.setDepth(y);
        this.gatherables.push({ sprite: g, type: 'gold', hp: 3, range: 95, depleted: false });
    }

    addSheep(x, y) {
        const s = this.add.sprite(x, y, 'sheep').play('sheep_idle').setScale(0.7);
        s.setDepth(y);
        this.gatherables.push({ sprite: s, type: 'meat', hp: 2, range: 90, depleted: false });
        // 양도 가끔 돌아다니도록
        if (Math.random() < 0.5) {
            s.npcData = { x, y, vx: 0, vy: 0, dirTimer: 0, dirInterval: 240 };
            this.npcs ||= [];
            this.npcs.push(s);
        }
    }

    // 고블린 (돌아다니는 적 유닛)
    addGoblin(x, y) {
        const types = ['goblin_barrel', 'goblin_torch', 'goblin_tnt'];
        const type = types[Math.floor(Math.random() * types.length)];
        const g = this.add.sprite(x, y, type).play(type + '_idle').setScale(0.7);
        g.setDepth(y);
        // 모든 고블린은 돌아다님
        g.npcData = { x, y, vx: 0, vy: 0, dirTimer: 0, dirInterval: 240 };
        this.npcs ||= [];
        this.npcs.push(g);
    }

    // Free Pack 나무들 (흔들리는 애니메이션)
    addTreeVariety(cx, cy, count, spread) {
        const types = ['tree1', 'tree2', 'tree3', 'tree4'];
        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const x = cx + (Math.random() - 0.5) * spread * 2;
            const y = cy + (Math.random() - 0.5) * spread * 2;
            if (this.textures.exists(type)) {
                const tr = this.add.sprite(x, y, type).play(type + '_sway').setScale(0.8).setOrigin(0.5, 0.5);
                tr.setDepth(tr.y);
            }
        }
    }

    // 데코: 덤불(애니메이션)·바위(정적)
    addDeco(x, y, type, scale = 0.7) {
        if (!this.textures.exists(type)) return;
        let d;
        if (type.includes('bushe')) {
            d = this.add.sprite(x, y, type).play(type + '_sway').setScale(scale).setOrigin(0.5, 0.5);
        } else {
            d = this.add.image(x, y, type).setScale(scale).setOrigin(0.5, 0.5);
        }
        d.setDepth(d.y);
    }

    // 구름들 생성 (월드에 배치된 떠다니는 객체)
    spawnClouds() {
        const cloudTypes = ['cloud1', 'cloud2', 'cloud3', 'cloud4', 'cloud5', 'cloud6', 'cloud7', 'cloud8'];
        const numClouds = 12;
        const rng = new Phaser.Math.RandomDataGenerator(['clouds']);
        for (let i = 0; i < numClouds; i++) {
            const type = cloudTypes[Math.floor(Math.random() * cloudTypes.length)];
            const x = Math.random() * this.worldW;
            const y = 200 + Math.random() * 400;
            const scale = 0.5 + Math.random() * 0.4;
            const speed = 5 + Math.random() * 10;
            const cloud = this.add.image(x, y, type).setScale(scale).setAlpha(0.6);
            cloud.setScrollFactor(1).setDepth(y - 100);
            this.clouds.push({ sprite: cloud, speed, baseY: y });
        }
    }

    // ---------- 터치 조작 (조이스틱 + 액션 버튼) ----------
    createTouchControls() {
        const R = 90, AR = 72;
        this.joy = { bx: 0, by: 0, R, pointer: null };  // 위치는 layoutUI 에서 화면에 맞춰 지정
        this.act = { ax: 0, ay: 0, AR };

        this.joyBase = this.add.circle(0, 0, R, 0xffffff, 0.15).setScrollFactor(0).setDepth(30000).setStrokeStyle(4, 0xffffff, 0.35);
        this.joyThumb = this.add.circle(0, 0, 44, 0xffffff, 0.45).setScrollFactor(0).setDepth(30001);
        this.actCircle = this.add.circle(0, 0, AR, 0xffcc44, 0.35).setScrollFactor(0).setDepth(30000).setStrokeStyle(4, 0xffffff, 0.5);
        this.actLabel = this.add.text(0, 0, '⚔', { fontSize: '44px' }).setOrigin(0.5).setScrollFactor(0).setDepth(30001);

        this.input.on('pointerdown', (p) => {
            if (this.overAct(p)) { this.doAction(); }
            else if (!this.joy.pointer && p.x < this.scale.width * 0.5) { this.joy.pointer = p; this.moveJoy(p); }
        });
        this.input.on('pointermove', (p) => { if (this.joy.pointer === p) this.moveJoy(p); });
        this.input.on('pointerup', (p) => {
            if (this.joy.pointer === p) {
                this.joy.pointer = null;
                this.moveVec.set(0, 0);
                this.joyThumb.setPosition(this.joy.bx, this.joy.by);
            }
        });
    }

    // UI를 현재 화면 크기에 맞춰 배치 (창/화면 크기 바뀔 때마다 호출)
    layoutUI() {
        const w = this.scale.width, h = this.scale.height;
        // 조이스틱: 왼쪽 아래
        this.joy.bx = 40 + this.joy.R;
        this.joy.by = h - 40 - this.joy.R;
        this.joyBase.setPosition(this.joy.bx, this.joy.by);
        if (!this.joy.pointer) this.joyThumb.setPosition(this.joy.bx, this.joy.by);
        // 액션 버튼: 오른쪽 아래
        this.act.ax = w - 40 - this.act.AR;
        this.act.ay = h - 40 - this.act.AR;
        this.actCircle.setPosition(this.act.ax, this.act.ay);
        this.actLabel.setPosition(this.act.ax, this.act.ay);
    }

    overAct(p) {
        return Phaser.Math.Distance.Between(p.x, p.y, this.act.ax, this.act.ay) <= this.act.AR + 12;
    }

    moveJoy(p) {
        const v = new Phaser.Math.Vector2(p.x - this.joy.bx, p.y - this.joy.by);
        if (v.length() > this.joy.R) v.setLength(this.joy.R);
        this.joyThumb.setPosition(this.joy.bx + v.x, this.joy.by + v.y);
        this.moveVec.set(v.x / this.joy.R, v.y / this.joy.R);
    }

    // ---------- 3) 매 프레임 ----------
    update() {
        const speed = 210;
        const body = this.player.body;

        // 이동 방향: 조이스틱 우선, 없으면 방향키
        const dir = new Phaser.Math.Vector2(0, 0);
        if (this.moveVec.lengthSq() > 0.03) {
            dir.set(this.moveVec.x, this.moveVec.y);
        } else {
            if (this.cursors.left.isDown) dir.x = -1; else if (this.cursors.right.isDown) dir.x = 1;
            if (this.cursors.up.isDown) dir.y = -1; else if (this.cursors.down.isDown) dir.y = 1;
        }

        if (dir.lengthSq() > 0) {
            dir.normalize();
            body.setVelocity(dir.x * speed, dir.y * speed);
            if (dir.x < -0.15) this.player.setFlipX(true);
            else if (dir.x > 0.15) this.player.setFlipX(false);
        } else {
            body.setVelocity(0, 0);
        }

        if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.doAction();

        if (!this.attacking) this.player.play('warrior_idle', true);
        this.player.setDepth(this.player.y);

        // NPC AI — 느릿하게 돌아다니기
        if (this.npcs) {
            const wanderSpeed = 40;
            for (const npc of this.npcs) {
                if (!npc.npcData) continue;
                const d = npc.npcData;
                d.dirTimer++;
                // 방향 변경 (3초마다)
                if (d.dirTimer >= d.dirInterval) {
                    d.dirTimer = 0;
                    const angle = Math.random() * Math.PI * 2;
                    d.vx = Math.cos(angle) * wanderSpeed;
                    d.vy = Math.sin(angle) * wanderSpeed;
                }
                // 이동
                d.x += d.vx * 0.016; // deltaTime ~= 0.016 at 60fps
                d.y += d.vy * 0.016;
                npc.setPosition(d.x, d.y);
                npc.setDepth(npc.y);
                // 방향 지정
                if (Math.abs(d.vx) > 0.5) npc.setFlipX(d.vx < 0);

                // 고블린 공격 AI
                if (d.type && d.type.startsWith('goblin')) {
                    const distToPlayer = Phaser.Math.Distance.Between(npc.x, npc.y, this.player.x, this.player.y);
                    if (distToPlayer < 200) {
                        // 범위 내: 플레이어 쪽으로 이동하며 공격
                        const angle = Math.atan2(this.player.y - npc.y, this.player.x - npc.x);
                        d.vx = Math.cos(angle) * wanderSpeed * 1.5;
                        d.vy = Math.sin(angle) * wanderSpeed * 1.5;

                        if (!d.attacking) {
                            d.attacking = true;
                            npc.play(d.type + '_attack');
                        }
                    } else {
                        // 범위 밖: 공격 해제, 무작위 이동으로 돌아감
                        d.attacking = false;
                        d.dirTimer = d.dirInterval; // 다음 틱에 방향 변경
                    }
                }
            }
        }

        // 구름 이동 (월드에서 독립적으로 왼쪽→오른쪽)
        for (const cloud of this.clouds) {
            cloud.sprite.x += cloud.speed * 0.016; // deltaTime
            if (cloud.sprite.x > this.worldW + 200) cloud.sprite.x = -200;
        }
    }

    // ---------- 액션: 스윙 + (근처면) 채집 ----------
    doAction() {
        if (this.attacking) return;
        this.attacking = true;
        this.player.play('warrior_attack');

        let near = null, best = Infinity;
        for (const g of this.gatherables) {
            if (g.depleted) continue;
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, g.sprite.x, g.sprite.y);
            if (d <= g.range && d < best) { best = d; near = g; }
        }
        if (near) this.gather(near);
    }

    gather(g) {
        g.hp -= 1;
        this.resources[g.type] += 1;
        this.updateHud();

        const label = { wood: '+1 Wood', gold: '+1 Gold', meat: '+1 Meat' }[g.type];
        const color = { wood: '#e0a463', gold: '#ffd54a', meat: '#ff9a9a' }[g.type];
        this.floatText(g.sprite.x, g.sprite.y - 40, label, color);

        if (g.hp <= 0) {
            g.depleted = true;
            if (g.type === 'wood') {
                g.sprite.stop();
                g.sprite.setFrame(8);      // 그루터기
                g.sprite.body.enable = false;
            } else {
                g.sprite.destroy();
            }
        }
    }

    floatText(x, y, msg, color) {
        const t = this.add.text(x, y, msg, {
            fontSize: '18px', color: color || '#ffffff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(30000);
        this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    }

    updateHud() {
        const r = this.resources;
        this.hud.setText(`Wood ${r.wood}    Gold ${r.gold}    Meat ${r.meat}`);
    }
}
