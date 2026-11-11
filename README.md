# Calm Counter Coach

[무엇을] 백화점 현장 직원이 매장에서 3분 안에 진상 고객 응대를 연습하는 롤플레이 코치 웹앱을 만들어줘. AI가 고객 역할을 하고, 끝나면 피드백을 줘.

[누가 쓰나] 백화점 안내데스크·VIP 라운지·매장 직원. 휴대폰 세로 화면으로 한 손 조작.

[꼭 필요한 기능 3개]

1) 상황 선택: 카드 3장 중 하나 고르기 (환불 요구 / VIP 클레임 / 대기 항의)

2) AI 고객과 대화: 채팅 형식, 직원이 글로 답하면 AI 고객이 화난 말투로 3~5번 주고받기 (마이크 버튼은 자리만 표시)

3) 결과 피드백: "잘한 점 2개 + 고칠 점 1개 + 다음에 쓸 한 문장"을 카드로 표시

[화면 디자인] 고급 백화점 느낌. 짙은 초록 + 아이보리 배경 + 은은한 골드 선, 제목은 단정한 명조(세리프) 계열, 본문은 읽기 쉬운 고딕. 여백 넉넉하게, 둥글기는 작게, 그림자는 약하게. 큰 글씨와 큰 버튼. 화면 순서는 시작 → 상황 선택 → 대화 → 피드백 → 다시 하기. 실제 회사의 로고·이름·고유 문구는 쓰지 말고 분위기만 참고.

[예시 데이터] 상황1 "3주 전 산 가방을 영수증 없이 환불해 달라는 고객", 상황2 "VIP 라운지 대기가 길다며 항의하는 고객", 상황3 "계산 줄이 길다고 큰 소리로 화내는 고객". 고객 첫마디 예: "지금 몇 분을 기다리게 하는 거예요? 책임자 불러요!"

[하지 말 것] 로그인·회원가입 없음, 결제 없음, 개인정보 입력 없음, 대화 저장하지 않기. 실제 회사·브랜드·사람 이름 쓰지 않기. 의료·법률 판단 하지 않기.

[언어] 모든 글자(버튼, 안내문, 오류 메시지, AI 대화)는 한국어, 쉬운 말로.

[참고] 첫 화면 하단에 "연습용입니다. 실제 회사 규정은 확인 필요"를 작게 표시해줘.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://calm-counter-coach.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6641d3d3-e1cb-49b1-968f-509327173100).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
