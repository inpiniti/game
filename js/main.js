// 게임 전역 설정 (Game Config)
// - Phaser v3 기준입니다.
const config = {
    type: Phaser.AUTO,          // WebGL 우선, 안되면 Canvas 자동 선택
    parent: 'game',             // index.html 의 <div id="game"> 안에 캔버스를 넣음
    backgroundColor: '#4e7d33', // 잔디 밖 여백 색
    // 화면을 꽉 채움(검은 여백 없음). 캐릭터·타일은 원래 크기 그대로,
    // 화면이 작으면 맵을 더 좁게/크면 더 넓게 보여줌 (카메라가 기사 추적)
    scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false        // true 로 바꾸면 충돌 박스가 초록 선으로 보입니다(디버깅용)
        }
    },
    scene: [SurvivalScene, MainScene]
};

// 게임 시작
const game = new Phaser.Game(config);
