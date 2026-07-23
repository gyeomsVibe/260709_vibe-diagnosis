# ERR_003 — 구조화 필드를 React 자식으로 그대로 렌더링해 화면이 죽는다

## 증상

V2 대시보드에서 **실패(ERROR/WARNING) 진단 카드를 선택하면 화면 전체가 하얗게 사라진다.**
네트워크 요청은 전부 200이고 서버 로그도 정상이라 "백엔드는 멀쩡한데 화면만 안 나온다"로 보인다.

## 근본 원인

`GET/POST /api/run` 의 `causeHypotheses` 는 계약상 **객체 배열**이다.

```jsonc
"causeHypotheses": [{ "cause": "...", "likelihood": "HIGH", "signal": "..." }]
```

그런데 V2가 이 객체를 자식으로 그대로 넣었다.

```jsx
// 잘못된 코드
{selectedResult.causeHypotheses.map((cause, index) => <li key={index}>{cause}</li>)}
```

React는 일반 객체를 자식으로 렌더링하면 예외를 던진다(Objects are not valid as a React child).
error boundary가 없으면 예외가 루트까지 올라가 **앱 전체가 언마운트**되고, `#root` 가 빈 채로 남는다.
정상(OK) 진단에는 `causeHypotheses` 가 없어서 평소에는 드러나지 않고, **실패했을 때만** 터진다.

## 왜 늦게 발견됐나

- 백엔드 테스트(47건)는 전부 통과했다. 이 결함은 렌더링 계층에만 있다.
- 진단이 전부 OK인 상태에서 UI를 점검하면 재현되지 않는다. **실패를 일부러 만들어야** 보인다.
- 콘솔 로그 수집에도 잡히지 않아 "요청은 200인데 화면이 빈다"는 모순처럼 보인다.

## 해결

레거시 V1은 처음부터 필드를 하나씩 꺼내 쓰고 있었다. V2를 같은 방식으로 맞췄다.

```jsx
{selectedResult.causeHypotheses.map((hypothesis, index) => (
  <li key={`${hypothesis?.cause ?? 'cause'}-${index}`}>
    {typeof hypothesis === 'string' ? hypothesis : (
      <><strong>{hypothesis.likelihood}</strong>{' · '}{hypothesis.cause}
        {hypothesis.signal && <span> — {hypothesis.signal}</span>}</>
    )}
  </li>
))}
```

문자열 폴백을 함께 둬 계약이 단순 문자열로 바뀌어도 죽지 않게 했다.

## 재발 방지 체크리스트

- 계약(`shared/api-contract.md`)에서 배열 필드를 쓸 때 **원소가 문자열인지 객체인지** 먼저 확인한다.
- UI 점검은 정상 상태만 보지 말고 **실패를 유발한 상태에서도** 같은 화면을 열어 본다.
- 화면이 비는데 네트워크가 200이면 `document.getElementById('root').children.length` 를 먼저 본다. 0이면 렌더링 예외다.
- 같은 데이터를 V1·V2가 함께 그리는 구간은 한쪽을 고칠 때 다른 쪽 구현을 참조한다.

## 실측 근거 (2026-07-24)

- 재현: `examples/calculator` 의 `subtract` 를 깨뜨려 실패를 만든 뒤 오류 카드 선택 → `#root` 자식 0, body 길이 11
- 수정 후: 같은 조건에서 앱 생존, 원인 후보가 `HIGH · LOGIC_ASSERTION_FAILURE — result text compares an expected value against an observed one` 로 정상 표시
