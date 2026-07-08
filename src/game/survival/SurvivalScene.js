// 딸기 서바이벌 — Survival Scene (ESM 모듈)
import Phaser from 'phaser';
import { U, F } from '../assets-manifest';
import { UPGRADES, getRandomUpgrade } from './upgrades';


export default class SurvivalScene extends Phaser.Scene {
    constructor() {
        super('SurvivalScene');
    }

    // ---------- 1) 자산 로드 ----------
    preload() {
        // 플레이어
        this.load.spritesheet('warrior', `${U}/Factions/Knights/Troops/Warrior/Blue/Warrior_Blue.png`,
            { frameWidth: 192, frameHeight: 192 });
        // 적 3종 (약함 / 중간 / 강함)
        this.load.spritesheet('e_weak', `${U}/Factions/Goblins/Troops/Torch/Red/Torch_Red.png`,
            { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('e_mid', `${U}/Factions/Goblins/Troops/TNT/Red/TNT_Red.png`,
            { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('e_strong', `${U}/Factions/Goblins/Troops/Barrel/Purple/Barrel_Purple.png`,
            { frameWidth: 192, frameHeight: 192 });
        // 장식 (충돌 없음, 분위기용)
        this.load.spritesheet('tree1', `${F}/Terrain/Resources/Wood/Trees/Tree1.png`, { frameWidth: 192, frameHeight: 256 });
        this.load.spritesheet('tree2', `${F}/Terrain/Resources/Wood/Trees/Tree2.png`, { frameWidth: 192, frameHeight: 256 });
        this.load.spritesheet('tree3', `${F}/Terrain/Resources/Wood/Trees/Tree3.png`, { frameWidth: 192, frameHeight: 192 });
        this.load.spritesheet('tree4', `${F}/Terrain/Resources/Wood/Trees/Tree4.png`, { frameWidth: 192, frameHeight: 192 });
        for (let i = 1; i <= 4; i++) {
            this.load.spritesheet(`bushe${i}`, `${F}/Terrain/Decorations/Bushes/Bushe${i}.png`, { frameWidth: 128, frameHeight: 128 });
        }
        this.load.image('rock1', `${F}/Terrain/Decorations/Rocks/Rock1.png`);
        this.load.image('rock2', `${F}/Terrain/Decorations/Rocks/Rock2.png`);
        // 바닥(잔디) — 타일셋 시트에서 이음매 없는 잔디 영역만 잘라 반복 타일로 사용
        this.load.image('grassSheet', `${F}/Terrain/Tileset/Tilemap_color1.png`);
        // 회전 무기(오비터)
        this.load.image('tool1', `${F}/Terrain/Resources/Tools/Tool_01.png`);
        // 화살 (동쪽을 향한 64x64 2프레임 중 첫 프레임 사용)
        this.load.spritesheet('arrow', `${U}/Factions/Knights/Troops/Archer/Arrow/Arrow.png`, { frameWidth: 64, frameHeight: 64 });
        // 수호 유닛 (노란 워리어)
        this.load.spritesheet('guardian', `${U}/Factions/Knights/Troops/Warrior/Yellow/Warrior_Yellow.png`, { frameWidth: 192, frameHeight: 192 });
        // 골드 (먹으면 퀴즈 발동) — 128x128 6프레임
        this.load.spritesheet('gold', `${F}/Terrain/Resources/Gold/Gold Resource/Gold_Resource_Highlight.png`, { frameWidth: 128, frameHeight: 128 });
    }

    // ---------- 2) 배치 ----------
    create() {
        // --- 애니메이션 ---
        this.anims.create({ key: 'warrior_idle',
            frames: this.anims.generateFrameNumbers('warrior', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
        ['e_weak', 'e_mid', 'e_strong'].forEach((k) => this.anims.create({ key: k + '_idle',
            frames: this.anims.generateFrameNumbers(k, { start: 0, end: 5 }), frameRate: 8, repeat: -1 }));
        ['tree1', 'tree2', 'tree3', 'tree4'].forEach((k) => this.anims.create({ key: k + '_sway',
            frames: this.anims.generateFrameNumbers(k, { start: 0, end: 7 }), frameRate: 4, repeat: -1 }));
        ['bushe1', 'bushe2', 'bushe3', 'bushe4'].forEach((k) => this.anims.create({ key: k + '_sway',
            frames: this.anims.generateFrameNumbers(k, { start: 0, end: 7 }), frameRate: 6, repeat: -1 }));
        this.anims.create({ key: 'guardian_idle',
            frames: this.anims.generateFrameNumbers('guardian', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'gold_spin',
            frames: this.anims.generateFrameNumbers('gold', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });

        // --- 씬 상태 필드 (upgrades.js 가 직접 수정하는 값들) ---
        this.baseSpeed = 150;   // 초반 이동속도(느림) — 복음의 신발 업글로 빨라짐
        this.aura = { active: false, radius: 150, damage: 4, tickInterval: 300, slowFactor: 0 };   // 초반엔 없음 — 오라 계열 업글을 얻어야 생김
        this.shieldCharges = 0;
        this.chainRedeem = { active: false, radius: 100, damage: 15 };
        this.doubleBlessingChance = 0;
        this.redeemedCount = 0;
        this.elapsedMs = 0;
        this.orbiters = { count: 0, radius: 110, speed: 4.6, tickInterval: 220, damage: 30 };   // 회전 망치 — 빠르게 회전, 강한 근접 데미지
        this.arrows = { count: 1, damage: 8, interval: 1500, speed: 540, spread: 0.22, range: 420, pierceChance: 0 };   // 화살 — 사거리 안(range)에 적이 있을 때만 발사, 긴 텀. 데미지 약함(원샷킬 방지), pierceChance = 명중 시 관통 확률(기본 0 → 한 명만 처치)
        this.guardians = { count: 0, maxHp: 50, respawnMs: 6000, blockRange: 48, enemyDps: 12, enemyAttackMs: 550,
                           speed: 140, leash: 280, engageRange: 360, restRadius: 72 };  // 수호 유닛 — 가장 가까운 적에게 능동적으로 가서 막음

        // 진행/누적 상태
        this.gamePaused = false;
        this.spawnAccMs = 0;
        this.auraAccMs = 0;
        this.auraTickCount = 0;
        this.novaPulseEvery = 3;   // 노바가 몇 틱마다 한 번씩 퍼지는지 — 이 간격마다만 데미지 판정(링이 스칠 때만)
        this.orbiterAngle = 0;
        this.orbiterAccMs = 0;
        this.orbiterSprites = [];
        this.arrowAccMs = 0;
        this.guardianUnits = [];
        this.goldAccMs = 0;
        this.goldInterval = 11000;   // 골드 스폰 주기
        this.quizIndex = 0;
        this.quizStats = { correct: 0, total: 0 };
        this.quizBridge = this.game.registry.get('quizBridge') || null;
        this.ended = false;
        // React(일시정지 메뉴) → 씬 제어 이벤트
        this.game.events.on('app:pause', this.appPause, this);
        this.game.events.on('app:resume', this.appResume, this);
        this.game.events.on('app:quit', this.appQuit, this);
        this.events.once('shutdown', () => {
            this.game.events.off('app:pause', this.appPause, this);
            this.game.events.off('app:resume', this.appResume, this);
            this.game.events.off('app:quit', this.appQuit, this);
        });

        // --- 월드 ---
        this.worldW = 2400;
        this.worldH = 2400;
        this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
        this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

        // --- 바닥(잔디) 배경: 타일셋 시트 중 테두리 없는 안전한 내부 영역만 크롭해 반복 타일로 사용 ---
        this.textures.get('grassSheet').add('grassTile', 0, 50, 50, 80, 80);
        this.add.tileSprite(this.worldW / 2, this.worldH / 2, this.worldW, this.worldH, 'grassSheet', 'grassTile')
            .setDepth(-1000);

        this.scatterDeco();   // 배경 장식 분산 (시드 고정, 정적)

        // --- 플레이어 (월드 중앙) ---
        this.player = this.physics.add.sprite(1200, 1200, 'warrior').play('warrior_idle');
        this.player.setScale(0.6);
        this.player.body.setSize(56, 60).setOffset(68, 84);
        this.player.setCollideWorldBounds(true);
        this.player.speed = this.baseSpeed;   // 이동 속도 (업그레이드가 곱연산)
        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

        // --- 오라 시각화: 은은한 범위 테두리(항상) + 노바처럼 주기적으로 퍼지는 펄스(틱마다) ---
        this.auraCircle = this.add.circle(this.player.x, this.player.y, this.aura.radius, 0xffe066, 0)
            .setStrokeStyle(2, 0xffe066, 0.22).setDepth(this.player.y - 1).setVisible(false);
        this._auraDrawn = this.aura.radius;

        // --- 적 그룹 + 충돌 ---
        this.enemies = this.physics.add.group();
        this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, null, this);

        // --- 화살 그룹 + 적 명중 판정 ---
        this.arrowGroup = this.physics.add.group();
        this.physics.add.overlap(this.arrowGroup, this.enemies, this.onArrowHit, null, this);

        // --- 골드 그룹 + 획득 판정 (먹으면 퀴즈) ---
        this.goldGroup = this.physics.add.group();
        this.physics.add.overlap(this.player, this.goldGroup, this.onGoldPickup, null, this);

        // --- 입력 (키보드 + 조이스틱) ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.addPointer(2);
        this.moveVec = new Phaser.Math.Vector2(0, 0);
        this.createTouchControls();

        // --- HUD (화면 고정) ---
        this.hud = this.add.text(16, 14, '', {
            fontSize: '20px', color: '#ffffff', stroke: '#000000', strokeThickness: 4, lineSpacing: 4
        }).setScrollFactor(0).setDepth(20000);
        this.instr = this.add.text(16, 148, '이동: 화살표 / 화면 터치(캐릭터 기준 누른 방향)   ·   무기가 자동으로 적을 구원합니다', {
            fontSize: '14px', color: '#e8e8e8', stroke: '#000000', strokeThickness: 3
        }).setScrollFactor(0).setDepth(20000);
        this.updateHud();

        // --- 획득한 축복(업그레이드) 보기 버튼 (우측 상단) ---
        this.upgradeCounts = {};
        this.skillBtn = this.add.circle(0, 0, 28, 0x2b3a55, 0.85).setScrollFactor(0).setDepth(20000)
            .setStrokeStyle(2, 0xffe066, 0.6).setInteractive({ useHandCursor: true });
        this.skillBtnLabel = this.add.text(0, 0, '📜', { fontSize: '24px' }).setOrigin(0.5).setScrollFactor(0).setDepth(20001);
        this.skillBtn.on('pointerdown', () => { if (!this.gamePaused) this.showUpgradePanel(); });

        this.layoutUI();
        this.scale.on('resize', this.layoutUI, this);
    }

    // ---------- 배경 장식 분산 (충돌 없음) ----------
    scatterDeco() {
        const rng = new Phaser.Math.RandomDataGenerator(['survival-deco']);
        const kinds = ['tree1', 'tree2', 'tree3', 'tree4', 'bushe1', 'bushe2', 'bushe3', 'bushe4', 'rock1', 'rock2'];
        const n = rng.between(30, 40);
        for (let i = 0; i < n; i++) {
            const kind = rng.pick(kinds);
            const x = rng.between(80, this.worldW - 80);
            const y = rng.between(80, this.worldH - 80);
            if (Phaser.Math.Distance.Between(x, y, 1200, 1200) < 220) continue;   // 시작 지점 근처는 비움
            const d = kind.startsWith('rock')
                ? this.add.image(x, y, kind).setScale(0.6)
                : this.add.sprite(x, y, kind).play(kind + '_sway').setScale(0.7);
            d.setDepth(y);   // 정적 — 1회만 정렬
        }
    }

    // ---------- 터치 조작: 조이스틱 없이, 화면상 캐릭터 기준 "누른 방향"으로 이동 ----------
    createTouchControls() {
        this.movePointer = null;
        this.input.on('pointerdown', (p) => {
            if (this.gamePaused) return;        // 퀴즈/게임오버 UI 조작과 충돌 방지
            if (this.overSkillBtn(p)) return;   // 스킬 버튼 위를 누르면 이동 시작 안 함
            this.movePointer = p;
            this.updateMoveDir(p);
        });
        this.input.on('pointerup', (p) => {
            if (this.movePointer === p) { this.movePointer = null; this.moveVec.set(0, 0); }
        });
    }

    layoutUI() {
        const w = this.scale.width;
        // 스킬(축복) 버튼: 우측 상단
        this.skillBtn.setPosition(w - 44, 44);
        this.skillBtnLabel.setPosition(w - 44, 44);
    }

    overSkillBtn(p) {
        return Phaser.Math.Distance.Between(p.x, p.y, this.skillBtn.x, this.skillBtn.y) <= 34;
    }

    // 화면상 캐릭터 위치 → 손가락까지의 방향(정규화)으로 이동 벡터 설정. 가운데 근처(데드존)면 정지.
    updateMoveDir(p) {
        const cam = this.cameras.main;
        const sx = this.player.x - cam.worldView.x;   // 캐릭터의 화면 좌표(zoom 1)
        const sy = this.player.y - cam.worldView.y;
        const v = new Phaser.Math.Vector2(p.x - sx, p.y - sy);
        if (v.length() < 26) { this.moveVec.set(0, 0); return; }   // 데드존
        v.normalize();
        this.moveVec.set(v.x, v.y);
    }

    // ---------- 3) 매 프레임 ----------
    update(time, delta) {
        if (this.gamePaused) return;
        this.elapsedMs += delta;
        const t = this.elapsedMs / 1000;   // 경과 초

        // --- 골드 스폰 (먹으면 퀴즈) ---
        this.goldAccMs += delta;
        if (this.goldAccMs >= this.goldInterval && this.goldGroup.countActive(true) < 3) {
            this.goldAccMs = 0;
            this.spawnGold();
        }

        // --- 적 스폰 (누적 타이머) ---
        this.spawnAccMs += delta;
        const spawnInterval = Math.max(0.4, 2.5 - t / 60) * 1000;
        if (this.spawnAccMs >= spawnInterval) {
            this.spawnAccMs = 0;
            const count = Math.min(6, 1 + Math.floor(t / 45));
            for (let i = 0; i < count; i++) this.spawnEnemy(t);
        }

        // --- 오라 틱 (오라가 활성일 때만) ---
        if (this.aura.active) {
            this.auraAccMs += delta;
            while (this.auraAccMs >= this.aura.tickInterval) {
                this.auraAccMs -= this.aura.tickInterval;
                this.auraTick();
            }
        }

        // --- 회전 무기(오비터) 위치/데미지 갱신 ---
        this.updateOrbiters(delta);

        // --- 화살 발사 (누적 타이머, 가장 가까운 적 자동 조준) ---
        this.arrowAccMs += delta;
        while (this.arrowAccMs >= this.arrows.interval) {
            this.arrowAccMs -= this.arrows.interval;
            this.fireArrows();
        }

        // --- 수호 유닛 위치/재소환 갱신 ---
        this.updateGuardians(delta);

        // --- 적 이동/정렬 (수호 유닛과 교전 중이면 멈추고 공격) ---
        for (const e of this.enemies.getChildren()) {
            if (!e.active || e.redeeming) continue;
            const g = this.nearestGuardian(e);
            if (g && Phaser.Math.Distance.Between(e.x, e.y, g.sprite.x, g.sprite.y) <= this.guardians.blockRange) {
                e.body.setVelocity(0, 0);   // 유닛이 길을 막음
                e.setFlipX(g.sprite.x < e.x);
                e.attackAccMs = (e.attackAccMs || 0) + delta;
                if (e.attackAccMs >= this.guardians.enemyAttackMs) {
                    e.attackAccMs = 0;
                    this.enemyAttackGuardian(e, g);
                }
            } else {
                let sp = e.moveSpeed;
                const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
                if (this.aura.active && d <= this.aura.radius) sp *= (1 - this.aura.slowFactor);   // 오라 활성 + 범위 안이면 감속
                this.physics.moveToObject(e, this.player, sp);
                e.setFlipX(this.player.x < e.x);
            }
            e.setDepth(e.y);
            this.updateEnemyBar(e);
        }

        // --- 플레이어 이동 (터치 우선, 없으면 방향키) ---
        // 터치 유지 중이면 매 프레임 "캐릭터→손가락" 방향을 다시 계산 (계속 그 방향으로 이동)
        if (this.movePointer && this.movePointer.isDown) this.updateMoveDir(this.movePointer);
        else if (this.movePointer && !this.movePointer.isDown) { this.movePointer = null; this.moveVec.set(0, 0); }
        const body = this.player.body;
        const dir = new Phaser.Math.Vector2(0, 0);
        if (this.moveVec.lengthSq() > 0.03) {
            dir.set(this.moveVec.x, this.moveVec.y);
        } else {
            if (this.cursors.left.isDown) dir.x = -1; else if (this.cursors.right.isDown) dir.x = 1;
            if (this.cursors.up.isDown) dir.y = -1; else if (this.cursors.down.isDown) dir.y = 1;
        }
        if (dir.lengthSq() > 0) {
            dir.normalize();
            body.setVelocity(dir.x * this.player.speed, dir.y * this.player.speed);
            if (dir.x < -0.15) this.player.setFlipX(true);
            else if (dir.x > 0.15) this.player.setFlipX(false);
        } else {
            body.setVelocity(0, 0);
        }
        this.player.play('warrior_idle', true);
        this.player.setDepth(this.player.y);

        // --- 오라 원 갱신 (활성일 때만 표시, 항상 플레이어 바로 아래) ---
        this.auraCircle.setVisible(this.aura.active).setPosition(this.player.x, this.player.y).setDepth(this.player.y - 1);
        if (this._auraDrawn !== this.aura.radius) {
            this.auraCircle.setRadius(this.aura.radius);
            this._auraDrawn = this.aura.radius;
        }

        this.updateHud();
    }

    // ---------- 적 스폰 ----------
    spawnEnemy(t) {
        // 티어 해금: 약함 t>=0, 중간 t>=60, 강함 t>=150 (체력 증가는 각 티어 "등장 시점부터" 누적 — 등장 직후 과도하게 세지는 것 방지)
        const tiers = [{ key: 'e_weak', hp: 10, speedMul: 1, unlock: 0 }];
        if (t >= 60) tiers.push({ key: 'e_mid', hp: 24, speedMul: 1, unlock: 60 });
        if (t >= 150) tiers.push({ key: 'e_strong', hp: 60, speedMul: 0.5, unlock: 150 });
        const tier = Phaser.Utils.Array.GetRandom(tiers);

        // 스폰 위치: 카메라 뷰 바깥 원주상의 무작위 각도
        // (플레이어가 월드 가장자리 근처일 때 좌표를 그냥 clamp하면 "먼 거리"가 무너져 바로 옆에 스폰될 수 있어,
        //  경계 안에 들어오는 각도가 나올 때까지 몇 번 다시 뽑고 최후에만 clamp)
        const cam = this.cameras.main;
        const r = Math.sqrt(cam.width * cam.width + cam.height * cam.height) / 2 + 150;
        let x, y;
        for (let attempt = 0; attempt < 8; attempt++) {
            const ang = Math.random() * Math.PI * 2;
            x = this.player.x + Math.cos(ang) * r;
            y = this.player.y + Math.sin(ang) * r;
            if (x >= 60 && x <= this.worldW - 60 && y >= 60 && y <= this.worldH - 60) break;
        }
        x = Phaser.Math.Clamp(x, 60, this.worldW - 60);
        y = Phaser.Math.Clamp(y, 60, this.worldH - 60);

        const e = this.enemies.create(x, y, tier.key).play(tier.key + '_idle');
        e.setScale(0.6);
        e.body.setSize(56, 60).setOffset(68, 84);
        e.hp = Math.floor(tier.hp * (1 + (t - tier.unlock) / 60));
        e.maxHp = e.hp;
        e.moveSpeed = 90 * tier.speedMul * (1 + Math.min(0.5, t / 300));   // 시간 경과에 따라 이동속도도 최대 +50%까지 증가
        e.redeeming = false;
        // 체력바 (피격 전에는 숨김 — 데미지를 입으면 발밑에 표시)
        e.barBg = this.add.rectangle(x, y, 40, 6, 0x000000, 0.6).setVisible(false);
        e.barFill = this.add.rectangle(x, y, 38, 4, 0xff5555, 1).setOrigin(0, 0.5).setVisible(false);
    }

    // 몬스터 체력바 — 피격당한(hp < maxHp) 적만 발밑에 표시, 남은 비율만큼 왼쪽부터 채움
    updateEnemyBar(e) {
        if (!e.barBg) return;
        const damaged = e.hp < e.maxHp;
        e.barBg.setVisible(damaged);
        e.barFill.setVisible(damaged);
        if (!damaged) return;
        const ratio = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1);
        const by = e.y + 36;   // 캐릭터 발밑
        e.barBg.setPosition(e.x, by).setDepth(e.y + 1);
        e.barFill.setPosition(e.x - 19, by).setDepth(e.y + 2).setScale(ratio, 1);   // 원점(0,0.5) → 왼쪽 고정
    }

    // ---------- 오라 틱: 노바 발사 스케줄러 (데미지는 여기서 주지 않음 — 링이 스칠 때만 novaHitCheck에서 처리) ----------
    auraTick() {
        this.auraTickCount++;
        if (this.auraTickCount % this.novaPulseEvery === 0) this.novaPulse();
    }

    // 소서리스 노바처럼 캐릭터 중심에서 퍼지는 링 — 이 링의 가장자리가 실제로 스친 적만 데미지를 받음
    novaPulse() {
        const ring = this.add.circle(this.player.x, this.player.y, 8, 0xffe066, 0)
            .setStrokeStyle(4, 0xffe066, 0.75).setDepth(this.player.y + 40);
        ring.hitEnemies = new Set();
        ring.prevRadius = 0;
        this.tweens.add({
            targets: ring,
            radius: this.aura.radius,
            alpha: 0,
            duration: Math.min(900, this.aura.tickInterval * this.novaPulseEvery * 0.75),
            ease: 'Cubic.Out',
            onUpdate: () => {
                ring.setPosition(this.player.x, this.player.y);
                this.novaHitCheck(ring);
                ring.prevRadius = ring.radius;
            },
            onComplete: () => ring.destroy()
        });
    }

    // 노바 링의 가장자리가 막 지나간(prevRadius < 거리 <= 현재 radius) 적에게만 1회 데미지
    novaHitCheck(ring) {
        for (const e of [...this.enemies.getChildren()]) {
            if (!e.active || e.redeeming || ring.hitEnemies.has(e)) continue;
            const dist = Phaser.Math.Distance.Between(ring.x, ring.y, e.x, e.y);
            if (dist <= ring.radius && dist > ring.prevRadius) {
                ring.hitEnemies.add(e);
                e.hp -= this.aura.damage;
                if (e.hp <= 0) { this.redeemEnemy(e); continue; }
                this.tweens.add({ targets: e, alpha: 0.35, duration: 90, yoyo: true });   // 피격 시 깜빡임
            }
        }
    }

    // 회전 무기(오비터=망치) 위치/개수 갱신 — 자체 강한 데미지(orbiters.damage), 명중 시 깜빡임
    updateOrbiters(delta) {
        while (this.orbiterSprites.length < this.orbiters.count) {
            const s = this.add.image(this.player.x, this.player.y, 'tool1').setScale(0.5);
            this.orbiterSprites.push(s);
        }
        this.orbiterAngle += this.orbiters.speed * (delta / 1000);
        const n = this.orbiterSprites.length;
        for (let i = 0; i < n; i++) {
            const ang = this.orbiterAngle + (i * Math.PI * 2) / n;
            const s = this.orbiterSprites[i];
            s.setPosition(this.player.x + Math.cos(ang) * this.orbiters.radius, this.player.y + Math.sin(ang) * this.orbiters.radius);
            s.setDepth(this.player.y + 60);
        }

        if (n === 0) return;
        this.orbiterAccMs += delta;
        while (this.orbiterAccMs >= this.orbiters.tickInterval) {
            this.orbiterAccMs -= this.orbiters.tickInterval;
            for (const s of this.orbiterSprites) {
                for (const e of [...this.enemies.getChildren()]) {
                    if (!e.active || e.redeeming) continue;
                    if (Phaser.Math.Distance.Between(s.x, s.y, e.x, e.y) <= 40) {
                        e.hp -= this.orbiters.damage;
                        if (e.hp <= 0) { this.redeemEnemy(e); continue; }
                        this.tweens.add({ targets: e, alpha: 0.35, duration: 90, yoyo: true });
                    }
                }
            }
        }
    }

    // ---------- 화살: 가장 가까운 적 자동 조준 ----------
    nearestEnemy(fromX, fromY) {
        let best = null, bestD = Infinity;
        for (const e of this.enemies.getChildren()) {
            if (!e.active || e.redeeming) continue;
            const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    }

    fireArrows() {
        const target = this.nearestEnemy(this.player.x, this.player.y);
        if (!target) return;   // 적 없으면 발사 안 함
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y) > this.arrows.range) return;   // 사거리 밖(화면 밖 멀리)이면 발사 안 함
        const base = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        const n = this.arrows.count;
        for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * this.arrows.spread;   // 여러 발이면 부채꼴로 퍼짐(멀티샷)
            const a = this.arrowGroup.create(this.player.x, this.player.y, 'arrow').setScale(0.7);
            a.setRotation(ang);   // 화살 그림이 동쪽을 향하므로 보정 불필요
            a.damage = this.arrows.damage;
            a.hitSet = new Set();                // 관통 중 같은 적 중복 타격 방지
            a.setDepth(this.player.y + 50);
            this.physics.velocityFromRotation(ang, this.arrows.speed, a.body.velocity);
            this.time.addEvent({ delay: 1400, callback: () => { if (a.active) a.destroy(); } });   // 일정 시간 후 소멸
        }
    }

    onArrowHit(arrow, enemy) {
        if (!arrow.active || !enemy.active || enemy.redeeming) return;
        if (arrow.hitSet && arrow.hitSet.has(enemy)) return;   // 관통 중 이미 맞힌 적은 통과
        if (arrow.hitSet) arrow.hitSet.add(enemy);
        enemy.hp -= arrow.damage;
        if (enemy.hp <= 0) this.redeemEnemy(enemy);
        else this.tweens.add({ targets: enemy, alpha: 0.35, duration: 90, yoyo: true });
        // 관통: 명중할 때마다 낮은 확률로만 통과, 대부분은 여기서 소멸(한 명만 처치)
        if (Math.random() >= this.arrows.pierceChance) arrow.destroy();
    }

    // ---------- 수호 유닛: 적 이동 방해 + 몸빵(체력/재소환) ----------
    updateGuardians(delta) {
        // 개수 업글에 맞춰 유닛 생성
        while (this.guardianUnits.length < this.guardians.count) {
            const sprite = this.add.sprite(this.player.x, this.player.y, 'guardian').play('guardian_idle').setScale(0.6);
            const barBg = this.add.rectangle(0, 0, 40, 6, 0x000000, 0.6);
            const barFill = this.add.rectangle(0, 0, 38, 4, 0x66dd66, 1).setOrigin(0, 0.5);
            this.guardianUnits.push({ sprite, barBg, barFill, hp: this.guardians.maxHp, alive: true, respawnLeft: 0 });
        }
        const dt = delta / 1000;
        const n = this.guardianUnits.length;
        for (let i = 0; i < n; i++) {
            const g = this.guardianUnits[i];
            if (g.alive) {
                // 목표: 플레이어 주변(engageRange) 안에서 이 유닛에 가장 가까운 적 → 능동적으로 막으러 감
                const target = this.nearestEnemyNear(g.sprite.x, g.sprite.y, this.player.x, this.player.y, this.guardians.engageRange);
                let tx, ty, hold = false;
                if (target) {
                    tx = target.x; ty = target.y;
                    if (Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, tx, ty) <= this.guardians.blockRange * 0.8) hold = true;   // 붙었으면 멈춰서 막음
                } else {
                    // 적 없으면 플레이어 주위 대형 위치로 복귀
                    const ang = (i / n) * Math.PI * 2 + this.elapsedMs / 6000;
                    tx = this.player.x + Math.cos(ang) * this.guardians.restRadius;
                    ty = this.player.y + Math.sin(ang) * this.guardians.restRadius;
                    if (Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, tx, ty) <= 6) hold = true;
                }
                let gx = g.sprite.x, gy = g.sprite.y;
                if (!hold) {
                    const ang = Math.atan2(ty - gy, tx - gx);
                    const nx = gx + Math.cos(ang) * this.guardians.speed * dt;
                    const ny = gy + Math.sin(ang) * this.guardians.speed * dt;
                    g.sprite.setFlipX(nx < gx);
                    gx = nx; gy = ny;
                    // 플레이어에서 너무 멀어지지 않게 리쉬(leash)
                    const dpx = gx - this.player.x, dpy = gy - this.player.y;
                    const dp = Math.hypot(dpx, dpy);
                    if (dp > this.guardians.leash) { gx = this.player.x + dpx / dp * this.guardians.leash; gy = this.player.y + dpy / dp * this.guardians.leash; }
                }
                g.sprite.setPosition(gx, gy).setDepth(gy);
                const ratio = Phaser.Math.Clamp(g.hp / this.guardians.maxHp, 0, 1);
                g.barBg.setPosition(gx, gy - 44).setDepth(gy + 1).setVisible(true);
                g.barFill.setPosition(gx - 19, gy - 44).setDepth(gy + 2).setScale(ratio, 1).setVisible(true);   // 원점(0,0.5) → 왼쪽부터 줄어듦
            } else {
                g.respawnLeft -= delta;
                g.barBg.setVisible(false);
                g.barFill.setVisible(false);
                if (g.respawnLeft <= 0) {   // 재소환 (플레이어 곁에서)
                    g.hp = this.guardians.maxHp;
                    g.alive = true;
                    g.sprite.setVisible(true).setAlpha(1).setPosition(this.player.x, this.player.y);
                }
            }
        }
    }

    // (fromX,fromY)에 가장 가까우면서, (ax,ay)에서 aRange 안에 있는 적 반환
    nearestEnemyNear(fromX, fromY, ax, ay, aRange) {
        let best = null, bestD = Infinity;
        for (const e of this.enemies.getChildren()) {
            if (!e.active || e.redeeming) continue;
            if (Phaser.Math.Distance.Between(ax, ay, e.x, e.y) > aRange) continue;
            const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    }

    nearestGuardian(e) {
        let best = null, bestD = Infinity;
        for (const g of this.guardianUnits) {
            if (!g.alive) continue;
            const d = Phaser.Math.Distance.Between(e.x, e.y, g.sprite.x, g.sprite.y);
            if (d < bestD) { bestD = d; best = g; }
        }
        return best;
    }

    enemyAttackGuardian(e, g) {
        // 공격 모션(살짝 커졌다 돌아오는 펀치)
        this.tweens.add({ targets: e, scaleX: e.scaleX * 1.2, scaleY: e.scaleY * 1.2, duration: 110, yoyo: true });
        g.hp -= this.guardians.enemyDps;
        if (g.hp <= 0) this.killGuardian(g);
    }

    killGuardian(g) {
        g.alive = false;
        g.respawnLeft = this.guardians.respawnMs;
        g.sprite.setVisible(false);
        const poof = this.add.circle(g.sprite.x, g.sprite.y, 20, 0xffffff, 0.5).setDepth(g.sprite.y + 5);
        this.tweens.add({ targets: poof, scale: 2, alpha: 0, duration: 300, onComplete: () => poof.destroy() });
    }

    // ---------- 구원 처리 (적 HP 0 이하) ----------
    redeemEnemy(enemy) {
        if (!enemy || !enemy.active || enemy.redeeming) return;
        enemy.redeeming = true;
        if (enemy.body) enemy.body.enable = false;
        if (enemy.barBg) enemy.barBg.destroy();       // 체력바 정리
        if (enemy.barFill) enemy.barFill.destroy();
        const x = enemy.x, y = enemy.y;

        // 연출: 흰색→금색 tint, 확대 + 페이드아웃
        enemy.setTint(0xffffff);
        this.tweens.addCounter({ from: 0, to: 1, duration: 120, onComplete: () => { if (enemy.active) enemy.setTint(0xffd700); } });
        this.tweens.add({
            targets: enemy, scaleX: enemy.scaleX * 1.3, scaleY: enemy.scaleY * 1.3, alpha: 0,
            duration: 300, onComplete: () => enemy.destroy()
        });
        this.redeemParticles(x, y);
        this.floatText(x, y - 40, '구원됨', '#ffd700');

        // 구원 수 (더블 블레싱 확률로 2배)
        this.redeemedCount += (Math.random() < this.doubleBlessingChance ? 2 : 1);

        // 연쇄 구원 (반경 내 다른 적에게 데미지, redeeming 플래그로 중복 방지)
        if (this.chainRedeem.active) {
            for (const e of [...this.enemies.getChildren()]) {
                if (e === enemy || !e.active || e.redeeming) continue;
                if (Phaser.Math.Distance.Between(x, y, e.x, e.y) <= this.chainRedeem.radius) {
                    e.hp -= this.chainRedeem.damage;
                    if (e.hp <= 0) this.redeemEnemy(e);
                }
            }
        }

        // 퀴즈 트리거 (일시정지 중이면 다음 트리거는 무시 → 중복 방지)
        if (!this.gamePaused && this.redeemedCount >= this.nextQuizThreshold(this.quizIndex + 1)) {
            this.quizIndex++;
            this.showQuiz();
        }
    }

    // 구원 파티클 — 작은 금색 원이 위로 올라가며 사라짐
    redeemParticles(x, y) {
        const n = Phaser.Math.Between(8, 12);
        for (let i = 0; i < n; i++) {
            const p = this.add.circle(x + Phaser.Math.Between(-16, 16), y + Phaser.Math.Between(-12, 8),
                Phaser.Math.Between(3, 6), 0xffd700, 0.9).setDepth(y + 100);
            this.tweens.add({
                targets: p, y: p.y - Phaser.Math.Between(40, 80), alpha: 0,
                duration: Phaser.Math.Between(400, 700), ease: 'Sine.Out', onComplete: () => p.destroy()
            });
        }
    }

    // ---------- 골드: 스폰 + 획득 시 퀴즈 ----------
    spawnGold() {
        const ang = Math.random() * Math.PI * 2;
        const r = Phaser.Math.Between(200, 460);
        const x = Phaser.Math.Clamp(this.player.x + Math.cos(ang) * r, 60, this.worldW - 60);
        const y = Phaser.Math.Clamp(this.player.y + Math.sin(ang) * r, 60, this.worldH - 60);
        const g = this.goldGroup.create(x, y, 'gold').play('gold_spin').setScale(0.55);
        g.setDepth(y);
    }

    onGoldPickup(player, gold) {
        if (this.gamePaused || !gold.active) return;
        gold.destroy();
        this.floatText(player.x, player.y - 40, '골드 획득! 퀴즈', '#ffd54a');
        this.showQuiz();   // 골드 먹으면 퀴즈 → 정답 시 업글
    }

    // 위로 뜨며 페이드아웃하는 플로팅 텍스트
    floatText(x, y, msg, color) {
        const t = this.add.text(x, y, msg, {
            fontSize: '18px', color: color || '#ffffff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(30000);
        this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    }

    // ---------- 충돌: 적이 플레이어에 스침 ----------
    onPlayerHit(player, enemy) {
        if (this.gamePaused || enemy.redeeming) return;
        if (this.shieldCharges > 0) {
            this.shieldCharges--;      // 보호막 소모 → 그 적을 구원하고 잠깐 무적 깜빡임
            this.redeemEnemy(enemy);
            this.tweens.add({ targets: this.player, alpha: 0.3, duration: 90, yoyo: true, repeat: 4,
                onComplete: () => this.player.setAlpha(1) });
        } else {
            this.endGame('death');       // 1히트 사망
        }
    }

    // ---------- 퀴즈 임계값 (n = 1부터 시작하는 회차) ----------
    nextQuizThreshold(n) { return 2 * n * n + 6 * n; }   // 초반엔 자주, 점점 뜸하게 — 8, 20, 36, 56, 80, 108 ...

    // ---------- 퀴즈 표시 (DOM 오버레이 브리지) ----------
    //  캔버스에 직접 그리지 않고 React 오버레이에 퀴즈를 요청한다(설계 §7-4).
    //  게임은 그동안 일시정지, 정답이면 업그레이드 적용 후 재개. 문제 데이터는 앱이 소유.
    showQuiz() {
        if (this.gamePaused) return;
        this.pauseGame();

        const bridge = this.quizBridge;
        if (!bridge) { this.resumeGame(); return; }   // 브리지 없으면(단독 실행) 스킵

        bridge.requestQuiz().then(({ correct }) => {
            this.quizStats.total++;
            if (correct) {
                this.quizStats.correct++;
                const up = getRandomUpgrade();
                up.apply(this);
                this.upgradeCounts[up.id] = (this.upgradeCounts[up.id] || 0) + 1;
                this.quizToast(up.name);
            }
            this.resumeGame();
            this.updateHud();
        });
    }

    // 업그레이드 획득 토스트
    quizToast(name) {
        const w = this.scale.width, h = this.scale.height;
        const t = this.add.text(w / 2, h * 0.15, `축복 획득: ${name}`, {
            fontSize: '24px', color: '#ffd700', stroke: '#000000', strokeThickness: 4, align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(45000);
        this.tweens.add({ targets: t, y: h * 0.11, alpha: 0, delay: 500, duration: 900, onComplete: () => t.destroy() });
    }

    // ---------- 획득한 축복(업그레이드) 목록 창 ----------
    showUpgradePanel() {
        this.pauseGame();
        const w = this.scale.width, h = this.scale.height, D = 40000;
        const ui = [];
        ui.push(this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.75).setScrollFactor(0).setDepth(D));
        ui.push(this.add.text(w / 2, h * 0.12, '획득한 축복', {
            fontSize: '28px', color: '#ffd700', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1));

        const entries = Object.entries(this.upgradeCounts);
        if (entries.length === 0) {
            ui.push(this.add.text(w / 2, h * 0.3, '아직 획득한 축복이 없습니다', {
                fontSize: '20px', color: '#cccccc'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1));
        } else {
            const startY = h * 0.22, rowH = 44;
            entries.forEach(([id, count], i) => {
                const def = UPGRADES.find((u) => u.id === id);
                if (!def) return;
                ui.push(this.add.text(w / 2, startY + i * rowH, `${def.name} (${def.desc}) ×${count}`, {
                    fontSize: '19px', color: '#ffffff', stroke: '#000000', strokeThickness: 2, align: 'center',
                    wordWrap: { width: Math.min(700, w - 80) }
                }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1));
            });
        }

        const by = h * 0.86;
        const closeBtn = this.add.rectangle(w / 2, by, 200, 58, 0x8e2b2b, 1).setScrollFactor(0)
            .setDepth(D + 1).setStrokeStyle(2, 0xffffff, 0.6).setInteractive({ useHandCursor: true });
        const closeLabel = this.add.text(w / 2, by, '닫기', { fontSize: '22px', color: '#ffffff' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(D + 2);
        ui.push(closeBtn, closeLabel);
        closeBtn.on('pointerdown', () => { ui.forEach((o) => o.destroy()); this.resumeGame(); });
    }

    // ---------- 게임 종료 → 앱에 결과 전달 (저장·결과화면은 React가 담당) ----------
    //  죽음 또는 일시정지→그만하기 모두 여기로 수렴한다(설계 §8). 한 판 1회만.
    endGame(reason) {
        if (this.ended) return;
        this.ended = true;
        this.pauseGame();
        const sec = Math.floor(this.elapsedMs / 1000);
        const kills = this.redeemedCount;               // 구원(처치) 수
        const score = kills * 10 + sec;                 // 처치 가중 + 생존 시간
        const bridge = this.quizBridge;
        if (bridge && bridge.onGameOver) {
            bridge.onGameOver({ score, kills, seconds: sec, reason: reason || 'death' });
        }
    }

    // React 일시정지 메뉴 제어
    appPause() { if (!this.ended && !this.gamePaused) this.pauseGame(); }
    appResume() { if (!this.ended && this.gamePaused) this.resumeGame(); }
    appQuit() { this.endGame('quit'); }

    // ---------- 일시정지 / 재개 ----------
    pauseGame() { this.gamePaused = true; this.physics.pause(); this.time.timeScale = 0; }
    resumeGame() { this.gamePaused = false; this.physics.resume(); this.time.timeScale = 1; }

    // time.timeScale=0(일시정지) 중에도 동작하는 지연 (트윈은 timeScale 영향 없음)
    delayPaused(ms, cb) { this.tweens.addCounter({ from: 0, to: 1, duration: ms, onComplete: cb }); }

    // ---------- HUD ----------
    fmtTime(sec) {
        return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }

    updateHud() {
        const need = Math.max(0, this.nextQuizThreshold(this.quizIndex + 1) - this.redeemedCount);
        this.hud.setText([
            `시간 ${this.fmtTime(Math.floor(this.elapsedMs / 1000))}`,
            `구원 ${this.redeemedCount}`,
            `다음 퀴즈까지 ${need}`,
            `🏹 ×${this.arrows.count}   관통 ${Math.round(this.arrows.pierceChance * 100)}%`,
            `퀴즈 ${this.quizStats.correct}/${this.quizStats.total}`,
        ]);
    }
}
