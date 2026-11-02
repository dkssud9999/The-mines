# 잔향의 광산 위키

`index.html`을 브라우저에서 열면 됩니다. 게임과 같은 서버에 두면 `/wiki/`로 접근할 수 있습니다. 별도 서버, 설치, 외부 폰트, API 또는 인터넷 연결 없이 작동합니다.

## 구성

- 127개 문서, 대문, 소스 원문: 각각 독립 HTML. JavaScript를 끄더라도 문서 본문과 링크는 읽을 수 있습니다.
- 무기 3종, 1차 진화 9종, 2차 진화 18종, 유물 41종을 개별 기록합니다.
- 보스 3종, 일반·정예·소환 적 7종, 보스 패턴 14종, 전투·진행 시스템 15종, 난이도 4종, 시너지 4종을 기록합니다.
- 본문 검색, 분류 필터, 문서 목차, 강화 경로, 피격 계산기, 어두운 테마, 모바일 메뉴, 인쇄 레이아웃을 제공합니다.
- 현재 게임의 이미지 에셋을 참조합니다. `wiki` 폴더만 이동하지 말고 루트의 `assets`도 함께 유지하세요.

## 갱신

루트에서 Node.js로 실행합니다.

```sh
node scripts/build-wiki.cjs
```

현재 PC처럼 Node.js가 PATH에 없고 VS Code가 설치되어 있다면 PowerShell에서 아래처럼 실행할 수도 있습니다.

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& 'C:\Program Files\Microsoft VS Code\Code.exe' scripts/build-wiki.cjs
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

생성기는 루트 `index.html`에서 무기·진화·유물·시너지·보스 패턴·체력 데이터를 추출하고 소스 줄 링크를 생성합니다. `scripts/wiki-content.cjs`는 코드에서 확인한 한국어 설명과 계산식을 보관합니다. 로직을 수정하면 관련 서술과 예시도 갱신해야 합니다. CSS와 UI 동작은 `wiki.css`, `wiki.js`에서 편집합니다. 생성된 문서 HTML을 직접 편집하면 다음 생성 때 덮어씁니다.

`manifest.json`은 문서 목록과 기준 게임 소스의 SHA-256 앞 12자리를 기록합니다. `source.html`은 그 기준 소스를 실행하지 않는 이스케이프된 원문입니다. 실제 측정하지 않은 DPS·클리어율을 사실처럼 기록하지 않으며, 계산 예시와 공략 관찰을 구분합니다.
