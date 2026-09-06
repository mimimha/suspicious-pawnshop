# 오디오 출처

## 라이선스 확인

- 확인일: 2026-08-25
- 아래 Pixabay 효과음 원본 페이지는 모두 `Free for use under the Pixabay Content License`로
  표시되며, 해당 라이선스는 제작자 표기 없이 사용·수정할 수 있도록 허용한다.
- 단, 원본·편집본 음원을 게임과 분리된 독립 파일로 재판매·재배포하거나, 음원 자체를
  상표·로고처럼 독점 등록하는 사용은 허용되지 않는다. 게임에 효과음으로 포함하는 현재
  사용 방식은 허용 범위다.
- 출처 표시는 의무가 아니지만 향후 증빙과 교체 이력을 위해 이 파일에는 계속 보존한다.

## 배경음악

- 제목: `Cinematic Mysterious music drama and suspens FULL`
- 제작자: zec53
- 출처: https://pixabay.com/music/cartoons-cinematic-mysterious-music-drama-and-suspens-full-534913/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/zec53-cinematic-mysterious-original.mp3`
- 게임 내 파일: `public/assets/audio/music/mysterious-pawnshop-bgm.mp3`
- 비고: 사용자 선정 확정곡. Pixabay에서 Content ID 등록 표시가 있어 원본 페이지와 라이선스
  기록을 증빙으로 보관한다. 런타임에서 끝·시작 4초 크로스페이드 루프를 적용한다.

- 제목: `Medieval: Market Day` (`Loop_Market_Day.mp3`)
- 제작자: RandomMind
- 출처: https://opengameart.org/content/medieval-market-day
- 라이선스: CC0 1.0 (퍼블릭 도메인 기증)
- 게임 내 파일: `public/assets/audio/music/market-day-loop.mp3`
- 비고: 출처 표기는 필수가 아니지만 자산 추적을 위해 기록한다. 사용자 피드백에 따라 현재
  런타임에서는 로드·재생하지 않는 교체 대기 후보이며, 새 BGM이 정해질 때까지 원본만 보존한다.

## 효과음

- `coin.wav`, `reject.wav`는 이 프로젝트의 `scripts/generate-sfx.mjs`로 절차적으로
  생성한 프로젝트 자체 자산이다. 현재 런타임에서는 사용하지 않는다.

### 공통 버튼 클릭

- 제목: `Button click vintage sound FX`
- 제작자: thepixelguymaker
- 출처: https://pixabay.com/sound-effects/film-special-effects-button-click-vintage-sound-fx-541135/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/button-click-vintage-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/ui-click.wav`
- 편집: 앞 무음 20ms를 제거하고 첫 단발 클릭 205ms만 추출, 하이패스·음량 정규화·끝 페이드 적용
- 재편집 명령: `scripts/process-shutter-audio.ps1`
- 표기: Pixabay Content License상 제작자 표기는 필수가 아니지만 자산 추적을 위해 이 문서에 기록함.

### 판매 완료 계산대

- 제목: `Cash Register Purchase`
- 제작자: Zott820 (Pixabay의 freesound_community 배포)
- 출처: https://pixabay.com/sound-effects/film-special-effects-cash-register-purchase-87313/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/cash-register-purchase-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/cash-register.wav`
- 편집: 앞 무음 약 0.1초와 뒤 무음 약 1.25초를 제거해 1.55초로 추출하고 마지막 0.35초 페이드아웃 적용
- 재편집 명령: `scripts/process-shutter-audio.ps1`
- 표기: 제작자 표기는 필수가 아니지만 자산 추적을 위해 이 문서에 기록함.

### DAY 숫자 교체

