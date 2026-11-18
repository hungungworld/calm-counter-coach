// Practice scenarios. Everything here is made-up training content: no real company,
// brand, store or person is named, and every "policy" is a practice assumption.
// HRD owners edit this file to add or tune a situation; the AI prompt, the offline
// engine, the briefing card and the model answers all read from the same entry.

export const SCENARIO_IDS = [
  "refund",
  "vip",
  "queue",
  "food",
  "alteration",
  "pickup",
  "overclaim",
  "global",
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export type ScenarioLang = "ko" | "en";

type CalmKey = "care" | "apologize" | "lead" | "makeSure";
type MoodKey = "angry" | "softening" | "calm";

/** How the 3D customer looks and sounds. */
export type CustomerLook = {
  gender: "f" | "m";
  age: "young" | "mid" | "senior";
  hair: "bob" | "long" | "short" | "updo" | "ponytail";
  hairColor: string;
  skin: string;
  outfit: string;
  outfitAccent: string;
  accessory: "none" | "earrings" | "glasses" | "scarf" | "tie" | "cap";
  /** Prop the customer brought to the counter. */
  prop: "bag" | "ticket" | "basket" | "foodbox" | "garment" | "phone" | "cup" | "passport";
  /** Backdrop behind the customer. */
  backdrop: "boutique" | "lounge" | "checkout";
  /** Gateway voice id and browser-voice tuning. */
  voice: { id: string; pitch: number; rate: number };
};

export type Scenario = {
  id: ScenarioId;
  tag: string;
  title: string;
  place: string;
  category: string;
  firstLine: string;
  persona: string;
  /** What the customer really wants: revealed in the debrief, never during the talk. */
  hiddenNeed: string;
  /** The one behaviour this situation trains. */
  goal: string;
  /** Which CALM step matters most here. */
  focus: CalmKey;
  /** Practice-only policy assumptions the staff can lean on. */
  policy: [string, string, string];
  lang: ScenarioLang;
  look: CustomerLook;
  /** HRD-curated model sentences, one per CALM step. */
  model: Record<CalmKey, string>;
  /** Lines for the offline engine, used when the AI gateway cannot be reached. */
  sim: {
    lines: Record<MoodKey, [string, string]>;
    closing: Record<MoodKey, string>;
    thoughts: Record<MoodKey, string>;
  };
};

export const SCENARIOS: Scenario[] = [
  {
    id: "refund",
    tag: "환불 요구",
    title: "3주 전 산 가방을 영수증 없이 환불해 달라는 고객",
    place: "잡화 매장",
    category: "교환·환불",
    firstLine:
      "3주 전에 여기서 산 가방이에요. 영수증은 없어요. 그냥 환불해 주세요. 안 된다는 말은 듣기 싫어요!",
    persona:
      "3주 전에 산 가방을 영수증 없이 환불받고 싶어 하는 고객. 영수증이 없다는 이유로 거절당할까 봐 처음부터 날이 서 있다.",
    hiddenNeed: "거절당해 민망해지는 게 싫어요. 산 사실을 믿어 주고 방법을 찾아 주길 바라요.",
    goal: "‘안 됩니다’ 대신, 확인할 수 있는 방법부터 말하기",
    focus: "lead",
    policy: [
      "영수증이 없어도 결제 카드나 멤버십으로 구매 내역을 조회할 수 있어요.",
      "교환·환불은 구매 후 14일 안, 사용하지 않은 상품만 가능해요.",
      "기간이 지났으면 책임자와 상의해 교환이나 수선 같은 다른 방법을 안내해요.",
    ],
    lang: "ko",
    look: {
      gender: "f",
      age: "mid",
      hair: "bob",
      hairColor: "#2a1c14",
      skin: "#f0c9a8",
      outfit: "#b99a6b",
      outfitAccent: "#f3ead8",
      accessory: "earrings",
      prop: "bag",
      backdrop: "boutique",
      voice: { id: "coral", pitch: 1.05, rate: 1.04 },
    },
    model: {
      care: "가방이 마음에 들지 않으셨는데 영수증까지 없어 걱정이 크셨겠어요.",
      apologize:
        "번거롭게 해 드려 죄송합니다. 결제하신 카드나 멤버십으로 구매 내역을 확인해 봐도 될까요?",
      lead: "구매 후 14일이 지나 바로 환불은 어렵지만, 책임자와 상의해 교환이나 다른 방법을 찾아보겠습니다.",
      makeSure: "확인되는 대로 오늘 안에 연락드리겠습니다. 기다려 주셔서 감사합니다.",
    },
    sim: {
      lines: {
        angry: [
          "그러니까 된다는 거예요, 안 된다는 거예요? 분명히 여기서 샀다니까요!",
          "영수증 없으면 손님 말은 못 믿겠다는 거잖아요. 기분 정말 나쁘네요.",
        ],
        softening: [
          "조회가 된다면 다행이네요. 그런데 기간이 지났다고 또 안 된다고 하는 건 아니죠?",
          "찾아봐 주신다니 기다릴게요. 대신 어떻게 되는지 분명하게 말해 주세요.",
        ],
        calm: [
          "그렇게 설명해 주시니 이해가 되네요. 그럼 그 방법으로 해 주세요.",
          "처음부터 이렇게 알려 주셨으면 화낼 일도 없었죠. 알겠어요.",
        ],
      },
      closing: {
        angry: "됐어요. 여기서는 얘기가 안 되네요. 고객센터에 직접 말할게요.",
        softening: "알겠어요. 일단 확인해 보고 연락 주세요. 기다릴게요.",
        calm: "네, 그렇게 할게요. 신경 써 줘서 고마워요.",
      },
      thoughts: {
        angry: "또 규정 얘기만 듣고 돌아가야 하나.",
        softening: "그래도 내 말을 믿고 찾아보려 하네.",
        calm: "방법을 찾아 주니 마음이 놓인다.",
      },
    },
  },
  {
    id: "vip",
    tag: "VIP 클레임",
    title: "VIP 라운지 대기가 길다며 항의하는 고객",
    place: "VIP 라운지",
    category: "우수 고객",
    firstLine: "지금 몇 분을 기다리게 하는 거예요? 책임자 불러요!",
    persona:
      "오랫동안 우수 고객이었다는 자부심이 큰 고객. VIP 라운지에서 20분 넘게 기다려 무시당했다고 느낀다.",
    hiddenNeed: "오래된 고객으로 대접받고 싶어요. 기다린 시간보다 무시당한 느낌이 더 화나요.",
    goal: "변명보다 먼저 기다린 시간을 인정하고, 지금 할 수 있는 일을 말하기",
    focus: "care",
    policy: [
      "라운지는 입장 순서대로 안내하고, 만석이면 예상 대기 시간을 먼저 알려요.",
      "대기가 15분을 넘으면 음료를 먼저 드리거나, 자리가 나면 연락드리는 방법을 안내해요.",
      "책임자 호출 요청은 거절하지 않고, 오기 전까지 직원이 먼저 응대해요.",
    ],
    lang: "ko",
    look: {
      gender: "f",
      age: "senior",
      hair: "updo",
      hairColor: "#6b5e58",
      skin: "#edc4a6",
      outfit: "#3c2a3f",
      outfitAccent: "#d9b976",
      accessory: "scarf",
      prop: "ticket",
      backdrop: "lounge",
      voice: { id: "sage", pitch: 0.92, rate: 0.98 },
    },
    model: {
      care: "오래 기다리게 해 드렸습니다. 늘 찾아 주시는데 불편을 드려 마음이 무겁습니다.",
      apologize:
        "대기 안내를 미리 드리지 못해 죄송합니다. 지금 얼마나 기다리셨는지 여쭤봐도 될까요?",
      lead: "지금 바로 음료를 준비해 드리고, 자리가 나는 대로 가장 먼저 모시겠습니다.",
      makeSure: "5분 안에 다시 안내드리겠습니다. 책임자에게도 말씀 전하겠습니다. 감사합니다.",
    },
    sim: {
      lines: {
        angry: [
          "제가 여기 몇 년을 다녔는데 이런 대접을 받아야 해요? 설명이 그게 다예요?",
          "기다리라는 말만 하지 말고요. 지금 뭘 해 줄 수 있는지 말해 봐요.",
        ],
        softening: [
          "진작 그렇게 말해 줬으면 됐잖아요. 그래서 얼마나 더 기다려야 하는데요?",
          "알았어요. 그럼 자리 나면 바로 알려 주는 거 맞죠?",
        ],
        calm: [
          "그래요, 그렇게 챙겨 주니 좀 낫네요. 음료는 따뜻한 걸로 부탁해요.",
          "알겠어요. 다음부터는 미리 알려 줘요.",
        ],
      },
      closing: {
        angry: "됐어요, 책임자한테 직접 얘기할게요. 여기 담당이 누구예요?",
        softening: "이번엔 넘어갈게요. 자리 나면 바로 불러 줘요.",
        calm: "고마워요. 덕분에 기분이 좀 풀렸어요.",
      },
      thoughts: {
        angry: "오래 다닌 고객인데 아무도 신경을 안 쓰네.",
        softening: "이제야 내 시간을 알아주는구나.",
        calm: "제대로 대접받는 느낌이 든다.",
      },
    },
  },
  {
    id: "queue",
    tag: "대기 항의",
    title: "계산 줄이 길다고 큰 소리로 화내는 고객",
    place: "계산대",
    category: "대기",
    firstLine: "아니, 계산대를 왜 하나만 열어 놨어요? 줄이 이게 뭐예요! 다들 바쁜 거 안 보여요?",
    persona:
      "약속 시간에 늦을까 봐 초조한 고객. 계산 줄이 길어 주변 사람들 앞에서 큰 소리로 화를 낸다.",
    hiddenNeed: "약속에 늦을까 봐 불안해요. 누군가 해결하려고 움직이는 모습을 보고 싶어요.",
    goal: "큰 소리에 맞서지 않고, 바로 움직이는 행동을 말로 보여 주기",
    focus: "lead",
    policy: [
      "대기가 길어지면 계산대 추가 개방을 요청하고, 예상 시간을 안내해요.",
      "급한 고객에게는 가까운 다른 계산대나 셀프 계산대를 안내할 수 있어요.",
      "뒤에서 기다리는 고객에게도 함께 양해를 구해요.",
    ],
    lang: "ko",
    look: {
      gender: "m",
      age: "mid",
      hair: "short",
      hairColor: "#1d1a18",
      skin: "#e2b48e",
      outfit: "#27364a",
      outfitAccent: "#dfe4ea",
      accessory: "glasses",
      prop: "basket",
      backdrop: "checkout",
      voice: { id: "ash", pitch: 0.82, rate: 1.08 },
    },
    model: {
      care: "바쁘신데 줄이 길어 많이 답답하셨죠.",
      apologize: "기다리게 해 드려 죄송합니다. 혹시 몇 시까지 나가셔야 하는지 여쭤봐도 될까요?",
      lead: "지금 바로 계산대를 하나 더 열겠습니다. 급하시면 옆 셀프 계산대로 먼저 안내해 드리겠습니다.",
      makeSure: "2분 안에 계산 도와드리겠습니다. 기다려 주셔서 감사합니다.",
    },
    sim: {
      lines: {
        angry: [
          "죄송하다는 말은 됐고요, 그래서 언제 계산되냐고요!",
          "저 약속 있다니까요. 줄 서 있는 사람들 다 똑같이 생각할걸요?",
        ],
        softening: [
          "지금 바로 연다는 거죠? 얼마나 걸려요?",
          "다른 계산대가 있으면 진작 알려 주지 그랬어요. 어디예요?",
        ],
        calm: [
          "알겠어요. 그럼 그쪽으로 갈게요.",
          "네, 빨리 해 주시면 돼요. 큰 소리 내서 미안해요.",
        ],
      },
      closing: {
        angry: "됐어요. 그냥 두고 갈게요. 다시는 안 와요.",
        softening: "알겠으니까 빨리만 해 주세요.",
        calm: "덕분에 늦지 않겠네요. 고마워요.",
      },
      thoughts: {
        angry: "늦으면 어쩌지. 아무도 안 움직이네.",
        softening: "그래도 뭔가 해 보려고 하는구나.",
        calm: "이 정도면 약속에 맞출 수 있겠다.",
      },
    },
  },
  {
    id: "food",
    tag: "품질 클레임",
    title: "어제 산 반찬에서 이물질이 나왔다는 고객",
    place: "식품관",
    category: "품질",
    firstLine: "어제 여기서 산 반찬에서 머리카락이 나왔어요. 아이도 같이 먹었는데, 이게 말이 돼요?",
    persona:
      "가족이 먹을 음식에서 이물질이 나와 놀라고 화난 고객. 위생 관리를 믿을 수 없다고 느낀다.",
    hiddenNeed: "가족이 괜찮을지 걱정돼요. 가볍게 넘기지 않고 진지하게 다뤄 주길 바라요.",
    goal: "원인을 따지기 전에 걱정을 먼저 받아 주고, 처리 절차를 분명히 말하기",
    focus: "apologize",
    policy: [
      "이물질 접수는 상품이나 사진을 확인하고 바로 환불 또는 교환해 드려요.",
      "접수 내용은 위생 담당에게 전달하고, 확인 결과를 고객에게 다시 알려요.",
      "건강 이상 여부는 직원이 판단하지 않고, 불편이 있으면 진료를 권해요.",
    ],
    lang: "ko",
    look: {
      gender: "f",
      age: "mid",
      hair: "ponytail",
      hairColor: "#3a2a20",
      skin: "#f2cfb2",
      outfit: "#6f8f7c",
      outfitAccent: "#f1ede2",
      accessory: "none",
      prop: "foodbox",
      backdrop: "checkout",
      voice: { id: "nova", pitch: 1.08, rate: 1.05 },
    },
    model: {
      care: "가족분들이 드신 음식이라 얼마나 놀라고 걱정되셨을지요.",
      apologize: "정말 죄송합니다. 상품이나 사진을 제가 바로 확인해 봐도 될까요?",
      lead: "지금 바로 환불해 드리고, 위생 담당에게 전달해 원인을 확인하겠습니다.",
      makeSure: "확인 결과는 내일까지 제가 직접 연락드리겠습니다. 알려 주셔서 감사합니다.",
    },
    sim: {
      lines: {
        angry: [
          "환불이 문제가 아니에요. 위생 관리를 어떻게 하길래 이래요?",
          "아이가 먹었다고요. 그냥 죄송하다고 하면 끝이에요?",
        ],
        softening: [
          "확인해서 알려 준다는 거죠? 그냥 넘어가는 거 아니고요?",
          "사진은 찍어 뒀어요. 누구한테 보여 주면 돼요?",
        ],
        calm: ["그렇게까지 확인해 준다니 믿어 볼게요.", "알겠어요. 결과는 꼭 연락 주세요."],
      },
      closing: {
        angry: "말로만 그러지 말고요. 정식으로 접수할 거예요.",
        softening: "일단 환불받고, 확인 결과 기다릴게요.",
        calm: "네, 꼼꼼히 봐 줘서 고마워요. 연락 기다릴게요.",
      },
      thoughts: {
        angry: "아이한테 무슨 일 생기면 어쩌려고.",
        softening: "대충 넘기지는 않을 것 같네.",
        calm: "제대로 확인해 준다니 마음이 놓인다.",
      },
    },
  },
  {
    id: "alteration",
    tag: "수선 지연",
    title: "약속한 수선 날짜가 지났다며 화내는 고객",
    place: "의류 매장",
    category: "서비스 지연",
    firstLine: "오늘까지 된다고 해서 왔는데 아직 안 됐다고요? 내일 입어야 하는 옷이에요!",
    persona: "내일 중요한 자리에 입을 옷을 맡긴 고객. 약속한 날짜가 지켜지지 않아 화가 났다.",
    hiddenNeed: "내일 입을 수만 있으면 돼요. 확실한 시간 약속을 듣고 싶어요.",
    goal: "늦어진 이유보다, 언제까지 어떻게 해 줄지 약속하기",
    focus: "makeSure",
    policy: [
      "수선이 늦어지면 수선실에 바로 확인해 완료 시간을 다시 안내해요.",
      "급한 경우 당일 우선 작업을 요청하거나 퀵 배송을 안내할 수 있어요.",
      "약속을 지키지 못했으면 수선비는 책임자와 상의해 조정할 수 있어요.",
    ],
    lang: "ko",
    look: {
      gender: "m",
      age: "senior",
      hair: "short",
      hairColor: "#8d8a86",
      skin: "#ddb08c",
      outfit: "#2d2f36",
      outfitAccent: "#f4f1ea",
      accessory: "tie",
      prop: "garment",
      backdrop: "boutique",
      voice: { id: "onyx", pitch: 0.72, rate: 0.98 },
    },
    model: {
      care: "내일 입으셔야 하는 옷인데 약속이 지켜지지 않아 많이 당황하셨겠어요.",
      apologize: "약속을 지키지 못해 죄송합니다. 내일 몇 시에 필요하신지 여쭤봐도 될까요?",
      lead: "지금 수선실에 우선 작업을 요청하고, 오늘 저녁 댁으로 퀵 배송해 드리겠습니다.",
      makeSure: "완료되면 바로 문자로 알려 드리겠습니다. 다시 한번 죄송하고, 감사합니다.",
    },
    sim: {
      lines: {
        angry: [
          "사정은 됐고요. 내일 못 입으면 책임질 거예요?",
          "저번에도 분명히 오늘이라고 했어요. 약속을 이렇게 안 지켜도 돼요?",
        ],
        softening: [
          "오늘 안에 된다는 거죠? 몇 시까지요?",
          "집으로 보내 줄 수 있어요? 다시 오기는 어려워요.",
        ],
        calm: ["그 시간이면 괜찮아요. 꼭 부탁해요.", "알겠어요. 이번엔 믿을게요."],
      },
      closing: {
        angry: "그냥 옷 돌려주세요. 다른 데 맡길게요.",
        softening: "오늘 저녁까지는 꼭 받아야 해요. 연락 주세요.",
        calm: "네, 그렇게 해 주세요. 챙겨 줘서 고마워요.",
      },
      thoughts: {
        angry: "내일 뭘 입고 가라는 거야.",
        softening: "시간만 지켜 주면 되는데.",
        calm: "내일 입을 수 있겠다. 다행이다.",
      },
    },
  },
  {
    id: "pickup",
    tag: "주문 누락",
    title: "온라인으로 주문한 선물이 준비되지 않았다는 고객",
    place: "픽업 데스크",
    category: "온라인 연계",
    firstLine: "오늘 픽업하라고 문자까지 왔는데 물건이 없다니요? 이따 선물로 줘야 한단 말이에요.",
    persona:
      "저녁 약속에 가져갈 선물을 온라인으로 주문한 고객. 픽업 안내 문자를 받고 왔는데 상품이 없다.",
    hiddenNeed: "약속에 빈손으로 가고 싶지 않아요. 지금 가져갈 수 있는 해결책이 필요해요.",
    goal: "시스템 탓을 하지 않고, 오늘 안에 해결할 대안을 두 가지 이상 말하기",
    focus: "lead",
    policy: [
      "픽업 상품이 없으면 주문 번호로 재고와 입고 상태를 바로 조회해요.",
      "같은 상품이 매장에 있으면 바로 드리고, 없으면 비슷한 상품이나 당일 배송을 안내해요.",
      "주문 취소와 환불도 그 자리에서 도와드릴 수 있어요.",
    ],
    lang: "ko",
    look: {
      gender: "f",
      age: "young",
      hair: "long",
      hairColor: "#4a2f22",
      skin: "#f4d3b8",
      outfit: "#c9706a",
      outfitAccent: "#f6efe4",
      accessory: "none",
      prop: "phone",
      backdrop: "boutique",
      voice: { id: "shimmer", pitch: 1.14, rate: 1.08 },
    },
    model: {
      care: "선물로 준비하신 건데 상품이 없어 많이 당황하셨겠어요.",
      apologize: "안내 문자와 달라 죄송합니다. 주문 번호로 지금 바로 확인해 봐도 될까요?",
      lead: "매장 재고가 있으면 바로 드리고, 없으면 비슷한 상품이나 오늘 저녁 배송을 안내해 드리겠습니다.",
      makeSure: "포장까지 5분 안에 준비해 드리겠습니다. 기다려 주셔서 감사합니다.",
    },
    sim: {
      lines: {
        angry: [
          "시스템 오류는 제가 알 바 아니고요. 문자 보고 왔잖아요!",
          "지금 약속 시간 다 됐는데 어떡하라는 거예요?",
        ],
        softening: [
          "매장에 같은 게 있어요? 있으면 그걸로 주세요.",
          "지금 가져갈 수 있는 게 뭐가 있는데요?",
        ],
        calm: ["그럼 그걸로 할게요. 포장도 해 줄 수 있죠?", "알겠어요. 빨리만 해 주세요."],
      },
      closing: {
        angry: "됐어요. 주문 취소해 주세요. 다른 데서 살게요.",
        softening: "시간 없으니까 빨리 확인해 주세요.",
        calm: "덕분에 선물 챙겨 가겠네요. 고마워요.",
      },
      thoughts: {
        angry: "빈손으로 가게 생겼잖아.",
        softening: "가져갈 수만 있으면 되는데.",
        calm: "선물 문제는 해결됐다.",
      },
    },
  },
  {
    id: "overclaim",
    tag: "과도한 요구",
    title: "사과로는 부족하다며 무리한 보상을 요구하는 고객",
    place: "고객상담실",
    category: "선 긋기",
    firstLine:
      "옷에 음료를 쏟아 놓고 세탁비만 준다고요? 옷값 전부랑 상품권도 줘야죠. 안 그러면 가만 안 있어요.",
    persona:
      "매장 직원 실수로 옷에 음료가 묻은 고객. 사과와 세탁 안내를 받았지만 옷값 전액과 상품권을 요구하며 목소리를 높인다.",
    hiddenNeed: "실수를 가볍게 넘기는 것 같아 화나요. 진심으로 책임지는 모습을 보고 싶어요.",
    goal: "잘못은 분명히 사과하되, 규정 밖 요구는 정중하게 선을 긋고 책임자와 연결하기",
    focus: "lead",
    policy: [
      "직원 실수로 생긴 오염은 세탁비를 드리고, 세탁으로 해결되지 않으면 보상 절차를 다시 안내해요.",
      "규정을 넘는 보상은 직원이 약속하지 않고, 책임자와 상의하겠다고 말해요.",
      "큰 소리나 위협이 계속되면 응대가 어렵다고 알리고 책임자에게 넘겨요.",
    ],
    lang: "ko",
    look: {
      gender: "f",
      age: "senior",
      hair: "bob",
      hairColor: "#3b3431",
      skin: "#ecc3a3",
      outfit: "#7a2f38",
      outfitAccent: "#e9dcc3",
      accessory: "glasses",
      prop: "cup",
      backdrop: "lounge",
      voice: { id: "marin", pitch: 0.96, rate: 1.02 },
    },
    model: {
      care: "아끼시는 옷이 상해서 얼마나 속상하셨을지 압니다.",
      apologize: "저희 실수입니다. 정말 죄송합니다. 옷 상태를 제가 먼저 확인해 봐도 될까요?",
      lead: "세탁비는 바로 드리겠습니다. 그 이상의 보상은 제가 약속드리기 어려워, 책임자와 바로 상의하겠습니다.",
      makeSure: "세탁 후에도 얼룩이 남으면 다음 절차를 제가 직접 안내드리겠습니다. 감사합니다.",
    },
    sim: {
      lines: {
        angry: [
          "규정, 규정. 잘못은 그쪽이 했는데 왜 내가 참아야 해요?",
          "세탁비 몇 푼으로 끝내려는 거예요? 책임자 나오라 그래요.",
        ],
        softening: [
          "세탁해도 안 지워지면 그땐 어떻게 해 줄 건데요?",
          "책임자랑 얘기하면 달라지는 게 있어요?",
        ],
        calm: [
          "알겠어요. 일단 세탁부터 맡기고 결과 볼게요.",
          "그렇게 분명히 말해 주니 됐어요. 연락 주세요.",
        ],
      },
      closing: {
        angry: "말이 안 통하네요. 책임자랑 직접 얘기할게요.",
        softening: "그럼 책임자 올 때까지 기다릴게요.",
        calm: "네, 그 절차대로 할게요. 설명해 줘서 알겠어요.",
      },
      thoughts: {
        angry: "실수해 놓고 대충 넘어가려 하네.",
        softening: "그래도 책임지려는 모습은 보인다.",
        calm: "절차가 분명하니 믿어도 되겠다.",
      },
    },
  },
  {
    id: "global",
    tag: "외국인 고객",
    title: "세금 환급 안내가 틀려 시간을 버렸다는 외국인 고객 (영어)",
    place: "안내데스크",
    category: "글로벌",
    firstLine:
      "Excuse me! Your staff sent me to the wrong floor for the tax refund. I've wasted thirty minutes and my flight is tonight!",
    persona:
      "오늘 밤 출국하는 외국인 관광객. 세금 환급 창구를 잘못 안내받아 30분을 헤맸다. 영어로만 말한다.",
    hiddenNeed: "비행기 시간 전에 환급을 끝내고 싶어요. 짧고 정확한 안내가 필요해요.",
    goal: "쉬운 영어로 사과하고, 위치와 필요한 서류를 한 번에 정확히 안내하기",
    focus: "lead",
    policy: [
      "세금 환급 창구 위치와 운영 시간을 정확히 안내하고, 가능하면 직접 모셔다드려요.",
      "환급에는 여권과 구매 영수증이 필요해요.",
      "시간이 급한 고객에게는 공항에서 환급받는 방법도 함께 안내해요.",
    ],
    lang: "en",
    look: {
      gender: "m",
      age: "young",
      hair: "short",
      hairColor: "#8a5a34",
      skin: "#f1c7a6",
      outfit: "#4d6a8a",
      outfitAccent: "#e8e2d4",
      accessory: "cap",
      prop: "passport",
      backdrop: "lounge",
      voice: { id: "verse", pitch: 0.9, rate: 1.02 },
    },
    model: {
      care: "I understand you're in a hurry. That must have been really frustrating.",
      apologize: "I'm very sorry for the wrong directions. May I ask what time your flight is?",
      lead: "The tax refund desk is on this floor. I'll walk you there now. You'll need your passport and receipts.",
      makeSure:
        "If the line is long, you can also get the refund at the airport. Thank you for your patience.",
    },
    sim: {
      lines: {
        angry: [
          "I don't need excuses. Just tell me where to go, right now!",
          "Thirty minutes! Do you understand I might miss my flight?",
        ],
        softening: [
          "Okay. Which floor exactly? And what do I need to bring?",
          "Can someone take me there? I don't want to get lost again.",
        ],
        calm: [
          "All right, that's clear. Thank you for walking me there.",
          "Okay, passport and receipts. Got it.",
        ],
      },
      closing: {
        angry: "Forget it. I'll just do it at the airport.",
        softening: "Fine. Please just show me the way quickly.",
        calm: "Thanks for your help. I really appreciate it.",
      },
      thoughts: {
        angry: "또 헤매면 비행기를 놓칠지도 몰라.",
        softening: "정확한 위치만 알면 되는데.",
        calm: "이제 제대로 안내받았다.",
      },
    },
  },
];
