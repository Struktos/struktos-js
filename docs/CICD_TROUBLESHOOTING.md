# CI/CD Troubleshooting Guide

이 문서는 Struktos.js CI/CD 파이프라인에서 발생할 수 있는 일반적인 문제와
해결책을 다룹니다.

---

## 📦 NPM Publishing Issues

### 1. Scoped Package Permission Error

**증상:**

```
npm ERR! 403 403 Forbidden - PUT https://registry.npmjs.org/@struktos%2fcore
npm ERR! You do not have permission to publish "@struktos/core"
```

**원인:** NPM organization에서 패키지 publish 권한이 없음

**해결책:**

1. NPM organization owner에게 권한 요청
2. Organization 설정에서 `publish access` 확인
3. `package.json`에 `publishConfig` 확인:

```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### 2. NPM Token Expired

**증상:**

```
npm ERR! 401 Unauthorized - PUT https://registry.npmjs.org/@struktos%2fcore
```

**해결책:**

1. NPM에서 새 Automation token 생성
2. GitHub Secrets에서 `NPM_TOKEN` 업데이트

```bash
# Token 생성 (npm 웹사이트 또는 CLI)
npm token create --type=automation

# GitHub CLI로 secret 업데이트
gh secret set NPM_TOKEN -b "npm_xxxxx"
```

### 3. Provenance Error

**증상:**

```
npm ERR! provenance statement could not be generated
```

**해결책:**

- GitHub Actions에서 `id-token: write` 권한 확인
- npm v9.5.0 이상 사용 확인

```yaml
permissions:
  id-token: write # Required for provenance
```

---

## 🔨 Build Issues

### 1. DTS (Declaration) Generation Bottleneck

**증상:** 빌드가 `.d.ts` 파일 생성에서 오래 걸림

**해결책:**

1. **tsup 병렬 처리 활성화:**

```typescript
// tsup.config.ts
export default defineConfig({
  dts: {
    resolve: true,
    compilerOptions: {
      // DTS 생성 최적화
      skipLibCheck: true,
      declaration: true,
      emitDeclarationOnly: false,
    },
  },
  // 병렬 빌드
  splitting: false,
  clean: true,
});
```

2. **TypeScript 5.x의 `--declaration` 최적화:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

3. **Turbo 캐싱 활용:**

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**", ".tsbuildinfo"],
      "cache": true
    }
  }
}
```

### 2. Out of Memory During Build

**증상:**

```
FATAL ERROR: Reached heap limit Allocation failed
```

**해결책:**

```yaml
# .github/workflows/ci.yml
- name: Build Packages
  env:
    NODE_OPTIONS: '--max-old-space-size=4096'
  run: pnpm build:packages
```

---

## 🧪 Test Issues

### 1. Flaky Tests in CI

**증상:** 테스트가 로컬에서는 통과하지만 CI에서 실패

**해결책:**

1. **타이머 기반 테스트 수정:**

```typescript
// ❌ Bad: Fixed timeout
await new Promise((resolve) => setTimeout(resolve, 100));

// ✅ Good: Use vi.useFakeTimers()
vi.useFakeTimers();
// ... test code
vi.advanceTimersByTime(100);
vi.useRealTimers();
```

2. **Race condition 방지:**

```typescript
// ❌ Bad: Shared state
let counter = 0;

// ✅ Good: Test isolation
beforeEach(() => {
  counter = 0;
});
```

### 2. Coverage Not Uploaded

**증상:** Codecov에 coverage가 업로드되지 않음

**해결책:**

```yaml
- name: Upload Coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }} # Required for private repos
    files: ./packages/*/coverage/coverage-final.json
    fail_ci_if_error: false # Don't fail if upload fails
    verbose: true # Debug output
```

---

## 🔄 Changesets Issues

### 1. Version PR Not Created

**증상:** main에 merge 후 "Version Packages" PR이 생성되지 않음

**원인:** changeset 파일이 없음

**해결책:**

```bash
# changeset 추가 확인
ls .changeset/*.md

# 새 changeset 생성
pnpm changeset
```

### 2. Linked Packages Version Mismatch

**증상:** 연결된 패키지들의 버전이 동기화되지 않음

**해결책:**

```json
// .changeset/config.json
{
  "linked": [["@struktos/core", "@struktos/prisma", "@struktos/cli"]]
}
```

---

## 🔐 Security Scan Issues

### 1. CodeQL Analysis Timeout

**증상:**

```
Error: CodeQL analysis timed out
```

**해결책:**

```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: typescript
    # 큰 코드베이스에서 timeout 증가
    config: |
      queries:
        - uses: security-and-quality
      timeout: 60  # minutes
```

### 2. False Positive in Dependency Scan

**해결책:**

```json
// .npmrc 또는 package.json
{
  "overrides": {
    "vulnerable-package": "^2.0.0" // 보안 패치 버전으로 강제
  }
}
```

---

## 🚀 Quick Fixes

### Turbo Cache 초기화

```bash
pnpm clean:turbo
rm -rf node_modules/.cache/turbo
```

### 전체 클린 빌드

```bash
pnpm clean
pnpm install
pnpm build
```

### GitHub Actions 캐시 초기화

```yaml
# 캐시 키 변경으로 강제 초기화
key: turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-v2
```

### 로컬에서 CI 환경 시뮬레이션

```bash
# CI 환경 변수 설정
export CI=true
export NODE_ENV=test

# 전체 검증 실행
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

---

## 📞 Support

문제가 지속되면:

1. [GitHub Issues](https://github.com/struktos/struktos-platform/issues) 생성
2. [Discord](https://discord.gg/struktos) 커뮤니티 질문
3. 로그와 재현 단계 포함

---

## 참고 링크

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [Turbo Documentation](https://turbo.build/repo/docs)
- [Codecov Documentation](https://docs.codecov.com/)