- 제목: `Camera Shutter`
- 제작자: ftpalad (Pixabay의 freesound_community 배포)
- 출처: https://pixabay.com/sound-effects/film-special-effects-camera-shutter-107889/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/camera-shutter-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/day-number-swap.wav`
- 편집: 원본의 약 0.65초 선행 무음과 약 0.97초 후행 무음을 제거해 단일 셔터 타격 0.22초만 추출하고 마지막 0.05초 페이드아웃 적용
- 재편집 명령: `scripts/process-shutter-audio.ps1`
- 표기: 제작자 표기는 필수가 아니지만 자산 추적을 위해 이 문서에 기록함.

### 상점·판매·매입품 창 열림

- 제목: `Shop door bell`
- 제작자: 775noise (Pixabay의 freesound_community 배포)
- 출처: https://pixabay.com/sound-effects/film-special-effects-shop-door-bell-6405/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/shop-door-bell-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/shop-window-bell.wav`
- 편집: 여러 벨 중 첫 번째 타격만 원본 0.30~1.55초에서 추출하고 마지막 0.30초 페이드아웃 적용
- 재편집 명령: `scripts/process-shutter-audio.ps1`
- 표기: 제작자 표기는 필수가 아니지만 자산 추적을 위해 이 문서에 기록함.

### 금속 롤 셔터

- 제목: `metal shutter`
- 제작자: bruno.auzet (Pixabay의 freesound_community 배포)
- 출처: https://pixabay.com/sound-effects/film-special-effects-metal-shutter-64688/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/metal-shutter-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/shutter.wav`, `shutter-close.wav`
- 편집: 상승은 원본 2~3.6초를 사용해 1초 지점부터 0.6초 페이드아웃. 하강은 원본 5초 이후의 선행 저음량 구간을 제거하고 5.58~8.08초를 사용해, 마지막 0.55초를 자연스럽게 페이드아웃함.
- 재편집 명령: `scripts/process-shutter-audio.ps1`

### 손님 등장 벨

- 제목: `Bell-chime`
- 제작자: Amber2023
- 출처: https://pixabay.com/sound-effects/film-special-effects-bell-chime-238836/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/bell-chime-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/customer-bell.wav`
- 편집: 실제 첫 타격 직전인 원본 1.30초부터 1초간 추출, 앞부분 무음 제거, 하이패스·음량 정규화·끝 페이드
- 재편집 명령: `scripts/process-shutter-audio.ps1`

### 명세서 줄 공개 클릭

- 제목: `Geiger counter clicks (LOW)`
- 제작자: cookies+policy (Pixabay의 freesound_community 배포)
- 출처: https://pixabay.com/sound-effects/film-special-effects-geiger-counter-clicks-low-25832/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/geiger-counter-low-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/statement-line-click.wav`
- 편집: 첫 단일 클릭만 130ms로 추출, 하이패스·음량 정규화·페이드
- 재편집 명령: `scripts/process-shutter-audio.ps1`

### 명세서 등장 종이 소리

- 제목: `Paper Flutter`
- 제작자: mickdow (Pixabay의 freesound_community 배포)
- 출처: https://pixabay.com/sound-effects/household-paper-flutter-5933/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/paper-flutter-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/statement-paper.wav`
- 편집: 원본 첫 2.1초 펄럭임을 원래 속도로 추출, 하이패스·음량 정규화, 마지막 0.5초 페이드아웃
- 재편집 명령: `scripts/process-shutter-audio.ps1`

### 손님 대사 타이핑

- 제목: `Mechanical Keyboard Typing HD`
- 제작자: VirtualZero
- 출처: https://pixabay.com/sound-effects/film-special-effects-mechanical-keyboard-typing-hd-372290/
- 라이선스: Pixabay Content License
- 원본 보관: `art/audio/mechanical-keyboard-original.mp3`
- 게임 내 편집본: `public/assets/audio/sfx/customer-typing.wav`
- 편집: 연속 타건 구간 추출, 1.75배 속도, 모노 변환, 하이패스·음량 정규화·짧은 페이드
- 재편집 명령: `scripts/process-shutter-audio.ps1`
