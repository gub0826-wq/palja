# Palja: 영어 사주 웹사이트 (판매용)

외국인이 생년월일을 넣으면 무료로 사주 차트를 보여주고, $4.99를 결제하면 AI가 쓴 전체 풀이를 보여주는 사이트예요.

## 들어 있는 것

| 파일 | 하는 일 |
| --- | --- |
| `public/index.html` | 사이트 화면 전체 (무료 차트, 공유 카드, 결제 버튼) |
| `api/checkout.js` | 결제 버튼을 누르면 Polar 결제창을 만들어요 |
| `api/reading.js` | 결제가 됐는지 Polar에 확인한 뒤 Claude로 풀이를 써요 |
| `lib/saju.js` | 사주 계산 (화면과 같은 계산을 서버에서도 해요) |
| `.env.example` | 넣어야 할 비밀 키 목록 |

결제한 사람의 생년월일은 결제 정보에 같이 저장돼요. 그래서 한 번 결제하고 다른 사람 사주를 공짜로 뽑는 건 안 돼요.

## 배포 순서 (처음 한 번, 1~2시간)

### 1. Polar 가입 (결제)
1. 먼저 테스트용 **https://sandbox.polar.sh** 에 가입하고 조직(Organization)을 만들어요.
2. Products → New product → 이름 `Full Saju Reading`, **One-time**, 가격 **$4.99**로 만들어요.
3. 만든 상품 페이지에서 **Product ID**를 복사해요.
4. Settings → Developers → New token. 권한에 `checkouts:read`, `checkouts:write`를 체크하고 토큰을 복사해요.

### 2. Anthropic 가입 (AI 풀이)
1. **https://console.anthropic.com** 에 가입하고 결제수단을 등록해요. 처음엔 $5 정도만 충전하면 충분해요.
2. API Keys → Create Key → 복사해요.

### 3. GitHub에 올리기
1. **https://github.com** 에 가입 → New repository → 이름 `palja` → Create.
2. "uploading an existing file"을 누르고 이 폴더 안의 파일을 전부 끌어다 놓아요. (`node_modules` 폴더는 빼요.)

### 4. Vercel에 배포
1. **https://vercel.com** 에 GitHub 계정으로 가입해요.
2. Add New → Project → `palja` 저장소 Import.
3. **Environment Variables**에 `.env.example`에 있는 항목을 하나씩 넣어요.
   - `POLAR_ACCESS_TOKEN`: 1-4에서 복사한 토큰
   - `POLAR_PRODUCT_ID`: 1-3에서 복사한 ID
   - `POLAR_SERVER`: `sandbox`
   - `ANTHROPIC_API_KEY`: 2-2에서 복사한 키
   - `ANTHROPIC_MODEL`: `claude-sonnet-5-5`
   - `SITE_URL`: 배포 후 받은 주소 (예: `https://palja.vercel.app`). 처음엔 비워두고 배포 후 넣고 다시 배포해도 돼요.
4. Deploy를 누르면 1분 안에 사이트 주소가 나와요.

### 5. 테스트 결제
사이트에서 생년월일 입력 → Get my full reading → 결제창에서 테스트 카드 `4242 4242 4242 4242`, 만료일은 미래 아무 날짜, CVC는 아무 숫자로 결제해요. 사이트로 돌아와서 풀이가 나오면 성공이에요.

### 6. 실제 판매 시작
1. **https://polar.sh** (진짜)에 가입하고 1번을 똑같이 한 번 더 해요. 본인 인증과 정산 계좌(은행 또는 PayPal)를 등록해야 돈을 받을 수 있어요.
2. Vercel → Settings → Environment Variables에서 `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID`를 진짜 값으로 바꾸고 `POLAR_SERVER`를 `production`으로 바꿔요.
3. Deployments → Redeploy.

## 알아둘 것
- **세금:** Polar가 판매자(Merchant of Record)가 돼서 해외 부가세를 대신 처리해줘요. 국내 소득 신고는 따로 해야 하니 세무사에게 한 번 물어보세요.
- **AI 비용:** 풀이 한 건에 수십 원 정도예요. Anthropic 콘솔에서 사용량 한도를 걸어두면 안전해요.
- **도메인:** `palja.com` 같은 주소를 사서 Vercel → Settings → Domains에 연결하면 돼요. 그러면 `SITE_URL`도 바꿔주세요.
- **알려진 한계:** 절기가 바뀌는 시각 몇 시간 안에 해외에서 태어난 사람은 월주가 다르게 나올 수 있어요.
