# 별빛 타워 디펜스

SION WORLD의 Canvas 타워 디펜스. 설치와 빌드 없이 동작합니다.

저장소 루트에서 `node bomberman/serve.cjs`를 실행하고 `/sion-world/tower-defense/`로 접속하세요. 정적 호스팅 및 파일 직접 열기를 지원합니다.

3개 지도 × 쉬움/보통, 15웨이브, 4종 타워, 3단계 강화, 70% 판매 환급, 5종 몬스터, 5·10·15웨이브 보스. 클릭/터치로 타워를 선택하고 잔디에 건설합니다. 1~4로 타워 선택, 게임판에서 방향키와 Enter로 건설, P로 일시정지, Esc로 선택 해제. 설정을 바꾸거나 새 게임을 시작하면 현재 판은 초기화됩니다.

기록 및 음소거 설정은 `sion-world-tower-defense-v1` localStorage에 저장합니다. 진행 중인 판은 저장하지 않으며 저장소 사용이 불가능해도 플레이할 수 있습니다. 창 이탈 시 자동 정지합니다. 소리는 기본 꺼짐이며 Web Audio 합성음을 사용합니다.

- `engine.js`: DOM 없는 전투/경제/진행 규칙.
- `game.js`: Canvas, UI, 입력, 소리, 저장.
- `assets/`: 직접 작성한 SVG 아이콘/홈 미리보기.
- 테스트(Node 24): `node --test --test-isolation=none tower-defense/tests/*.test.cjs`
