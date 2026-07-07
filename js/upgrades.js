// 업그레이드(축복) 목록 — 화살 계열만 운용
//  · 다중 화살 : 한 번에 쏘는 화살 개수 +1 (부채꼴 멀티샷)
//  · 빠른 손놀림 : 발사 간격 단축 (연사속도 ↑)
//  · 관통     : 명중 시 화살이 소멸하지 않고 관통할 "확률" +10% (기본은 한 명만 처치)
const UPGRADES = [
  {
    id: 'arrow_count',
    name: '다중 화살',
    desc: '화살 개수 +1',
    apply(scene) { scene.arrows.count = Math.min(8, scene.arrows.count + 1); }
  },
  {
    id: 'arrow_rate',
    name: '빠른 손놀림',
    desc: '화살 발사 속도 증가',
    apply(scene) { scene.arrows.interval = Math.max(250, scene.arrows.interval * 0.85); }
  },
  {
    id: 'arrow_pierce',
    name: '관통',
    desc: '관통 확률 +10%',
    apply(scene) { scene.arrows.pierceChance = Math.min(0.6, scene.arrows.pierceChance + 0.1); }
  }
];

function getRandomUpgrade() {
  return UPGRADES[Math.floor(Math.random() * UPGRADES.length)];
}
