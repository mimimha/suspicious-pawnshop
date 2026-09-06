# 배포 (Cloudflare Pages)

이 게임은 백엔드가 없는 **정적 사이트**다. `npm run build` 로 나온 `dist/` 를
정적 호스팅에 올리면 끝이다. 별도 도메인 구매는 필요 없고 `*.pages.dev`
서브도메인을 무료로 받는다.

| | |
| --- | --- |
| 빌드 명령 | `npm run build` |
| 출력 디렉터리 | `dist` |
| Node 버전 | `.node-version` (22) |
| 배포 용량 | 약 7.7 MB |

## 방법 B — GitHub 연동 (현재 채택)

푸시하면 Cloudflare 가 알아서 빌드·배포한다. 최초 1회만 대시보드에서 연결한다.

### 1. 대시보드 연결 (최초 1회)

Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** →
**Connect to Git** 에서 `relu00123/vive-pawnshop` 을 선택하고 아래대로 설정한다.

- Framework preset: **None**
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: (비움)

Node 버전은 저장소의 `.node-version` 을 자동으로 읽으므로 따로 지정하지 않는다.

### 2. Production branch 지정

대시보드의 **Settings → Builds & deployments → Production branch** 에서
배포 기준 브랜치를 고른다. 여기서 지정한 브랜치에 푸시될 때마다 배포된다.

- `main` 을 고르면 main 에 머지된 것만 배포된다 (정석).
- 작업 브랜치를 고르면 그 브랜치 푸시가 곧 배포다 (데모 직전에 편하다).

Production branch 가 아닌 브랜치에 푸시하면 **preview 배포**가 따로 생긴다.
본 주소는 그대로 두고 임시 URL 로 먼저 확인할 수 있다.

### 3. 이후 흐름

```bash
git push
```

이게 전부다. 대시보드에서 빌드 로그를 볼 수 있고, 완료되면
`https://vive-pawnshop.pages.dev` 에 반영된다.

> 참고: 저장소에 원본 아트(`art/`, 90MB)가 포함돼 있어 `.git` 이 약 219MB다.
> 빌드마다 clone 하므로 첫 빌드가 다소 느리다. 배포 결과물 용량과는 무관하다.

## 방법 A — CLI 직접 업로드 (예비 수단)

git 상태와 무관하게 **지금 로컬 폴더 상태 그대로** 올린다. 커밋하지 않은 변경도
포함된다. 데모 직전 급할 때만 쓴다.

```bash
npm run deploy
```

## 에셋 최적화

게임 아트는 **WebP(q90)** 로 관리한다. PNG 원본 46.4MB → WebP 5.1MB (-89%).
회화풍 아트라 lossy q90 에서 육안 차이가 없다.

새 PNG 에셋을 `public/assets/` 에 추가한 뒤에는 변환하고 코드 참조를 `.webp` 로 맞춘다.

```bash
node scripts/optimize-assets.mjs --delete
```

`--delete` 는 변환 후 원본 PNG를 지운다. 확인 후 지우려면 플래그 없이 실행한다.

## 용량 구성

| 항목 | 용량 |
| --- | --- |
| 게임 에셋 (WebP 75개) | 5.1 MB |
| JS 번들 (Phaser 포함) | 1.5 MB (gzip 406 KB) |
| 한글 폰트 (Gowun Batang 2종) | 924 KB |
| **합계** | **약 7.7 MB** |
