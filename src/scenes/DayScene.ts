import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from '@/config/resolution';
import {
  PLAYABLE_ITEMS, STAGE_ONE_ITEMS, TRADE_BALANCE, playableItemsForStage, type ItemSeed,
} from '@/config/tradeConfig';
import { INVENTORY_CONFIG } from '@/config/inventoryConfig';
import { DAY_TRANSITION_CONFIG } from '@/config/dayTransitionConfig';
import { customerQueueConfigForStage } from '@/config/customerQueueConfig';
import { CUSTOMER_CONFIG } from '@/config/customerConfig';
import { BAG_MERCHANT_CONFIG } from '@/config/bagMerchantConfig';
import {
  ITEM_SHOP_CONFIG,
  SPECIAL_ITEM_PRESENTATION,
  type SpecialItemKey,
} from '@/config/itemShopConfig';
import { AUTHENTICITY_CONFIG, fakeRiskByCategory } from '@/config/authenticityConfig';
import { RESULT_FEEDBACK_CONFIG } from '@/config/resultFeedbackConfig';
import { TUTORIAL_CONFIG } from '@/config/tutorialConfig';
import { AUDIO_CONFIG } from '@/config/audioConfig';
import {
  copulaParticle, subjectParticle, topicParticle,
} from '@/text/koreanParticle';
import { CustomerQueue } from '@/customer/customerQueue';
import { CustomerProfileStore, type CustomerType } from '@/customer/customerProfile';
import { Inventory, type OwnedItem } from '@/inventory/inventory';
import { purchaseItem } from '@/inventory/purchase';
import { DailyLedger } from '@/ledger/dailyLedger';
import { Market, type MarketTrend } from '@/market/market';
import { shouldOpenDayStartSales } from '@/market/dayStartSales';
import { sellItem } from '@/market/sale';
import { BagMerchant, type MerchantOffer } from '@/merchant/bagMerchant';
import { sellToMerchant } from '@/merchant/merchantSale';
import { SpecialItemInventory } from '@/item/specialItemInventory';
import { ItemShopVisit, shouldOpenItemShop } from '@/shop/itemShop';
import { GameState } from '@/state/gameState';
import { createCustomer, customerObservationClues, type Customer } from '@/trade/customer';
import { InvalidTradeActionError, TradeSession } from '@/trade/trade';
import {
  customerAttackLine,
  customerBreakOffLine,
  customerInventoryFullLine,
  customerNegotiationLine,
  customerPurchaseLine,
  customerRejectionLine,
} from '@/trade/customerDialogue';
import { negotiationRisk } from '@/trade/negotiationRisk';
import { adjustOfferAmount, OFFER_ADJUSTMENT_STEP } from '@/trade/offerInput';
import {
  calculateHoldingDays, TransactionHistory, type TransactionHistoryEntry,
} from '@/trade/transactionHistory';
import { feedbackColor, feedbackKindForProfit, type ResultFeedbackKind } from '@/ui/resultFeedback';

/** HUD SVG 의 논리 표시 크기(= SVG 파일 고유 크기). 래스터는 RENDER_SCALE 배로 굽는다. */
const HUD_SVG_SIZE = {
  day: { width: 120, height: 78 },
  cash: { width: 184, height: 58 },
  trust: { width: 164, height: 58 },
  visitor: { width: 204, height: 58 },
  time: { width: 130, height: 58 },
} as const;

const COLOR_DIM = '#a99b84';
const COLOR_DEV = '#5a4a2a';
const COLOR_BUTTON = '#e0bd75';
const COLOR_HUD_GOLD = '#f3d98f';
const UI_DISPLAY_FONT = '"Gowun Batang", serif';
const HUD_DISPLAY_FONT = UI_DISPLAY_FONT;
const INVENTORY_DISPLAY_FONT = UI_DISPLAY_FONT;
const MERCHANT_INTRO_SPEECH = '흐흐, 마지막 장사라\n월세 낼 돈이 급할 테지?\n내가 찾는 물건이라면\n파격적인 값에 사 주마.';
const CUSTOMER_ART_BY_NAME: Record<string, string> = {
  토끼: 'rabbit', 뱀: 'snake', 흰고양이: 'whitecat', 늑대: 'wolf-v2',
  검은고양이: 'blackcat', 독수리: 'eagle', 여우: 'fox', 염소: 'goat',
  부엉이: 'owl', 너구리: 'racoon', 수달: 'soodal', 두루미: 'durumi', 사자: 'lion',
};
type CustomerSpeech = (itemName: string, price: string) => string;
type FadableSound = Phaser.Sound.BaseSound & {
  volume: number;
  seek: number;
  setVolume: (value: number) => FadableSound;
};
type ItemShopProductKey = SpecialItemKey;
const ITEM_SHOP_PRODUCT_ORDER: readonly ItemShopProductKey[] = ['market', 'time', 'appraisal', 'defense'];
type TutorialStep = 'inactive' | 'firstArrival' | 'intro' | 'observe' | 'openItems' | 'chooseAppraisal'
  | 'confirmAppraisal' | 'firstLowInput' | 'firstLowOffer' | 'firstRaiseInput'
  | 'firstRaiseOffer' | 'firstResult' | 'firstDeparture' | 'waitSecond' | 'secondArrival'
  | 'secondIntro' | 'secondLowInput'
  | 'secondLowOffer' | 'secondRiskOffer' | 'attackResult' | 'trustIntro' | 'finale';
const CUSTOMER_SPEECH_BY_NAME: Record<string, CustomerSpeech> = {
  토끼: (item, price) => `저기… 이 ${item},\n${price}원에 넘기고 싶은데요.`,
  뱀: (item, price) => `좋은 ${copulaParticle(item)}지.\n${price}원이면 서로 괜찮지 않겠어?`,
  흰고양이: (item, price) => `이 ${item}, ${price}원이면\n품위에 맞는 값이겠죠?`,
  늑대: (item, price) => `${item}, ${price}원.\n그 아래는 곤란해.`,
  검은고양이: (item, price) => `보는 눈이 있다면 알겠지.\n${topicParticle(item)} ${price}원이야.`,
  독수리: (item, price) => `가치는 분명하다.\n${item}, ${price}원에 거래하지.`,
  여우: (item, price) => `이 ${subjectParticle(item)} ${price}원이면,\n꽤 괜찮은 제안 아닌가?`,
  염소: (item, price) => `상태를 살펴보시면 아시겠지만,\n${topicParticle(item)} ${price}원을 생각합니다.`,
  부엉이: (item, price) => `천천히 감정해 보시죠.\n${item}의 희망가는 ${price}원입니다.`,
  너구리: (item, price) => `손질까지 끝낸 ${copulaParticle(item)}에요.\n${price}원이면 넘길게요.`,
  수달: (item, price) => `아끼던 ${item}인데요!\n${price}원에 가져가실래요?`,
  두루미: (item, price) => `쉽게 내놓는 ${topicParticle(item)} 아니에요.\n${price}원을 원해요.`,
  사자: (item, price) => `이 ${item}의 값은 ${price}원이다.\n더 말할 필요 있나?`,
};
const CUSTOMER_SPEECH_BY_TYPE: Record<CustomerType, CustomerSpeech> = {
  honest: (item, price) => `사정이 있어서요. 이 ${item},\n${price}원에 넘기고 싶습니다.`,
  normal: (item, price) => `이 ${item}, ${price}원 정도면\n괜찮지 않을까요?`,
  suspicious: (item, price) => `${topicParticle(item)} 확실한 물건이에요.\n${price}원 아래로는 곤란합니다.`,
  fraudster: (item, price) => `이런 ${topicParticle(item)} 흔치 않아요.\n${price}원이면 아주 싼 겁니다.`,
};
/**
 * 텍스처 키는 `item-<물건 id>`이고 파일은 `assets/items/<물건 id>.webp`다.
 * 아트가 준비된 물건만(`artReady`) 읽고 그린다. 목록은 tradeConfig가 소유한다.
 */
const PLAYABLE_ITEM_IDS: ReadonlySet<string> = new Set(PLAYABLE_ITEMS.map((item) => item.id));

function itemTextureKey(itemId: string): string | null {
  return PLAYABLE_ITEM_IDS.has(itemId) ? `item-${itemId}` : null;
}
// 캐릭터마다 상반신 높이와 투명 여백이 달라 세로 위치를 보정한다.
// 기준은 '상반신 하단(팔 제외)'을 배경의 책상 상단 라인 y=465에 맞춘 값이다.
// 상반신 하단은 알파 폭이 최대 폭의 70% 이상인 가장 아래 행으로 측정했다.
/** 손님 초상은 표시 크기를 직접 지정한다. 원본 해상도를 바꿔도 배치가 흔들리지 않는다. */
const CUSTOMER_PORTRAIT_SIZE = { width: 553, height: 369 } as const;
/**
 * tooltip-left 프레임(표시 420x250)의 실측 기준선.
 * 내부 패널은 x -166~184(중심 +9), 제목 칸은 y -102~-56, 본문 칸은 y -56~101이다.
 * 창 배율(TOOL_WINDOW_SCALE)에 휘말리지 않게 말풍선은 씬 좌표에 직접 올린다.
 */
const TOOLTIP_FRAME = {
  width: 420,
  height: 250,
  centerX: 11,
  titleY: -82,
  bodyY: 24,
  contentLeft: -148,
  contentTop: -44,
  footerY: 66,
} as const;
const CUSTOMER_PORTRAIT_Y_OFFSET_BY_ASSET: Record<string, number> = {
  blackcat: -19, durumi: -12, eagle: -25, fox: -19, goat: -17, lion: -4,
  owl: -21, rabbit: 0, racoon: -13, snake: -16, soodal: -14, whitecat: -18, 'wolf-v2': -4,
};
const ITEM_ART_SCALE_BY_ID: Record<string, number> = {
  'vintage-camera': 1,
  'pocket-watch': 0.74,
  'old-coin-set': 0.82,
  'antique-glasses': 0.86,
  'antique-lighter': 0.72,
  'old-radio': 1.12,
  'signet-ring': 0.62,
  'antique-books': 1.05,
  'fountain-pen': 0.86,
  'mother-of-pearl-hand-mirror': 0.88,
  'brass-compass': 0.80,
  'clockwork-music-box': 0.85,
  'celadon-teacup': 0.75,
  'pearl-necklace': 0.89,
  'brass-telescope': 1.05,
  'jade-seal': 0.65,
  'gramophone': 1.00,
};
// 매입품 슬롯 전용 배율: 물건별 실제 비례와 원본 투명 여백을 보정한다.
const INVENTORY_ITEM_ART_SCALE_BY_ID: Record<string, number> = {
  'vintage-camera': 0.82, 'pocket-watch': 0.70, 'old-coin-set': 0.66,
  'antique-glasses': 0.62, 'antique-lighter': 0.55, 'old-radio': 0.72,
  'signet-ring': 0.50, 'antique-books': 0.75, 'fountain-pen': 0.58,
  'mother-of-pearl-hand-mirror': 0.72,
  'brass-compass': 0.65,
  'clockwork-music-box': 0.70,
  'celadon-teacup': 0.61,
  'pearl-necklace': 0.73,
  'brass-telescope': 0.80,
  'jade-seal': 0.53,
  'gramophone': 0.73,
};
// 원본 PNG마다 투명 여백이 달라 실제 물건 하단이 같은 탁자선에 닿도록 중심 Y를 보정한다.
// 신규 물건 아트를 넣으면 위 두 배율 표와 이 표에 항목을 추가해 실측으로 맞춘다.
// 항목이 없으면 각각 1 / 0.72 / 500 기본값으로 그려진다.
const TRADE_ITEM_Y_BY_ID: Record<string, number> = {
  'vintage-camera': 500,
  'pocket-watch': 501,
  'old-coin-set': 501,
  'antique-glasses': 523,
  'antique-lighter': 508,
  'old-radio': 493,
  'signet-ring': 521,
  'antique-books': 493,
  'fountain-pen': 495,
  'mother-of-pearl-hand-mirror': 496,
  'brass-compass': 501,
  'clockwork-music-box': 493,
  'celadon-teacup': 515,
  'pearl-necklace': 510,
  'brass-telescope': 510,
  'jade-seal': 510,
  'gramophone': 482,
};
/**
 * 정산서 부제(DAY · 영업 종료 · STAGE 목표 손익) 배치 기준.
 * 종이를 500px로 그렸을 때 이 줄 높이의 밝은 지면은 411px뿐이라,
 * STAGE 목표 손익 자릿수가 늘어나면 글자가 테두리 밖으로 밀려 나간다.
 * 구분자 여백을 좁히고, 그래도 넘치면 글자 크기를 줄여 모든 STAGE·DAY에서 종이 안에 담는다.
 */
const STATEMENT_SUBTITLE = {
  baseFontSize: 15,
  minimumFontSize: 11,
  maxWidth: 380,
  /** 구분자 양옆 여백. 4칸은 너무 벌어져 종이 밖으로 넘쳤다. */
  separator: '  ·  ',
} as const;
/**
 * DAY 증가 연출의 가로 배치. 숫자가 세로로만 움직이도록 라벨과 숫자를 각각 고정한다.
 * 두 값의 간격(52px)이 `DAY 2`의 보통 자간보다 넓은 것은 숫자를 따로 세우는 연출 때문이다.
 */
/** 시세 장부 하단 위조 위험 줄의 배치. y는 패널 실측값이다(주석은 생성 코드에 있다). */
/**
 * 보따리 상인 상세 영역의 세로 배치.
 *
 * 배경 아트(background-clean-v11, 원본 1024x576을 1:1로 그린다) 실측값 기준이다.
 * 상세 박스 테두리는 local y 30과 182, 물건 그림 프레임 내부는 49와 162로
 * 두 영역의 중심이 모두 y=106이다. 세 줄을 45px 간격으로 그 중심에 맞춰
 * 위아래 여백이 21px / 22px로 균형을 이룬다.
 * 이전에는 49 / 97 / 142(중심 95.5)라 블록이 10.5px 위로 치우쳐 있었다.
 */
const MERCHANT_DETAIL_LAYOUT = {
  centerY: 106,
  rowGap: 45,
} as const;

const HISTORY_FAKE_RISK = {
  y: 274,
  gap: 12,
  dividerWidth: 1,
  dividerHeight: 15,
} as const;

const DAY_CHANGE_LAYOUT = {
  labelRightX: -34,
  numberLeftX: 18,
} as const;
const MAIN_LAYOUT = {
  dayY: 37,
  daySubtitleY: 67,
  moneyY: 40,
  phaseY: 43,
  timerY: 40,
  queueY: 92,
  actionY: 650,
  specialActionY: 555,
} as const;
/** 제안가 에셋의 불투명 프레임(111px)을 행동 버튼(107px)에 맞추는 비율. */
const OFFER_PANEL_SCALE = 108 / 112;
const OFFER_PANEL_CENTER_X = 330;
const OFFER_PRIMARY_ROW_Y = MAIN_LAYOUT.actionY + 7 * OFFER_PANEL_SCALE;
const OFFER_SECONDARY_ROW_Y = MAIN_LAYOUT.actionY - 27 * OFFER_PANEL_SCALE;
const SHUTTER_LAYOUT = {
  titleLogoWidth: 416,
  titleLogoOffsetY: -80,
  gameStartButtonWidth: 269,
  gameStartButtonOffsetY: 210,
} as const;
const TOOL_WINDOW_SCALE = 0.68;
const SPECIAL_ITEM_POPUP_DEFAULT_POSITION = { x: 320, y: 250 } as const;
/** 아이템 창·매입품 창·거래 기록은 나중에 클릭한 쪽이 위로 온다. */
const TOOL_WINDOW_BASE_DEPTH = 140;
/** 말풍선은 모든 창보다 위에 그린다. */
const TOOLTIP_DEPTH = 148;
/** 다음날 시세 예측 버튼에 띄우는 안내. */
const SALES_PREVIEW_HINT = '시세 수첩 아이템이 있다면\n다음날의 시세를 미리 알 수 있습니다.';
const FAKE_SALES_PREVIEW_HINT = '가품은 판매가가 고정되어\n다음날 시세를 예측할 수 없습니다.';
const FINAL_DAY_SALES_PREVIEW_HINT = 'STAGE 마지막 DAY에는\n예측할 다음 DAY 시세가 없습니다.';
const COMPLETED_SALES_PREVIEW_HINT = '이 물건의 다음날 시세를\n이미 확인했습니다.';
const TUTORIAL_PANEL_HALF_WIDTH = 300;
const TUTORIAL_PANEL_HALF_HEIGHT = 92;
const TUTORIAL_ACTION_CUE_MARGIN = 46;
/** 하이라이트 구역이 2개일 때 어두운 영역을 덮는 데 필요한 최대 조각 수. */
const TUTORIAL_MASK_PIECE_COUNT = 16;
const TUTORIAL_INSTRUCTION_TOP = -22;

/**
 * 하루 진행을 보여 주는 최소 화면.
 *
 * 상태 전이 규칙은 전부 GameState 가 가지고 있고, 이 Scene 은
 * 상태를 텍스트로 표현하고 입력을 GameState 에 전달하는 역할만 한다.
 */
export class DayScene extends Phaser.Scene {
  private state!: GameState;

  private dayText!: Phaser.GameObjects.Text;
  private daySubtitleText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private trustLabelText!: Phaser.GameObjects.Text;
  private trustBarBackground!: Phaser.GameObjects.Rectangle;
  private trustBarFill!: Phaser.GameObjects.Rectangle;
  private trustPercentText!: Phaser.GameObjects.Text;
  private trustTutorialFocus!: Phaser.GameObjects.Zone;
  private dayTextWear!: Phaser.GameObjects.Text;
  private daySubtitleWear!: Phaser.GameObjects.Text;
  private moneyTextWear!: Phaser.GameObjects.Text;
  private trustLabelWear!: Phaser.GameObjects.Text;
  private trustPercentWear!: Phaser.GameObjects.Text;
  private timerTextWear!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private customerQueueText!: Phaser.GameObjects.Text;
  private customerQueuePanel!: Phaser.GameObjects.Image;
  private customerPortrait!: Phaser.GameObjects.Image;
  private customerSpeechBubble!: Phaser.GameObjects.Container;
  private customerSpeechLines: Phaser.GameObjects.Text[] = [];
  private customerSpeechTarget = '';
  private customerSpeechCustomerId: string | null = null;
  private customerSpeechCharacterCount = 0;
  private customerSpeechElapsedMilliseconds = 0;
  private lastUiClickPointerTimestamp = -1;
  private customerTypingSound?: Phaser.Sound.BaseSound;
  private backgroundMusic?: FadableSound;
  private backgroundMusicStandby?: FadableSound;
  private backgroundMusicLoopTimer?: Phaser.Time.TimerEvent;
  private backgroundMusicFadeTween?: Phaser.Tweens.Tween;
  private backgroundMusicStopping = false;
  private customerExitAnimating = false;
  private firstCustomerArrivalPending = false;
  private tradeItemPreview!: Phaser.GameObjects.Image;
  private closeDayButton!: Phaser.GameObjects.Container;
  private trade = new TradeSession();
  private customerQueue = new CustomerQueue(customerQueueConfigForStage(1));
  private offerInputBackground!: Phaser.GameObjects.Image;
  private offerInputLabel!: Phaser.GameObjects.Text;
  private offerInitialText!: Phaser.GameObjects.Text;
  private offerText!: Phaser.GameObjects.Text;
  private offerUpButton!: Phaser.GameObjects.Text;
  private offerDownButton!: Phaser.GameObjects.Text;
  private offerHoldDelayTimer?: Phaser.Time.TimerEvent;
  private offerHoldRepeatTimer?: Phaser.Time.TimerEvent;
  private historyFakeRiskLabel!: Phaser.GameObjects.Text;
  private historyFakeRiskDivider!: Phaser.GameObjects.Rectangle;
  private historyFakeRiskText!: Phaser.GameObjects.Text;
  private customerClueText!: Phaser.GameObjects.Text;
  private tutorialItemClueFocus!: Phaser.GameObjects.Zone;
  private offerButton!: Phaser.GameObjects.Container;
  private rejectButton!: Phaser.GameObjects.Container;
  private typedOffer = '';
  private replaceOfferOnNextDigit = true;
  private inventory = new Inventory();
  private leftMenuButtons: Phaser.GameObjects.Image[] = [];
  private leftMenuLabels: Phaser.GameObjects.Text[] = [];
  private inventoryButton!: Phaser.GameObjects.Image;
  private inventoryPopup!: Phaser.GameObjects.Container;
  private inventoryCells: Phaser.GameObjects.Container[] = [];
  private inventoryCellFrames: Phaser.GameObjects.Rectangle[] = [];
  private inventoryCellVelvets: Phaser.GameObjects.Rectangle[] = [];
  private inventoryCellOrnaments: Phaser.GameObjects.Graphics[] = [];
  private inventoryCellImages: Phaser.GameObjects.Image[] = [];
  private inventoryCellLabels: Phaser.GameObjects.Text[] = [];
  private inventoryCellQuantities: Phaser.GameObjects.Text[] = [];
  private inventoryDetailPanel!: Phaser.GameObjects.Container;
  private inventoryDetailBackground!: Phaser.GameObjects.Image;
  private inventoryDetailTitle!: Phaser.GameObjects.Text;
  private inventoryDetail!: Phaser.GameObjects.Text;
  private inventoryDetailAuthenticity!: Phaser.GameObjects.Text;
  private inventoryOpen = false;
  private hoveredInventoryIndex: number | null = null;
  private ledger = new DailyLedger();
  private transactionHistory = new TransactionHistory();
  private historyPopup!: Phaser.GameObjects.Container;
  private historySummaryTexts: Phaser.GameObjects.Text[] = [];
  private historyEntryTexts: Phaser.GameObjects.Text[] = [];
  private historyOpen = false;
  private openingMoney = 0;
  private closingMoney = 0;
  private devCashAdjustment = 0;
  /** 이 STAGE 동안 이미 마감된 DAY들의 실현 손익 합. 오늘 몫은 ledger에서 더한다. */
  private closedDaysRealizedProfit = 0;
  private stageGoalOpen = false;
  private stageGoalPopup!: Phaser.GameObjects.Container;
  private stageGoalTitle!: Phaser.GameObjects.Text;
  private stageGoalText!: Phaser.GameObjects.Text;
  private statementReady = false;
  private shutter!: Phaser.GameObjects.Image;
  private shutterBacking!: Phaser.GameObjects.Rectangle;
  private gameStartButton!: Phaser.GameObjects.Image;
  private gameTitleLogo!: Phaser.GameObjects.Image;
  private gameStarted = false;
  private shutterAnimating = false;
  private statementPopup!: Phaser.GameObjects.Container;
  private statementDayText!: Phaser.GameObjects.Text;
  private statementLabelsText!: Phaser.GameObjects.Text;
  private statementValuesText!: Phaser.GameObjects.Text;
  private statementTotalText!: Phaser.GameObjects.Text;
  private statementStamp!: Phaser.GameObjects.Image;
  private statementWasVisible = false;
  private statementStampDelayTimer?: Phaser.Time.TimerEvent;
  private dayChangeOverlay!: Phaser.GameObjects.Container;
  private dayNumberSwapSoundTimer?: Phaser.Time.TimerEvent;
  private dayChangeLabel!: Phaser.GameObjects.Text;
  private dayChangeOldNumber!: Phaser.GameObjects.Text;
  private dayChangeNewNumber!: Phaser.GameObjects.Text;
  private dayChangeAnimating = false;
  private statementRevealTimers: Phaser.Time.TimerEvent[] = [];
  private statementRevealContent: { labels: string[]; values: string[]; total: string } | null = null;
  private market = new Market();
  private salesOpen = true;
  private salesPopup!: Phaser.GameObjects.Container;
  private salesCells: Phaser.GameObjects.Container[] = [];
  private salesCellFrames: Phaser.GameObjects.Rectangle[] = [];
  private salesCellImages: Phaser.GameObjects.Image[] = [];
  private salesCellNames: Phaser.GameObjects.Text[] = [];
  private salesCellMeta: Phaser.GameObjects.Text[] = [];
  private salesPreviewImage!: Phaser.GameObjects.Image;
  private salesChart!: Phaser.GameObjects.Graphics;
  private salesChartTitle!: Phaser.GameObjects.Text;
  private salesChartLabels: Phaser.GameObjects.Text[] = [];
  private salesPageText!: Phaser.GameObjects.Text;
  private salesPreviousPageButton!: Phaser.GameObjects.Container;
  private salesNextPageButton!: Phaser.GameObjects.Container;
  private salesEmptyText!: Phaser.GameObjects.Text;
  private salesPage = 0;
  private salesDetail!: Phaser.GameObjects.Text;
  private salesDetailRule!: Phaser.GameObjects.Rectangle;
  private salesCompletePanel!: Phaser.GameObjects.Container;
  private salesCompleteTitle!: Phaser.GameObjects.Text;
  private salesCompleteText!: Phaser.GameObjects.Text;
  private sellButton!: Phaser.GameObjects.Container;
  private selectedSaleId: string | null = null;
  private salesMessage = '판매할 물건을 선택하세요.';
  private bagMerchant = new BagMerchant(BAG_MERCHANT_CONFIG);
  private merchantPopup!: Phaser.GameObjects.Container;
  private merchantOfferCells: Phaser.GameObjects.Container[] = [];
  private merchantOfferFrames: Phaser.GameObjects.Rectangle[] = [];
  private merchantOfferImages: Phaser.GameObjects.Image[] = [];
  private merchantOfferNames: Phaser.GameObjects.Text[] = [];
  private merchantOfferPrices: Phaser.GameObjects.Text[] = [];
  private merchantOfferBadges: Phaser.GameObjects.Text[] = [];
  private merchantPage = 0;
  private merchantPreviousPage!: Phaser.GameObjects.Text;
  private merchantNextPage!: Phaser.GameObjects.Text;
  private merchantDetailImage!: Phaser.GameObjects.Image;
  private merchantMessage!: Phaser.GameObjects.Text;
  private merchantDetailTitle!: Phaser.GameObjects.Text;
  private merchantPurchasePrice!: Phaser.GameObjects.Text;
  private merchantOfferPrice!: Phaser.GameObjects.Text;
  private merchantSpeechText!: Phaser.GameObjects.Text;
  private merchantSellButton!: Phaser.GameObjects.Container;
  private merchantFinishButton!: Phaser.GameObjects.Container;
  private merchantSaleResultPanel!: Phaser.GameObjects.Container;
  private merchantSaleResultText!: Phaser.GameObjects.Text;
  private selectedMerchantOfferIndex: number | null = null;
  private stageResultPopup!: Phaser.GameObjects.Container;
  private stageResultTitle!: Phaser.GameObjects.Text;
  private stageResultText!: Phaser.GameObjects.Text;
  private stageResultAction!: Phaser.GameObjects.Text;
  private stageResultActionBackground!: Phaser.GameObjects.Image;
  private stageResultActionButton!: Phaser.GameObjects.Container;
  private specialItems = new SpecialItemInventory(ITEM_SHOP_CONFIG.startingAppraisalTicketCount);
  private appraisalButton!: Phaser.GameObjects.Image;
  private specialItemPopup!: Phaser.GameObjects.Container;
  private specialItemPopupOpen = false;
  private specialItemCountTexts: Phaser.GameObjects.Text[] = [];
  private specialItemAppraisalCard!: Phaser.GameObjects.Container;
  private specialItemTimeCard!: Phaser.GameObjects.Container;
  private specialItemDefenseCard!: Phaser.GameObjects.Container;
  private specialItemTooltip!: Phaser.GameObjects.Container;
  private specialItemTooltipBackground!: Phaser.GameObjects.Image;
  private specialItemTooltipTitle!: Phaser.GameObjects.Text;
  private specialItemTooltipBody!: Phaser.GameObjects.Text;
  private appraisalPopup!: Phaser.GameObjects.Container;
  private appraisalResultFrame!: Phaser.GameObjects.Image;
  private appraisalResultText!: Phaser.GameObjects.Text;
  private appraisalConfirmButton!: Phaser.GameObjects.Container;
  private appraisalPopupOpen = false;
  private itemShopVisit: ItemShopVisit | null = null;
  private itemShopPopup!: Phaser.GameObjects.Container;
  private itemShopCloseButton!: Phaser.GameObjects.Image;
  private itemShopCloseHitArea!: Phaser.GameObjects.Rectangle;
  private itemShopStageDayText!: Phaser.GameObjects.Text;
  private itemShopMoneyText!: Phaser.GameObjects.Text;
  private itemShopProductFrames = new Map<ItemShopProductKey, Phaser.GameObjects.Rectangle>();
  private itemShopProductNameTexts = new Map<ItemShopProductKey, Phaser.GameObjects.Text>();
  private itemShopProductOwnedTexts = new Map<ItemShopProductKey, Phaser.GameObjects.Text>();
  private itemShopProductPriceTexts = new Map<ItemShopProductKey, Phaser.GameObjects.Text>();
  private itemShopDetailTitle!: Phaser.GameObjects.Text;
  private itemShopDetailDescription!: Phaser.GameObjects.Text;
  private itemShopDetailImage!: Phaser.GameObjects.Image;
  private itemShopDetailPrice!: Phaser.GameObjects.Text;
  private itemShopPurchaseButton!: Phaser.GameObjects.Container;
  private itemShopPurchaseBackground!: Phaser.GameObjects.Image;
  private itemShopPurchaseLabel!: Phaser.GameObjects.Text;
  private selectedItemShopProduct: ItemShopProductKey = 'market';
  private marketPreviewButton!: Phaser.GameObjects.Container;
  private marketPreviewButtonLabel!: Phaser.GameObjects.Text;
  private marketPreviewHint!: Phaser.GameObjects.Container;
  private marketPreviewHintText!: Phaser.GameObjects.Text;
  private marketPreviews = new Map<string, number>();
  private customerProfiles = new CustomerProfileStore();
  /** 하루 동안 이미 등장한 손님·물건. 같은 날 중복 방문을 막는다. */
  private todaysCustomerNames: string[] = [];
  private todaysItemIds: string[] = [];
  private defenseActive = false;
  private eventPopup!: Phaser.GameObjects.Container;
  private eventResultFrame!: Phaser.GameObjects.Image;
  private eventTitle!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private eventConfirmButton!: Phaser.GameObjects.Container;
  private eventPopupOpen = false;
  private devPanel!: Phaser.GameObjects.Container;
  private devPanelMessage!: Phaser.GameObjects.Text;
  private forcedNextRisk: 'attacked' | 'brokenOff' | null = null;
  private merchantSaleFeedback: string | null = null;
  private tutorialStep: TutorialStep = 'inactive';
  private toolWindows: Array<{
    window: Phaser.GameObjects.Container; width: number; height: number;
  }> = [];
  /** 뒤 -> 앞 순서. 마지막 원소가 가장 위에 그려진다. */
  private toolWindowOrder: Phaser.GameObjects.Container[] = [];
  private tutorialMasks: Phaser.GameObjects.Rectangle[] = [];
  private tutorialBorder!: Phaser.GameObjects.Graphics;
  private tutorialConnector!: Phaser.GameObjects.Graphics;
  private tutorialActionCue!: Phaser.GameObjects.Container;
  private tutorialActionArrow!: Phaser.GameObjects.Text;
  private tutorialActionCuePlacement: 'above' | 'below' | null = null;
  private tutorialPanel!: Phaser.GameObjects.Container;
  private tutorialPurchaseResult: {
    itemName: string; offer: number;
  } | null = null;
  private tutorialTitleText!: Phaser.GameObjects.Text;
  private tutorialInstruction!: Phaser.GameObjects.Text;
  private tutorialNextButton!: Phaser.GameObjects.Text;
  private tutorialSkipButton!: Phaser.GameObjects.Text;
  private tutorialSkipped = false;
  private tutorialOverlayVisible = false;
  private tutorialTrustSnapshot: number | null = null;
  private tutorialInputError: string | null = null;
  private tutorialInputErrorCharacterCount = 0;
  private tutorialInputErrorElapsedMilliseconds = 0;

  constructor() {
    super('Day');
  }

  preload(): void {
    this.load.audio('bgm-mysterious-pawnshop', 'assets/audio/music/mysterious-pawnshop-bgm.mp3');
    this.load.audio('sfx-shutter', 'assets/audio/sfx/shutter.wav');
    this.load.audio('sfx-shutter-close', 'assets/audio/sfx/shutter-close.wav');
    this.load.audio('sfx-customer-bell', 'assets/audio/sfx/customer-bell.wav');
    this.load.audio('sfx-statement-line', 'assets/audio/sfx/statement-line-click.wav');
    this.load.audio('sfx-statement-paper', 'assets/audio/sfx/statement-paper.wav');
    this.load.audio('sfx-customer-typing', 'assets/audio/sfx/customer-typing.wav');
    this.load.audio('sfx-ui-click', 'assets/audio/sfx/ui-click.wav');
    this.load.audio('sfx-cash-register', 'assets/audio/sfx/cash-register.wav');
    this.load.audio('sfx-day-number-swap', 'assets/audio/sfx/day-number-swap.wav');
    this.load.audio('sfx-shop-window-bell', 'assets/audio/sfx/shop-window-bell.wav');
    this.load.image('pawnshop-background', 'assets/backgrounds/pawnshop.webp');
    this.load.image(
      'mockup-background',
      'assets/backgrounds/pawnshop-notice.webp',
    );
    this.load.svg('hud-v2-day', 'assets/ui/hud/day.svg', { scale: RENDER_SCALE });
    this.load.svg('hud-v2-cash', 'assets/ui/hud/cash.svg', { scale: RENDER_SCALE });
    this.load.svg('hud-v2-trust', 'assets/ui/hud/trust.svg', { scale: RENDER_SCALE });
    this.load.svg('hud-v2-visitor', 'assets/ui/hud/visitor.svg', { scale: RENDER_SCALE });
    this.load.svg('hud-v2-time', 'assets/ui/hud/time.svg', { scale: RENDER_SCALE });
    this.load.image('hud-v3-menu-ledger', 'assets/ui/hud/menu-ledger.webp');
    this.load.image('hud-v3-menu-appraise', 'assets/ui/hud/menu-appraise.webp');
    this.load.image('hud-v3-menu-appraise-magnifier-only', 'assets/ui/hud/menu-appraise-magnifier-only.webp');
    this.load.image('hud-v3-menu-inventory', 'assets/ui/hud/menu-inventory.webp');
    this.load.image('hud-v3-menu-inventory-bag-only', 'assets/ui/hud/menu-inventory-bag-only.webp');
    this.load.image('hud-v2-offer', 'assets/ui/hud/offer-panel.webp');
    this.load.image('hud-v2-action-buy', 'assets/ui/hud/action-buy.webp');
    this.load.image('hud-v2-action-reject', 'assets/ui/hud/action-reject.webp');
    this.load.image('hud-v2-close-day', 'assets/ui/hud/close-day.webp');
    Object.values(CUSTOMER_ART_BY_NAME).forEach((assetName) => {
      this.load.image(`customer-${assetName}`, `assets/customers/${assetName}.webp`);
    });
    PLAYABLE_ITEMS.forEach((item) => {
      // 게임에서 그리는 최대 크기가 190px이라 256px 축소본만 읽는다. 원본은 art/items/에 보관.
      this.load.image(`item-${item.id}`, `assets/items/${item.id}.webp`);
    });
    this.load.image('dialogue-frame', 'assets/ui/trade/dialogue-frame.webp');
    this.load.image('customer-speech-bubble', 'assets/ui/trade/speech-bubble.webp');
    this.load.image('merchant-background', 'assets/ui/merchant/background-clean-v11.webp');
    this.load.image('merchant-speech-bubble', 'assets/ui/merchant/speech-bubble.webp');
    this.load.image('merchant-sale-button', 'assets/ui/merchant/sale-button-v3.webp');
    this.load.image('merchant-stage-end-button', 'assets/ui/merchant/stage-end-button-v3.webp');
    this.load.image('roll-shutter', 'assets/backgrounds/roll-shutter.webp');
    this.load.image('button-game-start', 'assets/ui/title/game-start.webp');
    this.load.image('game-title-logo', 'assets/ui/title/logo.webp');
    this.load.image('special-item-popup', 'assets/ui/special-items/popup.webp');
    this.load.image('special-item-popup-title-clean', 'assets/ui/special-items/popup-title-runtime-clean.webp');
    // 아이콘은 78~155px로만 그리므로 1254px 원본이 아니라 256px 축소본을 쓴다(축소 계단 방지).
    this.load.image('special-item-market', 'assets/ui/special-items/market-notebook.webp');
    this.load.image('special-item-time', 'assets/ui/special-items/hourglass.webp');
    this.load.image('special-item-appraisal', 'assets/ui/special-items/appraisal-kit.webp');
    this.load.image('special-item-defense', 'assets/ui/special-items/defense-talisman.webp');
    this.load.image('purchased-items-popup', 'assets/ui/inventory/popup.webp');
    this.load.image('purchased-items-popup-title-clean', 'assets/ui/inventory/popup-title-runtime-clean.webp');
    this.load.image('tooltip-left', 'assets/ui/tooltips/left.webp');
    this.load.image('transaction-history-popup', 'assets/ui/history/popup.webp');
    this.load.image('statement-base', 'assets/ui/statement/base.webp');
    this.load.image('statement-section-plaque', 'assets/ui/statement/section-plaque.webp');
    this.load.image('statement-total-frame', 'assets/ui/statement/total-frame.webp');
    this.load.image('statement-stamp', 'assets/ui/statement/stamp.webp');
    this.load.image('statement-next-button', 'assets/ui/statement/next-day-button.webp');
    this.load.image('item-shop-shell', 'assets/ui/item-shop/shell.webp');
    this.load.image('item-shop-ledger', 'assets/ui/item-shop/ledger-clean.webp');
    this.load.image('item-shop-detail-sheet', 'assets/ui/item-shop/detail-sheet.webp');
    this.load.image('item-shop-purchase-button', 'assets/ui/item-shop/purchase-button.webp');
    this.load.image('item-shop-close-button', 'assets/ui/item-shop/close-button.webp');
    this.load.image('sales-shell-clean', 'assets/ui/sales/shell-clean.webp');
    this.load.image('appraisal-result-frame', 'assets/ui/appraisal/result-frame.webp');
    this.load.image('appraisal-result-confirm', 'assets/ui/appraisal/confirm-button.webp');
  }

  create(): void {
    // Phaser scene.restart()는 Scene 인스턴스를 재사용한다. 파괴된 이전 GameObject 참조가
    // 배열·Map에 남으면 새 UI와 함께 render()되어 입력 등록 중 예외가 발생한다.
    this.resetSceneUiCollections();
    // 인스턴스 필드도 유지되므로 타이틀 입력을 막는 실행 상태를 명시적으로 초기화한다.
    this.gameStarted = false;
    this.shutterAnimating = false;
    this.backgroundMusicStopping = false;
    this.state = new GameState();
    this.devCashAdjustment = 0;
    this.openingMoney = this.state.money;
    this.market.updateForDay(this.state.day);
    this.salesOpen = shouldOpenDayStartSales(this.state.stage, this.state.day, this.inventory.size);

    // 백킹스토어를 키운 만큼 카메라를 확대해 논리 좌표계를 1280x720 으로 되돌린다.
    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;
    const centerX = width / 2;

    this.add.image(centerX, height / 2, 'mockup-background')
      .setDisplaySize(width, height)
      .setDepth(-100);
    this.add.image(74, 50, 'hud-v2-day').setDisplaySize(HUD_SVG_SIZE.day.width, HUD_SVG_SIZE.day.height).setDepth(-10);
    this.add.image(229, 40, 'hud-v2-cash').setDisplaySize(HUD_SVG_SIZE.cash.width, HUD_SVG_SIZE.cash.height).setDepth(-10);
    this.add.image(405, 40, 'hud-v2-trust').setDisplaySize(HUD_SVG_SIZE.trust.width, HUD_SVG_SIZE.trust.height).setDepth(-10);
    this.add.image(1215, 40, 'hud-v2-time').setDisplaySize(HUD_SVG_SIZE.time.width, HUD_SVG_SIZE.time.height).setDepth(-10);

    this.dayText = this.add
      .text(74, MAIN_LAYOUT.dayY + 1, '', {
        fontFamily: UI_DISPLAY_FONT,
        fontSize: '29px',
        fontStyle: 'bold',
        color: COLOR_HUD_GOLD,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 4, true, true);
    this.dayTextWear = this.createWornTextOverlay(this.dayText, 28, 24, 92, 25, 11);

    this.daySubtitleText = this.add
      .text(74, MAIN_LAYOUT.daySubtitleY + 1, '', {
        fontFamily: UI_DISPLAY_FONT,
        fontSize: '29px',
        fontStyle: 'bold',
        color: COLOR_HUD_GOLD,
      })
      .setOrigin(0.5)
      .setShadow(0, 1, '#000000', 3, true, true);
    this.daySubtitleWear = this.createWornTextOverlay(this.daySubtitleText, 28, 57, 92, 18, 17);

    this.moneyText = this.add
      .text(229, MAIN_LAYOUT.moneyY, '', {
        fontFamily: UI_DISPLAY_FONT,
        fontSize: '29px',
        fontStyle: 'bold',
        color: COLOR_HUD_GOLD,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 4, true, true);
    this.moneyTextWear = this.createWornTextOverlay(this.moneyText, 145, 22, 168, 29, 23);

    this.trustLabelText = this.add.text(344, 30, '신뢰도', {
      fontFamily: UI_DISPLAY_FONT,
      fontSize: '29px',
      fontStyle: 'bold',
      color: COLOR_HUD_GOLD,
    }).setOrigin(0, 0.5).setVisible(false);
    this.trustLabelWear = this.createWornTextOverlay(this.trustLabelText, 332, 21, 54, 17, 37)
      .setVisible(false);
    this.trustBarBackground = this.add.rectangle(344, 52, 78, 12, 0x38353d)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x6a5e6e)
      .setVisible(false);
    this.trustBarFill = this.add.rectangle(346, 52, 74, 8, 0xa96ac4)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.trustPercentText = this.add.text(454, 52, '', {
      fontFamily: UI_DISPLAY_FONT,
      fontSize: '29px',
      fontStyle: 'bold',
      color: COLOR_HUD_GOLD,
    }).setOrigin(0.5).setVisible(false);
    this.trustPercentWear = this.createWornTextOverlay(this.trustPercentText, 422, 35, 54, 23, 41)
      .setVisible(false);
    this.trustTutorialFocus = this.add.zone(405, 40, 158, 54).setOrigin(0.5);

    this.timerText = this.add
      .text(1215, MAIN_LAYOUT.timerY, '', {
        fontFamily: UI_DISPLAY_FONT,
        fontSize: '29px',
        fontStyle: 'bold',
        color: COLOR_HUD_GOLD,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000000', 4, true, true);
    this.timerTextWear = this.createWornTextOverlay(this.timerText, 1150, 20, 130, 31, 47);

    this.customerQueuePanel = this.add.image(1046, 40, 'hud-v2-visitor')
      .setDisplaySize(HUD_SVG_SIZE.visitor.width, HUD_SVG_SIZE.visitor.height)
      .setDepth(-10)
      .setVisible(false);
    this.customerQueueText = this.add.text(1046, 40, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '17px', fontStyle: 'bold',
      color: COLOR_HUD_GOLD, align: 'center',
    }).setOrigin(0.5);

    this.customerPortrait = this.add.image(520, 309, 'customer-rabbit')
      .setDisplaySize(CUSTOMER_PORTRAIT_SIZE.width, CUSTOMER_PORTRAIT_SIZE.height)
      .setDepth(-5)
      .setVisible(false);
    const speechBackground = this.add.image(0, 0, 'customer-speech-bubble')
      .setDisplaySize(360, 203);
    this.customerSpeechLines = [0, 1].map(() => this.add.text(0, 0, '', {
      fontFamily: HUD_DISPLAY_FONT,
      fontSize: '15px',
      color: '#e5d4b3',
      align: 'center',
      fixedWidth: 292,
    }).setOrigin(0.5));
    this.customerSpeechBubble = this.add.container(830, 200, [speechBackground, ...this.customerSpeechLines])
      .setDepth(-3)
      .setVisible(false);
    this.tradeItemPreview = this.add.image(820, 520, 'item-vintage-camera')
      .setDepth(-4)
      .setVisible(false);
    this.offerInputBackground = this.add.image(OFFER_PANEL_CENTER_X, MAIN_LAYOUT.actionY, 'hud-v2-offer')
      .setScale(OFFER_PANEL_SCALE)
      .setInteractive({ useHandCursor: true })
      .setDepth(-1)
      .on('pointerover', () => this.offerInputBackground.setTint(0xffe3aa))
      .on('pointerout', () => this.offerInputBackground.clearTint())
      .on('pointerdown', () => this.beginDirectOfferInput());
    this.offerInputLabel = this.add.text(222, OFFER_PRIMARY_ROW_Y, '제안가', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '18px', fontStyle: 'bold', color: COLOR_HUD_GOLD,
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true);
    this.offerInitialText = this.add.text(OFFER_PANEL_CENTER_X, OFFER_SECONDARY_ROW_Y, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '14px', fontStyle: 'bold', color: '#bda675', align: 'center',
    }).setOrigin(0.5).setShadow(0, 1, '#000000', 3, true, true);
    this.offerText = this.add.text(OFFER_PANEL_CENTER_X, OFFER_PRIMARY_ROW_Y, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '29px', fontStyle: 'bold', color: COLOR_HUD_GOLD,
      padding: { x: 4, y: 4 },
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.beginDirectOfferInput());
    this.offerUpButton = this.makeOfferArrowButton(
      438, OFFER_PRIMARY_ROW_Y, '▲', () => this.adjustOffer(OFFER_ADJUSTMENT_STEP),
    )
      .on('pointerdown', () => this.startOfferHold(OFFER_ADJUSTMENT_STEP))
      .on('pointerup', () => this.stopOfferHold())
      .on('pointerout', () => this.stopOfferHold());
    this.offerDownButton = this.makeOfferArrowButton(
      475, OFFER_PRIMARY_ROW_Y, '▼', () => this.adjustOffer(-OFFER_ADJUSTMENT_STEP),
    )
      .on('pointerdown', () => this.startOfferHold(-OFFER_ADJUSTMENT_STEP))
      .on('pointerup', () => this.stopOfferHold())
      .on('pointerout', () => this.stopOfferHold());
    this.input.on('pointerup', () => this.stopOfferHold());
    this.offerButton = this.makeMockupActionButton(
      583, MAIN_LAYOUT.actionY, 'hud-v2-action-buy', '매입\n제안', () => this.submitOffer(),
    );
    this.rejectButton = this.makeMockupActionButton(
      706, MAIN_LAYOUT.actionY, 'hud-v2-action-reject', '거절\n하기', () => this.rejectTrade(),
    );

    this.createLeftMenu();
    this.createTransactionHistoryPopup();
    // 거래 기록은 드래그 대상이 아니지만 창 쌓기에는 참여한다.
    this.toolWindows.push({ window: this.historyPopup, width: 930, height: 620 });
    this.toolWindowOrder.push(this.historyPopup);
    this.closeDayButton = this.makeCloseDayButton(66, MAIN_LAYOUT.actionY);
    this.createInventoryPopup();
    this.createSpecialItemPopup();
    this.createDayEndUi();
    this.createDayChangeOverlay();
    this.createSalesPopup();
    this.createMerchantPopup();
    this.createStageResultPopup();
    this.createItemShopPopup();
    this.createAppraisalPopup();
    this.createStageGoalPopup();
    this.createEventPopup();
    this.createTutorialUi();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.focusClickedToolWindow(pointer);
    });

    this.setUpOfferKeyboard();
    this.setUpDevShortcut();
    this.setUpAudio();
    this.render();
  }

  private setUpAudio(): void {
    this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer) => {
      // 겹친 인터랙티브 오브젝트가 같은 입력을 받아도 물리 클릭 한 번에는 한 번만 낸다.
      const timestamp = pointer.event?.timeStamp ?? this.time.now;
      if (timestamp === this.lastUiClickPointerTimestamp) return;
      this.lastUiClickPointerTimestamp = timestamp;
      this.sound.play('sfx-ui-click', { volume: AUDIO_CONFIG.uiClickVolume });
    });
  }

  private startBackgroundMusic(): void {
    if (this.backgroundMusic?.isPlaying || this.backgroundMusicStopping) return;

    this.backgroundMusic = this.sound.add('bgm-mysterious-pawnshop', { volume: 0 }) as FadableSound;
    this.backgroundMusicStandby = this.sound.add('bgm-mysterious-pawnshop', { volume: 0 }) as FadableSound;
    if (!this.backgroundMusic.play()) {
      this.backgroundMusic.destroy();
      this.backgroundMusicStandby.destroy();
      this.backgroundMusic = undefined;
      this.backgroundMusicStandby = undefined;
      this.sound.once('unlocked', () => this.startBackgroundMusic());
      return;
    }

    this.tweens.addCounter({
      from: 0,
      to: AUDIO_CONFIG.backgroundMusicVolume,
      duration: AUDIO_CONFIG.backgroundMusicFadeInMilliseconds,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => this.backgroundMusic?.setVolume(tween.getValue() ?? 0),
    });
    this.scheduleBackgroundMusicCrossfade();
  }

  private scheduleBackgroundMusicCrossfade(): void {
    this.backgroundMusicLoopTimer?.remove(false);
    const current = this.backgroundMusic;
    if (!current?.isPlaying || this.backgroundMusicStopping) return;
    const overlapSeconds = AUDIO_CONFIG.backgroundMusicCrossfadeMilliseconds / 1_000;
    const secondsUntilCrossfade = Math.max(0.1, current.duration - current.seek - overlapSeconds);
    this.backgroundMusicLoopTimer = this.time.delayedCall(
      secondsUntilCrossfade * 1_000,
      () => this.crossfadeBackgroundMusic(),
    );
  }

  private crossfadeBackgroundMusic(): void {
    const outgoing = this.backgroundMusic;
    const incoming = this.backgroundMusicStandby;
    if (!outgoing?.isPlaying || !incoming || this.backgroundMusicStopping) return;
    incoming.setVolume(0);
    if (!incoming.play()) return;

    this.backgroundMusicFadeTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: AUDIO_CONFIG.backgroundMusicCrossfadeMilliseconds,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        outgoing.setVolume(AUDIO_CONFIG.backgroundMusicVolume * (1 - progress));
        incoming.setVolume(AUDIO_CONFIG.backgroundMusicVolume * progress);
      },
      onComplete: () => {
        outgoing.stop();
        outgoing.setVolume(0);
        this.backgroundMusic = incoming;
        this.backgroundMusicStandby = outgoing;
        this.backgroundMusicFadeTween = undefined;
        this.scheduleBackgroundMusicCrossfade();
      },
    });
  }

  private fadeOutBackgroundMusic(afterFade: () => void): void {
    this.backgroundMusicStopping = true;
    this.backgroundMusicLoopTimer?.remove(false);
    this.backgroundMusicLoopTimer = undefined;
    this.backgroundMusicFadeTween?.stop();
    this.backgroundMusicFadeTween = undefined;
    const sounds = [this.backgroundMusic, this.backgroundMusicStandby]
      .filter((sound): sound is FadableSound => Boolean(sound?.isPlaying));
    if (sounds.length === 0) {
      this.destroyBackgroundMusic();
      afterFade();
      return;
    }
    const startingVolumes = sounds.map((sound) => sound.volume);
    this.backgroundMusicFadeTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: AUDIO_CONFIG.backgroundMusicStopFadeMilliseconds,
      ease: 'Sine.easeIn',
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        sounds.forEach((sound, index) => sound.setVolume(startingVolumes[index] * (1 - progress)));
      },
      onComplete: () => {
        this.destroyBackgroundMusic();
        afterFade();
      },
    });
  }

  private destroyBackgroundMusic(): void {
    this.backgroundMusic?.stop();
    this.backgroundMusicStandby?.stop();
    this.backgroundMusic?.destroy();
    this.backgroundMusicStandby?.destroy();
    this.backgroundMusic = undefined;
    this.backgroundMusicStandby = undefined;
    this.backgroundMusicFadeTween = undefined;
  }

  private playEventSound(
    key: 'sfx-shutter' | 'sfx-shutter-close',
  ): void {
    this.sound.play(key, { volume: AUDIO_CONFIG.eventVolume });
  }

  private playShopWindowBell(): void {
    this.sound.play('sfx-shop-window-bell', { volume: AUDIO_CONFIG.shopWindowBellVolume });
  }

  private resetSceneUiCollections(): void {
    this.customerSpeechLines = [];
    this.leftMenuButtons = [];
    this.leftMenuLabels = [];
    this.inventoryCells = [];
    this.inventoryCellFrames = [];
    this.inventoryCellVelvets = [];
    this.inventoryCellOrnaments = [];
    this.inventoryCellImages = [];
    this.inventoryCellLabels = [];
    this.inventoryCellQuantities = [];
    this.historySummaryTexts = [];
    this.historyEntryTexts = [];
    this.statementRevealTimers = [];
    this.salesCells = [];
    this.salesCellFrames = [];
    this.salesCellImages = [];
    this.salesCellNames = [];
    this.salesCellMeta = [];
    this.salesChartLabels = [];
    this.merchantOfferCells = [];
    this.merchantOfferFrames = [];
    this.merchantOfferImages = [];
    this.merchantOfferNames = [];
    this.merchantOfferPrices = [];
    this.merchantOfferBadges = [];
    this.specialItemCountTexts = [];
    this.itemShopProductFrames = new Map();
    this.itemShopProductNameTexts = new Map();
    this.itemShopProductOwnedTexts = new Map();
    this.itemShopProductPriceTexts = new Map();
    this.toolWindows = [];
    this.toolWindowOrder = [];
    this.tutorialMasks = [];
  }

  update(_time: number, delta: number): void {
    if (!this.gameStarted || this.shutterAnimating) {
      this.render();
      return;
    }
    if (this.appraisalPopupOpen || this.eventPopupOpen || this.stageGoalOpen) {
      this.render();
      return;
    }
    const wasOpen = this.state.phase === 'Open';
    if (!this.tutorialPausesTime()) this.state.tick(delta / 1000);
    if (wasOpen && this.state.phase === 'Closed') {
      this.customerQueue.stopDay();
      this.handleShopClosed();
    } else if (this.state.phase === 'Closed') {
      this.recoverStalledDayClose();
    } else if (this.state.phase === 'Open') {
      if (this.tutorialStep === 'inactive') {
        this.customerQueue.tick(delta / 1000);
        this.presentNextCustomerIfReady();
      }
    }
    this.clearTradeWhenShopCloses();
    this.advanceCustomerSpeech(delta);
    this.advanceTutorialInputError(delta);
    this.render();
  }

  /**
   * 개발용 영업시간 즉시 종료.
   *
   * 3분 x 3일을 매번 기다리면 검증이 불가능하므로 넣는다.
   * 개발 빌드에서만 등록되며 프로덕션 빌드에는 포함되지 않는다.
   */
  private setUpDevShortcut(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    this.input.keyboard?.on('keydown-S', () => {
      this.devCloseDay();
    });
    this.input.keyboard?.on('keydown-N', () => {
      if (this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit) return;
      if (this.state.phase === 'Open' && this.trade.status === 'Idle') {
        this.customerQueue.skipWait();
        this.presentNextCustomerIfReady();
      }
    });
    this.input.keyboard?.on('keydown-F', () => {
      this.devFillInventory();
    });

    this.add
      .text(16, GAME_HEIGHT - 28, '[DEV] T : 테스트 패널  ·  S : 영업 종료  ·  N : 손님 대기 생략  ·  F : 재고 8/9', {
        fontFamily: UI_DISPLAY_FONT,
        fontSize: '14px',
        color: COLOR_DEV,
      })
      .setOrigin(0, 0.5);

    this.createDevPanel();
    this.input.keyboard?.on('keydown-T', () => this.toggleDevPanel());
  }

  private createDevPanel(): void {
    const background = this.add.rectangle(0, 0, 330, 650, 0x11100d, 0.98)
      .setStrokeStyle(3, 0xb88948).setInteractive();
    const title = this.add.text(0, -292, 'DEV 플레이테스트', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '24px', color: '#f0d39a',
    }).setOrigin(0.5);
    const guide = this.add.text(0, -257, 'T 또는 닫기로 패널 전환', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '14px', color: COLOR_DIM,
    }).setOrigin(0.5);
    this.devPanelMessage = this.add.text(0, 242, '테스트 동작을 선택하세요.', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '15px', color: '#e0c778',
      align: 'center', wordWrap: { width: 290 },
    }).setOrigin(0.5);
    const actions: Array<[string, () => void]> = [
      ['STAGE 2 바로가기', () => this.devJumpToStage2()],
      ['현금 +50,000', () => this.devGrantMoney()],
      ['특수 아이템 +3', () => this.devGrantSpecialItems()],
      ['재고 8 / 9 채우기', () => this.devFillInventory()],
      ['가품 손님 호출', () => this.devSummonFakeCustomer()],
      ['다음 공격 강제', () => this.devArmRisk('attacked')],
      ['다음 결렬 강제', () => this.devArmRisk('brokenOff')],
      ['DAY 즉시 종료', () => this.devCloseDay()],
      ['닫기', () => this.toggleDevPanel()],
    ];
    const children: Phaser.GameObjects.GameObject[] = [background, title, guide, this.devPanelMessage];
    actions.forEach(([label, action], index) => {
      children.push(this.makeTradeButton(0, -205 + index * 49, label, action).setFontSize(17));
    });
    this.devPanel = this.add.container(GAME_WIDTH - 180, GAME_HEIGHT / 2, children)
      .setDepth(300).setVisible(false);
  }

  private toggleDevPanel(): void {
    this.devPanel.setVisible(!this.devPanel.visible);
  }

  private setDevMessage(message: string): void {
    this.devPanelMessage.setText(message);
  }

  private devJumpToStage2(): void {
    if (this.state.stage === 2) {
      this.setDevMessage('이미 STAGE 2 · DAY 1 영업 전입니다.');
      return;
    }
    if (this.state.stage !== 1) {
      this.setDevMessage('현재 데모에서 STAGE 2로 이동할 수 없는 상태입니다.');
      return;
    }
    this.state.setStageForDevelopment(2);
    this.customerQueue.stopDay();
    this.trade = new TradeSession();
    this.customerQueue = new CustomerQueue(customerQueueConfigForStage(2));
    this.bagMerchant = new BagMerchant(BAG_MERCHANT_CONFIG);
    this.ledger.reset();
    this.devCashAdjustment = 0;
    this.openingMoney = this.state.money;
    this.closingMoney = this.state.money;
    this.market = new Market();
    this.market.updateForDay(1);
    this.itemShopVisit = null;
    this.statementReady = false;
    this.closedDaysRealizedProfit = 0;
    this.salesOpen = true;
    this.salesMessage = '판매할 물건을 선택하세요.';
    this.selectedSaleId = null;
    this.selectedMerchantOfferIndex = null;
    this.marketPreviews.clear();
    this.appraisalPopupOpen = false;
    this.eventPopupOpen = false;
    this.specialItemPopupOpen = false;
    this.inventoryOpen = false;
    this.defenseActive = false;
    this.appraisalPopup.setVisible(false);
    this.eventPopup.setVisible(false);
    this.specialItemPopup.setVisible(false);
    this.inventoryPopup.setVisible(false);
    this.shutterAnimating = false;
    this.shutterBacking.setVisible(false);
    this.shutter.setVisible(false);
    this.gameStarted = true;
    this.openStageGoal();
    this.setDevMessage('STAGE 2 · DAY 1 영업 전으로 이동했습니다.');
  }

  private devGrantMoney(): void {
    const grantedMoney = 50_000;
    this.state.earnMoney(grantedMoney);
    // DEV 지급금은 실제 영업 손익이 아니므로 별도 조정액으로 추적해 장부 검증에서 제외한다.
    this.devCashAdjustment += grantedMoney;
    this.closingMoney = this.state.money;
    this.setDevMessage('현금 50,000원을 지급했습니다.');
    this.render();
  }

  private devGrantSpecialItems(): void {
    this.specialItems.addAppraisalTicket(3);
    this.specialItems.addMarketPreviewTicket(3);
    for (let count = 0; count < 3; count += 1) {
      this.specialItems.addDefenseItem();
      this.specialItems.addTimeExtensionItem();
    }
    this.setDevMessage('모든 특수 아이템을 3개씩 지급했습니다.');
    this.render();
  }

  private devFillInventory(): void {
    if (this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit) {
      this.setDevMessage('열린 이벤트를 먼저 닫아 주세요.');
      return;
    }
    const fillPool = playableItemsForStage(this.state.stage);
    while (this.inventory.size < this.inventory.capacity - 1) {
      const item = fillPool[this.inventory.size % fillPool.length]!;
      const authenticity = this.state.stage >= AUTHENTICITY_CONFIG.startsAtStage
        && this.inventory.size % 2 === 0 ? 'fake' : 'genuine';
      this.inventory.add(item, item.basePrice, authenticity);
    }
    this.setDevMessage(`재고를 ${this.inventory.size} / ${this.inventory.capacity}로 채웠습니다.`);
    this.render();
  }

  private devSummonFakeCustomer(): void {
    if (this.state.stage < AUTHENTICITY_CONFIG.startsAtStage
      || this.state.phase !== 'Open' || this.tutorialStep !== 'inactive'
      || this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit) {
      this.setDevMessage('일반 영업 중이며 열린 이벤트가 없을 때 호출할 수 있습니다.');
      return;
    }
    const replacesCurrentCustomer = this.customerQueue.hasActiveCustomer;
    if (!replacesCurrentCustomer) {
      this.customerQueue.skipWait();
      if (!this.customerQueue.takeNextCustomer()) {
        this.setDevMessage('오늘 호출할 수 있는 남은 손님이 없습니다.');
        return;
      }
    }
    this.customerExitAnimating = false;
    this.tweens.killTweensOf(this.customerVisualTargets());
    this.customerVisualTargets().forEach((target) => target.setAlpha(1));
    this.resetCustomerSpeech();
    this.trade = new TradeSession();
    // DEV 검증용 호출도 특정 토끼/라디오에 고정하지 않고, 실제 영업 풀에서
    // 손님과 물건을 무작위로 골라 다양한 가품 대사를 확인할 수 있게 한다.
    const customerNames = Object.keys(CUSTOMER_ART_BY_NAME);
    const name = customerNames[Math.floor(Math.random() * customerNames.length)] ?? 'DEV 가품 손님';
    const fakePool = playableItemsForStage(this.state.stage);
    const item = fakePool[Math.floor(Math.random() * fakePool.length)]!;
    this.trade.present({
      id: `dev-fake-${Date.now()}`,
      name,
      item,
      initialAskingPrice: item.basePrice * 2,
      minAcceptablePrice: item.basePrice,
      authenticity: 'fake',
      type: 'fraudster',
      trust: 50,
      ...customerObservationClues(item, 'fraudster', 'fake', 0.72),
    });
    this.typedOffer = String(this.trade.customer!.initialAskingPrice);
    this.replaceOfferOnNextDigit = true;
    this.setDevMessage(replacesCurrentCustomer
      ? `${name} · ${item.name} 가품 손님으로 교체했습니다.`
      : `${name} · ${item.name} 가품 손님을 호출했습니다.`);
    this.render();
  }

  private devArmRisk(risk: 'attacked' | 'brokenOff'): void {
    if (this.state.phase !== 'Open'
      || (this.trade.status !== 'Presenting' && this.trade.status !== 'Negotiating')) {
      this.setDevMessage('영업 중 진행 중인 거래가 있을 때 강제 결과를 예약할 수 있습니다.');
      return;
    }
    this.forcedNextRisk = risk;
    this.setDevMessage(risk === 'attacked'
      ? '다음 불만 제안에서 공격을 강제합니다.'
      : '다음 불만 제안에서 결렬을 강제합니다.');
  }

  private devCloseDay(): void {
    if (this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit || this.state.phase !== 'Open') {
      this.setDevMessage('영업 중이며 열린 이벤트가 없을 때 종료할 수 있습니다.');
      return;
    }
    this.state.closeShop();
    this.customerQueue.stopDay();
    this.handleShopClosed();
    this.clearTradeWhenShopCloses();
    this.forcedNextRisk = null;
    this.setDevMessage('현재 DAY 영업을 종료했습니다.');
    this.render();
  }

  private render(): void {
    const { day, money, phase } = this.state;

    const dayLabel = `DAY ${day}`;
    const daySubtitle = `장사 ${day}일차`;
    const moneyLabel = `₩ ${money.toLocaleString('ko-KR')}`;
    this.dayText.setText(dayLabel);
    this.dayTextWear.setText(dayLabel);
    this.daySubtitleText.setText(daySubtitle);
    this.daySubtitleWear.setText(daySubtitle);
    this.moneyText.setText(moneyLabel);
    this.moneyTextWear.setText(moneyLabel);
    this.fitHudText(this.dayText, this.dayTextWear, 92, 25, 20);
    this.fitHudText(this.daySubtitleText, this.daySubtitleWear, 92, 18, 14);
    this.fitHudText(this.moneyText, this.moneyTextWear, 168, 29, 23);

    const activeCustomer = this.trade.customer;
    const trust = activeCustomer
      ? this.customerProfiles.profile(activeCustomer.name).trust
      : this.tutorialStep === 'trustIntro' ? this.tutorialTrustSnapshot : null;
    const trustVisible = phase === 'Open';
    const trustValue = trust ?? 0;
    this.fitHudText(this.trustLabelText, this.trustLabelWear, 54, 17, 14);
    this.trustLabelText.setVisible(trustVisible);
    this.trustLabelWear.setVisible(trustVisible);
    this.trustBarBackground.setVisible(trustVisible);
    this.trustBarFill.setVisible(trustVisible).setScale(trustValue / 100, 1);
    const trustPercentLabel = `${trustValue}%`;
    this.trustPercentText.setText(trustPercentLabel).setVisible(trustVisible);
    this.trustPercentWear.setText(trustPercentLabel).setVisible(trustVisible);
    this.fitHudText(this.trustPercentText, this.trustPercentWear, 54, 23, 18);
    const timerLabel = phase === 'Open' ? formatTime(this.state.remainingSeconds) : '';
    this.timerText.setText(timerLabel);
    this.timerTextWear.setText(timerLabel);
    this.fitHudText(this.timerText, this.timerTextWear, 130, 31, 25);
    this.renderCustomerQueue();
    this.renderTrade();
    this.renderInventory();
    this.renderSpecialItemPopup();
    this.renderLeftMenu();
    this.renderStatement();
    this.renderSales();
    this.renderMerchant();
    this.renderStageResult();
    this.renderItemShop();
    this.renderTransactionHistory();
    this.renderTutorial();

    this.closeDayButton.setVisible(phase === 'Open'
      && !this.appraisalPopupOpen && !this.eventPopupOpen);
  }

  private makeTradeButton(x: number, y: number, label: string, action: () => void): Phaser.GameObjects.Text {
    return this.add.text(x, y, label, {
      fontFamily: UI_DISPLAY_FONT, fontSize: '20px', color: COLOR_BUTTON,
      backgroundColor: '#2b2116', padding: { x: 16, y: 9 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', action);
  }

  private makeCloseDayButton(x: number, y: number): Phaser.GameObjects.Container {
    return this.makeMainActionButton(x, y, '장사\n종료', () => this.closeCurrentDay());
  }

  private makeOfferArrowButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
  ): Phaser.GameObjects.Text {
    return this.add.text(x, y, label, {
      fontFamily: UI_DISPLAY_FONT,
      fontSize: '16px',
      color: COLOR_BUTTON,
      backgroundColor: '#2b2116',
      fixedWidth: 33,
      align: 'center',
      padding: { y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', action);
  }

  private makeMainActionButton(
    x: number,
    y: number,
    labelText: string,
    action: () => void,
    hoverTint = 0xffd993,
  ): Phaser.GameObjects.Container {
    const background = this.add.image(0, 0, 'hud-v2-close-day');
    const label = this.add.text(0, 0, labelText, {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '18px', fontStyle: 'bold',
      color: '#f4dfb3', align: 'center', lineSpacing: 2,
    }).setOrigin(0.5).setShadow(0, 2, '#521b12', 3, true, true);
    const button = this.add.container(x, y, [background, label])
      .setSize(120, 108)
      .setInteractive({ useHandCursor: true });
    button.on('pointerover', () => background.setTint(hoverTint));
    button.on('pointerout', () => background.clearTint());
    button.on('pointerdown', action);
    return button;
  }

  private createLeftMenu(): void {
    this.makeMockupMenuButton(66, 145, 'hud-v3-menu-ledger', '시세 장부', () => this.toggleTransactionHistory());
    this.appraisalButton = this.makeMockupMenuButton(
      66, 260, 'hud-v3-menu-appraise', '아이템', () => this.toggleSpecialItemPopup(),
    );
    this.inventoryButton = this.makeMockupMenuButton(
      66, 375, 'hud-v3-menu-inventory', '매입품', () => this.toggleInventory(),
    );
  }

  private makeMockupMenuButton(
    x: number,
    y: number,
    frameTexture: string,
    label: string,
    action: () => void,
  ): Phaser.GameObjects.Image {
    const background = this.add.image(x, y, frameTexture)
      .setDepth(-9)
      .setInteractive({ useHandCursor: true });
    const labelText = this.add.text(x, y + 55, label, {
      fontFamily: HUD_DISPLAY_FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: COLOR_HUD_GOLD,
    }).setOrigin(0.5).setShadow(0, 1, '#000000', 2, true, true).setDepth(-7);
    background.on('pointerover', () => background.setTint(0xffe2a8));
    background.on('pointerout', () => background.clearTint());
    background.on('pointerdown', action);
    this.leftMenuButtons.push(background);
    this.leftMenuLabels.push(labelText);
    return background;
  }

  private renderLeftMenu(): void {
    const blocked = this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit !== null;
    this.leftMenuButtons.forEach((button) => {
      button.setVisible(true).setAlpha(blocked ? 0.72 : 1);
      if (blocked) button.disableInteractive();
      else button.setInteractive({ useHandCursor: true });
    });
    this.leftMenuLabels.forEach((label) => label.setVisible(true).setAlpha(blocked ? 0.72 : 1));
  }

  private createWornTextOverlay(
    text: Phaser.GameObjects.Text,
    left: number,
    top: number,
    width: number,
    height: number,
    seed: number,
  ): Phaser.GameObjects.Text {
    const scratches = this.add.graphics().setVisible(false);
    let state = seed >>> 0;
    const random = (): number => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const scratchCount = Math.max(10, Math.round((width * height) / 145));
    scratches.lineStyle(1, 0xffffff, 1);
    for (let index = 0; index < scratchCount; index += 1) {
      const x = left + random() * width;
      const y = top + random() * height;
      const length = 1 + random() * 4;
      scratches.lineBetween(x, y, x + length, y + (random() - 0.5) * 1.5);
    }
    const wear = this.add.text(text.x, text.y, text.text, {
      fontFamily: text.style.fontFamily,
      fontSize: text.style.fontSize,
      fontStyle: text.style.fontStyle,
      color: '#21170f',
      align: text.style.align,
    })
      .setOrigin(text.originX, text.originY)
      .setDepth(text.depth + 1)
      .setAlpha(0.52)
      .setMask(scratches.createGeometryMask());
    return wear;
  }

  /** 제안가와 같은 기본 타이포그래피를 쓰되 HUD 카드의 안전 영역 안으로만 축소한다. */
  private fitHudText(
    text: Phaser.GameObjects.Text,
    wear: Phaser.GameObjects.Text | null,
    maxWidth: number,
    maxHeight: number,
    baseFontSize = 29,
  ): void {
    let fontSize = baseFontSize;
    text.setFontFamily(UI_DISPLAY_FONT).setFontStyle('bold').setColor(COLOR_HUD_GOLD).setFontSize(fontSize);
    while ((text.width > maxWidth || text.height > maxHeight) && fontSize > 10) {
      fontSize -= 1;
      text.setFontSize(fontSize);
    }
    wear?.setFontFamily(UI_DISPLAY_FONT).setFontStyle('bold').setFontSize(fontSize);
  }

  private createTransactionHistoryPopup(): void {
    const panel = this.add.image(0, 0, 'transaction-history-popup')
      .setDisplaySize(930, 620).setInteractive();
    const title = this.add.text(0, -250, '거래 기록', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '32px', color: '#d9bd8b', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.customerClueText = this.add.text(1020, 598, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '15px', color: '#d9c391', align: 'left',
      fixedWidth: 480, wordWrap: { width: 456 }, lineSpacing: 4,
      backgroundColor: '#0b0908', padding: { x: 12, y: 8 },
    }).setOrigin(0.5, 0).setDepth(-2).setVisible(false);
    this.tutorialItemClueFocus = this.add.zone(1020, 627, 480, 58).setOrigin(0.5);
    this.historySummaryTexts = [-331, -167, -3, 161, 325].map((x) => this.add.text(x, -179, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '15px', color: '#d8c39b', align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5));
    this.historyEntryTexts = [-92, -19, 54, 127, 207].map((y) => this.add.text(-395, y, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '14px', color: '#d3c2a2', lineSpacing: 2,
      fixedWidth: 790, wordWrap: { width: 790 },
    }).setOrigin(0, 0.5));
    // 카테고리별 위조 위험. 확률 숫자 대신 정성 등급만 보여 준다(authenticityConfig 참고).
    //
    // 목록 컨테이너 안에 두면 기록 한 줄처럼 읽혀서 컨테이너 밖 아래에 놓는다.
    // 패널 이미지 실측: 목록 컨테이너 테두리 y 244~254, 그 아래 y 268~282가 전폭으로 비어 있고,
    // y 284~292에는 가운데 장식(x -69~68)이 있다. y=274면 267~281을 써서 위아래 3px씩 비운다.
    //
    // 라벨과 등급이 같은 굵기·색이면 라벨이 첫 카테고리처럼 읽힌다. 라벨은 어둡게 낮추고
    // 등급만 밝게 굵게 해 위계를 주고, 사이에 얇은 세로선을 넣어 경계를 명시한다.
    // 세 조각의 폭이 글자에 따라 달라지므로 위치는 렌더에서 실제 폭을 재서 잡는다.
    this.historyFakeRiskLabel = this.add.text(0, HISTORY_FAKE_RISK.y, '위조 위험', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '14px', color: COLOR_DIM,
    }).setOrigin(0, 0.5).setShadow(0, 1, '#000000', 3, true, true);
    this.historyFakeRiskDivider = this.add.rectangle(
      0, HISTORY_FAKE_RISK.y, HISTORY_FAKE_RISK.dividerWidth, HISTORY_FAKE_RISK.dividerHeight,
      0x8a7350,
    ).setOrigin(0.5, 0.5);
    this.historyFakeRiskText = this.add.text(0, HISTORY_FAKE_RISK.y, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '14px', fontStyle: 'bold', color: '#e2cb99',
    }).setOrigin(0, 0.5).setShadow(0, 1, '#000000', 3, true, true);
    const close = this.add.text(385, -256, '×', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '38px', color: '#d9bd8b',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleTransactionHistory());
    this.historyPopup = this.add.container(640, 360, [
      panel, title, ...this.historySummaryTexts, ...this.historyEntryTexts,
      this.historyFakeRiskLabel, this.historyFakeRiskDivider, this.historyFakeRiskText, close,
    ])
      .setDepth(TOOL_WINDOW_BASE_DEPTH).setVisible(false);
  }

  private toggleTransactionHistory(): void {
    if (this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit) return;
    this.historyOpen = !this.historyOpen;
    if (this.historyOpen) this.focusToolWindow(this.historyPopup);
    this.render();
  }

  /**
   * 시세 장부 한 줄에 넣을 시세 정보.
   *
   * 매입품 창(`inventoryMarketInfoLine`)과 같은 규칙을 쓴다. 하룻밤을 넘긴 보유품은
   * 감정하지 않았어도 시세와 가품 여부가 이미 매입품 창·판매 화면에 드러나 있으므로,
   * 장부만 `확인 시세 없음`으로 비워 두면 두 창의 정보가 어긋난다.
   * 매입 당일은 그대로 비워 둬서 감정 도구와 시세 수첩의 값을 남긴다.
   */
  /** 라벨 · 세로선 · 등급 세 조각을 하나의 묶음으로 패널 가운데에 놓는다. */
  private layoutHistoryFakeRisk(): void {
    const { gap, dividerWidth } = HISTORY_FAKE_RISK;
    const total = this.historyFakeRiskLabel.width + gap + dividerWidth + gap
      + this.historyFakeRiskText.width;
    const left = -total / 2;
    this.historyFakeRiskLabel.setX(left);
    this.historyFakeRiskDivider.setX(left + this.historyFakeRiskLabel.width + gap + dividerWidth / 2);
    this.historyFakeRiskText.setX(left + this.historyFakeRiskLabel.width + gap + dividerWidth + gap);
  }

  private historyMarketLine(entry: TransactionHistoryEntry): string {
    if (entry.marketCheck) {
      const { stage, day, nextDaySalePrice } = entry.marketCheck;
      return `확인 시세 STAGE ${stage} DAY ${day} · 내일 예상 ${nextDaySalePrice.toLocaleString('ko-KR')}원`;
    }
    if (entry.salePrice !== undefined) return '확인 시세 없음';
    const owned = this.inventory.items.find((item) => item.instanceId === entry.instanceId);
    // hasPassedMorningSince 를 먼저 확인해야 한다. DAY 1 매입 당일에는 아직 시세를
    // 갱신하지 않은 카테고리가 있어 salePrice 가 던진다.
    if (!owned || !this.hasPassedMorningSince(owned)) return '확인 시세 없음';
    const price = this.market.salePrice(owned.item, owned.authenticity).toLocaleString('ko-KR');
    const note = owned.authenticity === 'fake'
      ? '가품 고정가' : trendLabel(this.market.trend(owned.item.category));
    return `현재 시세 ${price}원 · ${note}`;
  }

  private renderTransactionHistory(): void {
    this.historyPopup.setVisible(this.historyOpen);
    if (!this.historyOpen) return;
    const sold = this.transactionHistory.soldEntries;
    this.historySummaryTexts[0].setText(`매입\n${this.transactionHistory.entries.length}건`);
    this.historySummaryTexts[1].setText(`판매\n${sold.length}건`);
    this.historySummaryTexts[2].setText(`이익\n${this.transactionHistory.profitCount}건`);
    this.historySummaryTexts[3].setText(`손실\n${this.transactionHistory.lossCount}건`);
    this.historySummaryTexts[4].setText(`평균 손익\n${sold.length === 0 ? '-' : formatSignedMoney(this.transactionHistory.averageProfit)}`);
    // 위에서 아래로 오래된 순이다. 새 거래는 맨 아래 줄에 들어가고, 다섯 줄이 꽉 차면
    // 맨 위 한 줄이 밀려 나가고 나머지가 한 칸씩 올라간다(slice(-5)가 그 역할을 한다).
    const entries = this.transactionHistory.entries.slice(-5).map((entry) => {
      // 예상 판매가 범위는 기준가에서 그대로 계산되므로 보여 주면 물건의 값을 알려 주는 것과 같다.
      // 한 번 매입한 물건의 값을 영구히 알게 되면 이후에는 그 값만 부르게 되어 흥정이 사라진다.
      const marketLine = this.historyMarketLine(entry);
      return entry.salePrice === undefined
        ? `[보유] ${entry.itemName} · 매입 ${entry.purchasePrice.toLocaleString('ko-KR')}원\n${marketLine}`
        : `[판매] ${entry.itemName} · ${entry.saleChannel} · 보유 ${entry.holdingDays}일\n매입 ${entry.purchasePrice.toLocaleString('ko-KR')}원 · 실제 ${entry.salePrice.toLocaleString('ko-KR')}원 (${formatSignedMoney(entry.profit ?? 0)}) · ${marketLine}`;
    });
    this.historyEntryTexts.forEach((text, index) => {
      text.setText(entries[index] ?? (index === 0 && entries.length === 0 ? '아직 기록된 거래가 없습니다.' : ''));
    });
    this.historyFakeRiskText.setText(fakeRiskByCategory()
      .map(({ category, label }) => `${category} ${label}`)
      .join('  ·  '));
    this.layoutHistoryFakeRisk();
  }

  private makeMockupActionButton(
    x: number,
    y: number,
    frameTexture: string,
    label: string,
    action: () => void,
  ): Phaser.GameObjects.Container {
    const background = this.add.image(0, 0, frameTexture);
    const text = this.add.text(0, 0, label, {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '18px', fontStyle: 'bold',
      color: '#f4dfb3', align: 'center', lineSpacing: 2,
    }).setOrigin(0.5).setShadow(0, 2, '#521b12', 3, true, true);
    const button = this.add.container(x, y, [background, text])
      .setSize(116, 112)
      .setInteractive({ useHandCursor: true });
    button.on('pointerover', () => background.setTint(0xffe2a8));
    button.on('pointerout', () => background.clearTint());
    button.on('pointerdown', action);
    return button;
  }

  private setUpOfferKeyboard(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const enterPressed = event.key === 'Enter' || event.code === 'NumpadEnter' || event.keyCode === 13;
      const tutorialInput = this.tutorialStep === 'firstLowInput'
        || this.tutorialStep === 'firstRaiseInput' || this.tutorialStep === 'secondLowInput';
      const tutorialOffer = this.tutorialStep === 'firstLowOffer'
        || this.tutorialStep === 'firstRaiseOffer' || this.tutorialStep === 'secondLowOffer'
        || this.tutorialStep === 'secondRiskOffer';
      if (this.tutorialStep !== 'inactive' && !tutorialInput
        && !(enterPressed && tutorialOffer)) return;
      if (this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit) return;
      if (this.trade.status !== 'Presenting' && this.trade.status !== 'Negotiating') return;
      if (enterPressed && tutorialInput) {
        event.preventDefault();
        const inputStep = this.tutorialStep;
        this.syncTutorialPriceInput();
        if (this.tutorialStep !== inputStep) this.submitOffer();
        this.render();
        return;
      }
      if (/^[0-9]$/.test(event.key) && this.typedOffer.length < 9) {
        if (this.tutorialStep === 'firstRaiseInput' || this.tutorialStep === 'secondLowInput') {
          this.setTutorialInputError(null);
        }
        const nextOffer = this.replaceOfferOnNextDigit ? event.key : this.typedOffer + event.key;
        this.typedOffer = nextOffer;
        this.replaceOfferOnNextDigit = false;
      } else if (event.key === 'Backspace') {
        if (this.tutorialStep === 'firstRaiseInput' || this.tutorialStep === 'secondLowInput') {
          this.setTutorialInputError(null);
        }
        this.typedOffer = this.replaceOfferOnNextDigit ? '' : this.typedOffer.slice(0, -1);
        this.replaceOfferOnNextDigit = false;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.adjustOffer(OFFER_ADJUSTMENT_STEP);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.adjustOffer(-OFFER_ADJUSTMENT_STEP);
      }
      else if (enterPressed) {
        event.preventDefault();
        this.submitOffer();
      }
      this.render();
    });
  }

  private adjustOffer(delta: number): void {
    if (this.trade.status !== 'Presenting' && this.trade.status !== 'Negotiating') return;
    const tutorialInput = this.tutorialStep === 'firstLowInput'
      || this.tutorialStep === 'firstRaiseInput' || this.tutorialStep === 'secondLowInput';
    if (this.tutorialStep !== 'inactive' && !tutorialInput) return;
    if (this.tutorialStep === 'firstRaiseInput' || this.tutorialStep === 'secondLowInput') {
      this.setTutorialInputError(null);
    }
    const current = Number(this.typedOffer) || this.trade.customer?.initialAskingPrice || 0;
    this.typedOffer = String(adjustOfferAmount(current, delta));
    this.replaceOfferOnNextDigit = true;
    this.render();
  }

  /**
   * 입력한 제안가. 1원 단위 그대로 쓴다. 1,990원을 입력하면 1,990원이 그대로 나간다.
   * 표시·제안·현금 차감·장부가 모두 이 값을 본다.
   */
  private get typedOfferAmount(): number {
    const typed = Number(this.typedOffer);
    // 매 프레임 그리는 경로라 예외를 던지지 않는다.
    if (!this.typedOffer || !Number.isSafeInteger(typed)) return 0;
    return typed;
  }

  private startOfferHold(delta: number): void {
    const tutorialInput = this.tutorialStep === 'firstLowInput'
      || this.tutorialStep === 'firstRaiseInput' || this.tutorialStep === 'secondLowInput';
    if (this.tutorialStep !== 'inactive' && !tutorialInput) return;
    this.stopOfferHold();
    this.offerHoldDelayTimer = this.time.delayedCall(
      TRADE_BALANCE.offerHoldInitialDelayMilliseconds,
      () => {
        this.adjustOffer(delta);
        this.offerHoldRepeatTimer = this.time.addEvent({
          delay: TRADE_BALANCE.offerHoldRepeatMilliseconds,
          loop: true,
          callback: () => this.adjustOffer(delta),
        });
      },
    );
  }

  private stopOfferHold(): void {
    this.offerHoldDelayTimer?.remove(false);
    this.offerHoldRepeatTimer?.remove(false);
    this.offerHoldDelayTimer = undefined;
    this.offerHoldRepeatTimer = undefined;
  }

  private beginDirectOfferInput(): void {
    if (this.trade.status !== 'Presenting' && this.trade.status !== 'Negotiating') return;
    if (this.tutorialStep !== 'inactive' && this.tutorialStep !== 'firstLowInput'
      && this.tutorialStep !== 'firstRaiseInput' && this.tutorialStep !== 'secondLowInput') return;
    this.replaceOfferOnNextDigit = true;
    this.renderTrade();
  }

  private startCustomerDay(deferFirstCustomer = false): void {
    this.deactivateTutorialOutsideConfiguredDay();
    this.todaysCustomerNames = [];
    this.todaysItemIds = [];
    this.customerQueue.startDay();
    this.firstCustomerArrivalPending = deferFirstCustomer;
    if (!deferFirstCustomer) this.presentNextCustomerIfReady();
  }

  private presentNextCustomerIfReady(holdTutorialOverlay = false): void {
    if (this.firstCustomerArrivalPending) return;
    if (!holdTutorialOverlay
      && (this.tutorialStep === 'waitSecond' || this.tutorialStep === 'secondArrival')) return;
    if (this.state.phase !== 'Open' || this.trade.status !== 'Idle') return;
    if (!this.customerQueue.takeNextCustomer()) return;
    const tutorialIndex = this.isTutorialDay() && !this.tutorialSkipped
      ? this.customerQueue.appearedCount : 0;
    const customer = tutorialIndex >= 1 && tutorialIndex <= TUTORIAL_CONFIG.scriptedCustomerCount
      ? this.createTutorialCustomer(tutorialIndex)
      : createCustomer(
        this.state.stage,
        Math.random,
        this.customerProfiles,
        this.todaysCustomerNames,
        this.todaysItemIds,
      );
    this.todaysCustomerNames.push(customer.name);
    this.todaysItemIds.push(customer.item.id);
    this.trade.present(customer);
    this.sound.play('sfx-customer-bell', { volume: AUDIO_CONFIG.customerBellVolume });
    this.typedOffer = String(customer.initialAskingPrice);
    this.replaceOfferOnNextDigit = true;
    if (tutorialIndex === 1) this.tutorialStep = 'firstArrival';
    if (tutorialIndex === 2) this.tutorialStep = holdTutorialOverlay ? 'secondArrival' : 'secondIntro';
    this.customerVisualTargets().forEach((target) => target.setAlpha(0));
    this.render();
    this.playCustomerEntranceDissolve(() => {
      if (this.tutorialStep !== 'firstArrival') return;
      this.tutorialStep = 'intro';
      this.render();
    });
  }

  private isTutorialDay(): boolean {
    return this.state.stage === TUTORIAL_CONFIG.enabledStage
      && this.state.day === TUTORIAL_CONFIG.enabledDay;
  }

  private deactivateTutorialOutsideConfiguredDay(): void {
    if (this.isTutorialDay()) return;
    this.tutorialStep = 'inactive';
    this.tutorialSkipped = true;
    this.tutorialOverlayVisible = false;
    this.tweens.killTweensOf([
      ...this.tutorialMasks, this.tutorialBorder, this.tutorialConnector, this.tutorialPanel,
    ]);
    this.tutorialMasks.forEach((mask) => mask.setVisible(false));
    this.tutorialBorder.setVisible(false);
    this.tutorialConnector.setVisible(false);
    this.tutorialPanel.setVisible(false);
    this.customerSpeechBubble.setDepth(-3);
  }

  private createTutorialCustomer(index: number): Customer {
    const spec = index === 1 ? TUTORIAL_CONFIG.safeCustomer : TUTORIAL_CONFIG.riskyCustomer;
    const item = STAGE_ONE_ITEMS.find((candidate) => candidate.id === spec.itemId)!;
    const type: CustomerType = index === 1 ? 'honest' : 'fraudster';
    return {
      id: `tutorial-${index}-${item.id}`,
      name: spec.name,
      item,
      initialAskingPrice: spec.askingPrice,
      minAcceptablePrice: spec.minimumPrice,
      authenticity: 'genuine',
      type,
      trust: CUSTOMER_CONFIG.startingTrust,
      // 플레이어가 처음 읽는 단서다. 이후 실제 단서와 같은 판단 축
      // (부위끼리 흔적이 이어지는가)을 쓰는 문장으로 본보기를 보여 준다.
      itemConditionClue: index === 1
        ? '손잡이와 주파수 조절부의 사용감이 외함이 낡은 정도와 이어진다.'
        : '각인은 또렷한데 주변 금속의 마모와 깊이가 서로 맞지 않는다.',
      sellerBehaviorClue: CUSTOMER_CONFIG.customerBehaviorClues[type][0]!,
    };
  }

  private closeCurrentDay(): void {
    if (this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit
      || this.state.phase !== 'Open') return;
    this.state.closeShop();
    this.defenseActive = false;
    this.customerQueue.stopDay();
    this.handleShopClosed();
    this.clearTradeWhenShopCloses();
    this.forcedNextRisk = null;
    this.render();
  }

  private submitOffer(): void {
    if (this.appraisalPopupOpen || this.eventPopupOpen) return;
    if (this.tutorialStep !== 'inactive'
      && this.tutorialStep !== 'firstLowOffer' && this.tutorialStep !== 'firstRaiseOffer'
      && this.tutorialStep !== 'secondLowOffer' && this.tutorialStep !== 'secondRiskOffer') return;
    if (!this.typedOffer) {
      this.showEvent('제안 불가', '제안할 금액을 숫자로 입력해 주세요.');
      return;
    }
    const offer = this.typedOfferAmount;
    if (offer > this.state.money) {
      this.showEvent(
        '제안 불가',
        `보유 현금보다 제안 가격이 높습니다.\n현재 보유 현금 ${this.state.money.toLocaleString('ko-KR')}원`,
      );
      return;
    }
    try {
      const customer = this.trade.customer!;
      const reaction = this.trade.offer(offer, this.state.money);
      if (reaction === 'accepted') {
        const authenticityKnown = this.trade.appraisalResult !== null;
        const purchase = purchaseItem(
          this.state, this.inventory, customer.item, offer, this.ledger, customer.authenticity,
          {
            stage: this.state.stage, day: this.state.day, authenticityKnown,
            itemConditionClue: customer.itemConditionClue,
            sellerBehaviorClue: customer.sellerBehaviorClue,
          },
        );
        if (!purchase.success) {
          this.trade.markPurchaseFailed();
          this.showEvent('거래 불가', '재고 공간이 부족합니다. 매입품을 정리한 뒤 다시 거래해 주세요.');
        } else {
          this.transactionHistory.recordPurchase(purchase.ownedItem);
          this.customerProfiles.changeTrust(customer.name, CUSTOMER_CONFIG.trustChanges.purchased);
          this.tutorialPurchaseResult = {
            itemName: customer.item.name, offer,
          };
          if (this.tutorialStep === 'firstLowOffer' || this.tutorialStep === 'firstRaiseOffer') {
            this.tutorialStep = 'firstResult';
          }
        }
      } else {
        const profile = this.customerProfiles.profile(customer.name);
        const tutorialAttack = this.tutorialStep === 'secondRiskOffer'
          && this.customerQueue.appearedCount === 2;
        const tutorialContinue = this.tutorialStep === 'firstLowOffer'
          || this.tutorialStep === 'secondLowOffer';
        const risk = tutorialAttack ? 'attacked' : tutorialContinue ? 'continue'
          : this.forcedNextRisk ?? negotiationRisk(
          this.state.stage, reaction, this.trade.round, profile.trust, customer.type ?? 'normal',
        );
        this.forcedNextRisk = null;
        if (risk === 'attacked') {
          if (tutorialAttack) this.tutorialStep = 'attackResult';
          this.resolveAttack();
        }
        else {
          if (risk === 'brokenOff' && this.trade.status !== 'Resolved') {
            this.trade.endFromRisk('brokenOff');
          }
          if (this.trade.outcome === 'brokenOff') {
            this.customerProfiles.changeTrust(
              customer.name, CUSTOMER_CONFIG.trustChanges.excessiveNegotiation,
            );
          }
        }
        if (this.tutorialStep === 'firstLowOffer') {
          this.tutorialStep = 'firstRaiseInput';
          this.replaceOfferOnNextDigit = true;
        } else if (this.tutorialStep === 'secondLowOffer') {
          this.replaceOfferOnNextDigit = true;
          this.tutorialStep = 'secondRiskOffer';
        }
      }
      this.replaceOfferOnNextDigit = true;
      this.render();
      if (this.trade.status === 'Resolved' && !this.eventPopupOpen
        && this.tutorialStep !== 'firstResult') this.scheduleCustomerExit();
    } catch (error) {
      this.showEvent(
        '제안 불가',
        error instanceof InvalidTradeActionError ? error.message : '입력한 가격을 확인해 주세요.',
      );
    }
  }

  private rejectTrade(): void {
    if (this.appraisalPopupOpen || this.eventPopupOpen) return;
    if (this.tutorialStep !== 'inactive') return;
    this.trade.reject();
    this.render();
    this.scheduleCustomerExit();
  }

  private resolveAttack(): void {
    if (this.defenseActive) {
      this.defenseActive = false;
      this.trade.endFromRisk('defended');
      this.render();
      this.showEventAfterAttackLine('방어 성공', '방어 아이템이 손님의 공격을 막았습니다.\n병원비 없이 거래를 종료합니다.');
      return;
    }
    const hospitalCost = Math.min(this.state.money, CUSTOMER_CONFIG.hospitalCost);
    const customerName = this.trade.customer?.name;
    this.state.spendMoney(hospitalCost);
    if (this.tutorialStep !== 'attackResult') this.ledger.recordHospital(hospitalCost);
    this.closingMoney = this.state.money;
    if (customerName) {
      this.customerProfiles.changeTrust(
        customerName, CUSTOMER_CONFIG.trustChanges.excessiveNegotiation,
      );
    }
    this.trade.endFromRisk('attacked');
    this.render();
    const resultBody = `공격을 받아 거래가 종료됐습니다.\n병원비 -${hospitalCost.toLocaleString('ko-KR')}원`;
    if (this.tutorialStep === 'attackResult') {
      this.showEvent('손님 공격', resultBody);
    } else {
      // 일반 영업에서는 손님의 공격 대사를 먼저 읽히고 결과 팝업을 띄운다.
      this.showEventAfterAttackLine('손님 공격', resultBody);
    }
  }

  /** 공격 대사를 읽을 시간을 준 뒤 결과 팝업을 띄운다. */
  private showEventAfterAttackLine(title: string, body: string): void {
    this.time.delayedCall(TRADE_BALANCE.attackLineDisplayMilliseconds, () => {
      if (this.trade.outcome !== 'attacked' && this.trade.outcome !== 'defended') return;
      this.showEvent(title, body);
    });
  }

  private scheduleCustomerExit(delayOverrideMilliseconds?: number): void {
    const outcome = this.trade.outcome;
    // 공격·방어는 대사를 읽는 시간 뒤에 결과 팝업이 뜨므로 그만큼 더 머문다.
    const resultMilliseconds = outcome === 'attacked' || outcome === 'defended'
      ? TRADE_BALANCE.purchaseResultDisplayMilliseconds + TRADE_BALANCE.attackLineDisplayMilliseconds
      : outcome === 'purchased' || outcome === 'rejected' || outcome === 'brokenOff'
        ? TRADE_BALANCE.purchaseResultDisplayMilliseconds
        : TRADE_BALANCE.resultDisplayMilliseconds;
    const displayMilliseconds = delayOverrideMilliseconds ?? resultMilliseconds;
    this.time.delayedCall(displayMilliseconds, () => {
      this.completeResolvedCustomerExit();
    });
  }

  private completeResolvedCustomerExit(): void {
    if (this.customerExitAnimating) return;
    if (this.state.phase === 'Open' && this.trade.status === 'Resolved'
      && this.customerPortrait.visible) {
      this.customerExitAnimating = true;
      const targets = this.customerVisualTargets();
      this.tweens.killTweensOf(targets);
      this.tweens.add({
        targets,
        alpha: 0,
        duration: TRADE_BALANCE.customerDissolveMilliseconds,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.customerExitAnimating = false;
          this.finalizeResolvedCustomerExit();
          targets.forEach((target) => target.setAlpha(1));
        },
      });
      return;
    }
    this.finalizeResolvedCustomerExit();
  }

  private finalizeResolvedCustomerExit(): void {
    if (this.state.phase === 'Open' && this.trade.status === 'Resolved') {
      this.resetCustomerSpeech();
      this.trade.reset();
      const completed = this.customerQueue.completeActiveCustomer();
      if (completed && !this.customerQueue.hasRemainingCustomers) {
        this.closeCurrentDay();
        return;
      }
      if (completed && this.tutorialStep === 'waitSecond') {
        this.render();
        this.time.delayedCall(TUTORIAL_CONFIG.interCustomerBrightPauseMilliseconds, () => {
          if (this.tutorialStep !== 'waitSecond' || this.trade.status !== 'Idle') return;
          this.presentNextCustomerIfReady(true);
          this.time.delayedCall(TUTORIAL_CONFIG.secondCustomerSettleMilliseconds, () => {
            if (this.tutorialStep !== 'secondArrival') return;
            this.tutorialStep = 'secondIntro';
            this.render();
          });
        });
        return;
      }
    }
    this.render();
  }

  private customerVisualTargets() {
    return [this.customerPortrait, this.customerSpeechBubble, this.customerClueText];
  }

  private playCustomerEntranceDissolve(onComplete?: () => void): void {
    const targets = this.customerVisualTargets();
    this.tweens.killTweensOf(targets);
    this.tweens.add({
      targets,
      alpha: 1,
      duration: TRADE_BALANCE.customerDissolveMilliseconds,
      ease: 'Sine.easeInOut',
      onComplete,
    });
  }

  private presentFirstCustomerAfterShutter(): void {
    this.time.delayedCall(TRADE_BALANCE.firstCustomerArrivalDelayMilliseconds, () => {
      if (!this.firstCustomerArrivalPending || this.state.phase !== 'Open') return;
      this.firstCustomerArrivalPending = false;
      this.presentNextCustomerIfReady();
    });
  }

  /** 영업 종료 시 진행 중이던 손님을 정리해 다음 DAY 거래를 막지 않게 한다. */
  private clearTradeWhenShopCloses(): void {
    if (this.state.phase === 'Open' || this.trade.status === 'Idle') return;
    if (this.trade.status === 'Presenting' || this.trade.status === 'Negotiating') this.trade.reject();
    this.trade.reset();
    this.typedOffer = '';
  }

  private renderCustomerQueue(): void {
    const visible = this.state.phase === 'Open';
    this.customerQueueText.setVisible(visible);
    this.customerQueuePanel.setVisible(visible);
    if (!visible) return;
    if (this.customerQueue.hasActiveCustomer) {
      this.customerQueueText.setText(
        `방문자  ${this.customerQueue.appearedCount} / ${this.customerQueue.targetCount}명`,
      );
    } else if (this.customerQueue.hasRemainingCustomers) {
      this.customerQueueText.setText(
        `방문자  ${this.customerQueue.appearedCount} / ${this.customerQueue.targetCount}명`,
      );
    } else {
      this.customerQueueText.setText(`방문자 ${this.customerQueue.targetCount}명 완료`);
    }
    this.fitHudText(this.customerQueueText, null, 178, 31, 17);
  }

  private renderTrade(): void {
    const active = this.state.phase === 'Open' && this.trade.customer !== null;
    const customer = this.trade.customer;
    this.customerPortrait.setVisible(active);
    this.customerSpeechBubble.setVisible(active);
    this.customerClueText.setVisible(active
      && this.tutorialStep !== 'firstArrival' && this.tutorialStep !== 'intro');
    this.tradeItemPreview.setVisible(false);
    // 감정 결과는 거래 화면 위에 표시되는 확인 팝업이다. 기본 거래 UI는
    // 그대로 유지해 현재 제안가와 매입/거절 버튼의 위치를 잃지 않게 한다.
    const inputOpen = !this.eventPopupOpen;
    const canEditOffer = active && this.trade.status !== 'Resolved' && inputOpen;
    const showTutorialPurchaseResult = active && (this.tutorialStep === 'firstResult'
      || this.tutorialStep === 'firstDeparture')
      && this.tutorialPurchaseResult !== null;
    this.offerInputBackground.setVisible(canEditOffer || showTutorialPurchaseResult);
    this.offerInputLabel.setVisible(canEditOffer);
    this.offerInitialText.setVisible(canEditOffer);
    this.offerText.setVisible(canEditOffer || showTutorialPurchaseResult);
    this.offerUpButton.setVisible(canEditOffer);
    this.offerDownButton.setVisible(canEditOffer);
    this.offerButton.setVisible(canEditOffer);
    this.rejectButton.setVisible(canEditOffer);
    const canOpenItems = !this.appraisalPopupOpen && !this.eventPopupOpen && !this.itemShopVisit;
    this.appraisalButton.setVisible(true).setAlpha(canOpenItems ? 1 : 0.48);
    if (canOpenItems) this.appraisalButton.setInteractive({ useHandCursor: true });
    else this.appraisalButton.disableInteractive();
    if (this.state.phase === 'Open' && this.trade.status === 'Idle') {
      return;
    }
    if (!active || !customer) {
      this.resetCustomerSpeech();
      return;
    }
    const customerAsset = CUSTOMER_ART_BY_NAME[customer.name] ?? 'rabbit';
    this.customerPortrait
      .setTexture(`customer-${customerAsset}`)
      .setPosition(520, 309 + (CUSTOMER_PORTRAIT_Y_OFFSET_BY_ASSET[customerAsset] ?? 0))
      .setDisplaySize(CUSTOMER_PORTRAIT_SIZE.width, CUSTOMER_PORTRAIT_SIZE.height);
    this.showItemArt(this.tradeItemPreview, customer.item.id, 150);
    this.tradeItemPreview.setPosition(820, TRADE_ITEM_Y_BY_ID[customer.item.id] ?? 500);
    const profile = this.customerProfiles.profile(customer.name);
    const customerType = customer.type ?? profile.type;
    this.customerClueText.setText([
      this.transactionItemClue(customer),
      customer.sellerBehaviorClue ? `손님 관찰 · ${customer.sellerBehaviorClue}` : '',
    ].filter(Boolean));
    const tutorialSpeech = this.tutorialCustomerSpeech(customer);
    const speechLine = tutorialSpeech ?? (this.trade.status === 'Resolved' && this.trade.outcome === 'purchased'
      ? customerPurchaseLine(customer.name, customerType)
      : this.trade.status === 'Resolved' && this.trade.outcome === 'rejected'
        ? customerRejectionLine(customer.name, customerType)
      : this.trade.status === 'Resolved' && this.trade.outcome === 'brokenOff'
        ? customerBreakOffLine(customer.name, customerType)
      : this.trade.status === 'Resolved'
        && (this.trade.outcome === 'attacked' || this.trade.outcome === 'defended')
        ? customerAttackLine(customer.name, customerType)
      : this.trade.status === 'Resolved' && this.trade.outcome === 'inventoryFull'
        ? customerInventoryFullLine(customer.name, customerType)
      : this.trade.status === 'Negotiating' && this.trade.lastReaction
        && this.trade.lastReaction !== 'accepted'
        ? customerNegotiationLine(customer.name, customerType, this.trade.lastReaction, this.trade.round)
        : customerOpeningLine(
          customer.name, customerType, customer.item.name, customer.initialAskingPrice,
        ));
    this.syncCustomerSpeech(customer.id, speechLine);
    if (showTutorialPurchaseResult && this.tutorialPurchaseResult) {
      const result = this.tutorialPurchaseResult;
      this.offerInputBackground.disableInteractive();
      this.offerText.disableInteractive();
      this.offerText.setPosition(OFFER_PANEL_CENTER_X, MAIN_LAYOUT.actionY).setFontSize(17)
        .setText(`매입 완료  ·  ${result.itemName}  ·  ${result.offer.toLocaleString('ko-KR')}원`);
    } else {
      if (canEditOffer) {
        this.offerInputBackground.setInteractive({ useHandCursor: true });
        this.offerText.setInteractive({ useHandCursor: true });
      }
      this.offerInputLabel.setPosition(222, OFFER_PRIMARY_ROW_Y).setText('제안가');
      this.offerText.setPosition(OFFER_PANEL_CENTER_X, OFFER_PRIMARY_ROW_Y).setFontSize(29)
        .setText(`${this.typedOfferAmount.toLocaleString('ko-KR')}원`);
      this.offerInitialText.setPosition(OFFER_PANEL_CENTER_X, OFFER_SECONDARY_ROW_Y).setText(
        `최초 제시가  ${customer.initialAskingPrice.toLocaleString('ko-KR')}원`,
      );
    }

  }

  private syncCustomerSpeech(customerId: string, line: string): void {
    if (this.customerSpeechCustomerId !== customerId || this.customerSpeechTarget !== line) {
      this.customerSpeechCustomerId = customerId;
      this.customerSpeechTarget = line;
      this.customerSpeechCharacterCount = 0;
      this.customerSpeechElapsedMilliseconds = 0;
      this.startCustomerTypingSound();
      const finalLines = line.split('\n');
      const lineHeight = 20;
      const lineGap = 5;
      const speechBodyCenterY = -10;
      this.customerSpeechLines.forEach((lineText, index) => {
        const finalLine = finalLines[index] ?? '';
        lineText.setText(finalLine);
        const centeredLineOffset = (index - (finalLines.length - 1) / 2) * (lineHeight + lineGap);
        lineText.setPosition(0, speechBodyCenterY + centeredLineOffset);
      });
    }
    const visibleLines = Array.from(this.customerSpeechTarget)
      .slice(0, this.customerSpeechCharacterCount).join('').split('\n');
    this.customerSpeechLines.forEach((lineText, index) => lineText.setText(visibleLines[index] ?? ''));
  }

  private advanceCustomerSpeech(deltaMilliseconds: number): void {
    if (!this.customerSpeechCustomerId || !this.customerSpeechTarget) return;
    const characters = Array.from(this.customerSpeechTarget);
    if (this.customerSpeechCharacterCount >= characters.length) return;
    this.customerSpeechElapsedMilliseconds += deltaMilliseconds;
    const charactersToAdd = Math.floor(
      this.customerSpeechElapsedMilliseconds / TRADE_BALANCE.speechCharacterMilliseconds,
    );
    if (charactersToAdd <= 0) return;
    this.customerSpeechElapsedMilliseconds %= TRADE_BALANCE.speechCharacterMilliseconds;
    this.customerSpeechCharacterCount = Math.min(
      characters.length,
      this.customerSpeechCharacterCount + charactersToAdd,
    );
    if (this.customerSpeechCharacterCount >= characters.length) this.stopCustomerTypingSound();
  }

  private startCustomerTypingSound(): void {
    this.stopCustomerTypingSound();
    this.customerTypingSound = this.sound.add('sfx-customer-typing', {
      loop: true,
      volume: AUDIO_CONFIG.customerTypingVolume,
    });
    this.customerTypingSound.play();
  }

  private stopCustomerTypingSound(): void {
    this.customerTypingSound?.stop();
    this.customerTypingSound?.destroy();
    this.customerTypingSound = undefined;
  }

  private setTutorialInputError(message: string | null): void {
    if (this.tutorialInputError === message) return;
    this.tutorialInputError = message;
    this.tutorialInputErrorCharacterCount = 0;
    this.tutorialInputErrorElapsedMilliseconds = 0;
  }

  private advanceTutorialInputError(deltaMilliseconds: number): void {
    if (!this.tutorialInputError) return;
    const characters = Array.from(this.tutorialInputError);
    if (this.tutorialInputErrorCharacterCount >= characters.length) return;
    this.tutorialInputErrorElapsedMilliseconds += deltaMilliseconds;
    const charactersToAdd = Math.floor(
      this.tutorialInputErrorElapsedMilliseconds / TRADE_BALANCE.speechCharacterMilliseconds,
    );
    if (charactersToAdd <= 0) return;
    this.tutorialInputErrorElapsedMilliseconds %= TRADE_BALANCE.speechCharacterMilliseconds;
    this.tutorialInputErrorCharacterCount = Math.min(
      characters.length,
      this.tutorialInputErrorCharacterCount + charactersToAdd,
    );
  }

  private resetCustomerSpeech(): void {
    this.stopCustomerTypingSound();
    this.customerSpeechCustomerId = null;
    this.customerSpeechTarget = '';
    this.customerSpeechCharacterCount = 0;
    this.customerSpeechElapsedMilliseconds = 0;
    this.customerSpeechLines.forEach((lineText) => lineText.setText(''));
  }

  private transactionItemClue(customer: Customer): string {
    return customer.itemConditionClue ? `물건 관찰 · ${customer.itemConditionClue}` : '';
  }

  private tutorialCustomerSpeech(customer: Customer): string | null {
    if (customer.id.startsWith('tutorial-1-')) {
      if (this.trade.status === 'Presenting') {
        return '급하게 돈이 필요해서요.\n오래 쓴 라디오인데… 9,000원에 팔 수 있을까요?';
      }
      if (this.trade.status === 'Negotiating') {
        return '조금만 더 올려 주시면 안 될까요?\n8,000원이면 팔 수 있을 것 같아요.';
      }
    }
    if (customer.id.startsWith('tutorial-2-')) {
      if (this.trade.status === 'Presenting') {
        return '빈티지 카메라다. 18,000원.\n살 거면 빨리 정해.';
      }
      if (this.trade.status === 'Negotiating') {
        return '내 물건을 반값으로 보겠다는 건가?\n다음 제안은 신중히 해.';
      }
    }
    return null;
  }

  private createTutorialUi(): void {
    this.tutorialMasks = Array.from({ length: TUTORIAL_MASK_PIECE_COUNT }, () => this.add.rectangle(
      0, 0, 1, 1, TUTORIAL_CONFIG.maskColor, TUTORIAL_CONFIG.maskAlpha,
    ).setOrigin(0).setDepth(200).setInteractive().setVisible(false));
    this.tutorialBorder = this.add.graphics().setDepth(201).setVisible(false);
    this.tutorialConnector = this.add.graphics().setDepth(201).setVisible(false);
    this.tutorialActionArrow = this.add.text(0, 0, '▼\n▼', {
      fontFamily: UI_DISPLAY_FONT,
      fontSize: '25px',
      fontStyle: 'bold',
      color: '#ffe09a',
      align: 'center',
      lineSpacing: -13,
    }).setOrigin(0.5).setStroke('#4b2e13', 5).setShadow(0, 3, '#000000', 6, true, true);
    this.tutorialActionCue = this.add.container(0, 0, [this.tutorialActionArrow])
      .setDepth(204).setVisible(false);
    const panelBackground = this.add.graphics()
      .fillStyle(0x17120e, 0.98).fillRoundedRect(-300, -92, 600, 184, 10)
      .lineStyle(2, 0xa9844d, 0.95).strokeRoundedRect(-300, -92, 600, 184, 10)
      .lineStyle(1, 0x57432b, 0.8).strokeRoundedRect(-291, -83, 582, 166, 7)
      .lineBetween(-238, -38, 270, -38)
      .setInteractive(new Phaser.Geom.Rectangle(-300, -92, 600, 184), Phaser.Geom.Rectangle.Contains);
    this.tutorialTitleText = this.add.text(-260, -62, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '20px', color: '#e6cf9e', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.tutorialInstruction = this.add.text(-260, TUTORIAL_INSTRUCTION_TOP, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '17px', color: '#d8c49e', align: 'left',
      fixedWidth: 520, wordWrap: { width: 520 }, lineSpacing: 4,
    }).setOrigin(0, 0);
    this.tutorialNextButton = this.makeTradeButton(0, 66, '다음', () => this.advanceTutorial())
      .setFontSize(16).setPadding(24, 7);
    this.tutorialSkipButton = this.add.text(268, -62, '건너뛰기', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '13px', color: '#9d835e',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.tutorialSkipButton.setColor('#dcc08b'))
      .on('pointerout', () => this.tutorialSkipButton.setColor('#9d835e'))
      .on('pointerdown', () => this.skipTutorial());
    this.tutorialPanel = this.add.container(
      640, 110, [panelBackground, this.tutorialTitleText,
        this.tutorialInstruction, this.tutorialNextButton, this.tutorialSkipButton],
    ).setDepth(202).setVisible(false);
  }

  private advanceTutorial(): void {
    if (this.tutorialStep === 'intro') {
      this.tutorialStep = 'observe';
      this.customerClueText.setAlpha(0);
      this.tweens.add({
        targets: this.customerClueText,
        alpha: 1,
        duration: TUTORIAL_CONFIG.clueRevealDurationMilliseconds,
        ease: 'Sine.easeOut',
      });
    }
    else if (this.tutorialStep === 'observe') this.tutorialStep = 'openItems';
    else if (this.tutorialStep === 'firstResult') {
      this.tutorialStep = 'firstDeparture';
      this.beginTutorialCustomerTransition();
    }
    else if (this.tutorialStep === 'secondIntro') {
      this.tutorialStep = 'secondLowInput';
      this.replaceOfferOnNextDigit = true;
    }
    else if (this.tutorialStep === 'trustIntro') {
      this.tutorialStep = 'finale';
      this.tutorialOverlayVisible = false;
      this.resetTutorialPracticeState();
      this.tutorialSkipped = true;
      this.customerQueue = new CustomerQueue(customerQueueConfigForStage(this.state.stage));
      this.customerQueue.startDay();
    }
    else if (this.tutorialStep === 'finale') {
      this.tutorialStep = 'inactive';
      this.tutorialTrustSnapshot = null;
      // 첫 손님을 받기 전에 STAGE 목표를 먼저 알려준다.
      this.openStageGoal();
    }
    this.render();
  }

  private beginTutorialCustomerTransition(): void {
    const overlayTargets = [
      ...this.tutorialMasks, this.tutorialBorder, this.tutorialConnector,
      this.tutorialActionCue, this.tutorialPanel,
    ];
    this.tweens.killTweensOf(overlayTargets);
    this.tweens.add({
      targets: overlayTargets,
      alpha: 0,
      duration: TUTORIAL_CONFIG.overlayFadeDurationMilliseconds,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.tutorialStep !== 'firstDeparture') return;
        this.tutorialOverlayVisible = false;
        this.tutorialMasks.forEach((mask) => mask.setVisible(false));
        this.tutorialBorder.setVisible(false);
        this.tutorialConnector.setVisible(false);
        this.tutorialActionCue.setVisible(false);
        this.tutorialPanel.setVisible(false);
        this.time.delayedCall(TUTORIAL_CONFIG.firstCustomerBrightHoldMilliseconds, () => {
          if (this.tutorialStep !== 'firstDeparture') return;
          this.tutorialStep = 'waitSecond';
          this.completeResolvedCustomerExit();
        });
      },
    });
  }

  private skipTutorial(): void {
    this.tutorialSkipped = true;
    this.resetTutorialPracticeState();
    this.customerQueue = new CustomerQueue(customerQueueConfigForStage(this.state.stage));
    this.customerQueue.startDay();
    this.tutorialStep = 'inactive';
    // 튜토리얼을 건너뛰어도 STAGE 목표는 먼저 알려준다.
    this.openStageGoal();
  }

  private resetTutorialPracticeState(): void {
    const moneyDifference = this.openingMoney - this.state.money;
    if (moneyDifference > 0) this.state.earnMoney(moneyDifference);
    else if (moneyDifference < 0) this.state.spendMoney(-moneyDifference);
    this.closingMoney = this.openingMoney;
    this.inventory = new Inventory();
    this.specialItems = new SpecialItemInventory(ITEM_SHOP_CONFIG.startingAppraisalTicketCount);
    this.ledger = new DailyLedger();
    this.transactionHistory = new TransactionHistory();
    this.customerProfiles = new CustomerProfileStore();
    this.trade = new TradeSession();
    this.todaysCustomerNames = [];
    this.todaysItemIds = [];
    this.hoveredInventoryIndex = null;
    this.tutorialPurchaseResult = null;
    this.setTutorialInputError(null);
    this.defenseActive = false;
    this.specialItemPopupOpen = false;
    this.appraisalPopupOpen = false;
    this.specialItemPopup.setVisible(false);
    this.appraisalPopup.setVisible(false);
    this.resetCustomerSpeech();
  }

  private syncTutorialPriceInput(): void {
    const offer = this.typedOfferAmount;
    if (this.tutorialStep === 'firstLowInput'
      && offer > 0 && offer <= TUTORIAL_CONFIG.safeCustomer.askingPrice) this.tutorialStep = 'firstLowOffer';
    else if (this.tutorialStep === 'firstRaiseInput') {
      if (offer > this.state.money) {
        this.setTutorialInputError('보유 현금을 초과한 금액이다.\n보유 현금 이하로 다시 제안해 보자.');
      } else if (offer < TUTORIAL_CONFIG.safeCustomer.minimumPrice) {
        const minimum = TUTORIAL_CONFIG.safeCustomer.minimumPrice.toLocaleString('ko-KR');
        this.setTutorialInputError(`손님이 받아들일 수 있는 최소 금액은 ${minimum}원이다.\n${minimum}원 이상으로 다시 제안해 보자.`);
      } else {
        this.setTutorialInputError(null);
        this.tutorialStep = 'firstRaiseOffer';
      }
    }
    else if (this.tutorialStep === 'secondLowInput') {
      if (offer > this.state.money) {
        this.setTutorialInputError('보유 현금을 초과한 금액이다.\n보유 현금 이하로 다시 제안해 보자.');
      } else if (offer > TUTORIAL_CONFIG.riskyCustomer.warningOffer) {
        this.setTutorialInputError('이번에는 위험 신호를 확인해야 한다.\n9,000원 이하로 다시 제안해 보자.');
      } else if (offer <= 0) {
        const warning = TUTORIAL_CONFIG.riskyCustomer.warningOffer.toLocaleString('ko-KR');
        this.setTutorialInputError(`제안가는 1원 이상이어야 한다.\n1원 이상 ${warning}원 이하로 다시 제안해 보자.`);
      } else {
        this.setTutorialInputError(null);
        this.tutorialStep = 'secondLowOffer';
      }
    }
  }

  private tutorialPausesTime(): boolean {
    return (this.isTutorialDay() && this.tutorialStep !== 'inactive')
      || this.firstCustomerArrivalPending;
  }

  private renderTutorial(): void {
    this.deactivateTutorialOutsideConfiguredDay();
    const highlightsCustomerSpeech = this.tutorialStep === 'secondIntro'
      || this.tutorialStep === 'firstRaiseInput'
      || this.tutorialStep === 'firstRaiseOffer'
      || this.tutorialStep === 'firstResult'
      || this.tutorialStep === 'secondRiskOffer'
      || this.tutorialStep === 'firstDeparture';
    this.customerSpeechBubble.setDepth(highlightsCustomerSpeech ? 203 : -3);
    if (this.tutorialStep === 'firstDeparture') return;
    if (this.tutorialStep === 'inactive' || this.tutorialStep === 'firstArrival'
      || this.tutorialStep === 'waitSecond'
      || this.tutorialStep === 'secondArrival'
      || this.shutterAnimating || this.shutter.visible) {
      if (this.tutorialOverlayVisible) {
        this.tweens.killTweensOf([
          ...this.tutorialMasks, this.tutorialBorder, this.tutorialConnector,
          this.tutorialActionCue, this.tutorialPanel,
        ]);
      }
      this.tutorialOverlayVisible = false;
      this.tutorialMasks.forEach((mask) => mask.setVisible(false));
      this.tutorialBorder.setVisible(false);
      this.tutorialConnector.setVisible(false);
      this.tutorialActionCue.setVisible(false);
      this.tutorialPanel.setVisible(false);
      return;
    }
    if (this.tutorialStep === 'finale') {
      this.renderTutorialFinale();
      return;
    }
    const target = this.tutorialTarget();
    const focus = Phaser.Geom.Rectangle.Clone(target.getBounds());
    Phaser.Geom.Rectangle.Inflate(focus, 14, 14);
    focus.x = Phaser.Math.Clamp(focus.x, 6, GAME_WIDTH - 12);
    focus.y = Phaser.Math.Clamp(focus.y, 6, GAME_HEIGHT - 12);
    focus.width = Math.min(focus.width, GAME_WIDTH - focus.x - 6);
    focus.height = Math.min(focus.height, GAME_HEIGHT - focus.y - 6);
    let speechFocus: Phaser.Geom.Rectangle | null = null;
    if (highlightsCustomerSpeech) {
      speechFocus = Phaser.Geom.Rectangle.Clone(this.customerSpeechBubble.getBounds());
      Phaser.Geom.Rectangle.Inflate(speechFocus, 14, 14);
    }
    this.applyTutorialShade(speechFocus ? [focus, speechFocus] : [focus]);
    this.tutorialBorder.clear()
      .lineStyle(7, 0xd4a450, 0.16).strokeRoundedRect(focus.x, focus.y, focus.width, focus.height, 10)
      .lineStyle(2, 0xd8ad62, 0.95).strokeRoundedRect(focus.x, focus.y, focus.width, focus.height, 10)
      .setVisible(true);
    if (speechFocus) {
      this.tutorialBorder
        .lineStyle(7, 0xd4a450, 0.16)
        .strokeRoundedRect(speechFocus.x, speechFocus.y, speechFocus.width, speechFocus.height, 10)
        .lineStyle(2, 0xd8ad62, 0.95)
        .strokeRoundedRect(speechFocus.x, speechFocus.y, speechFocus.width, speechFocus.height, 10);
    }
    const panelX = this.tutorialStep === 'secondIntro' || this.tutorialStep === 'secondRiskOffer'
      ? 330
      : (this.tutorialStep === 'firstRaiseInput' || this.tutorialStep === 'firstRaiseOffer'
          || this.tutorialStep === 'firstResult')
        ? 950
        : 640;
    const panelY = this.tutorialStep === 'confirmAppraisal'
      ? 620
      : this.tutorialStep === 'observe'
        ? 490
        : this.tutorialStep === 'secondRiskOffer'
          ? 340
        : this.tutorialStep === 'secondIntro'
          ? 490
        : (this.tutorialStep === 'firstRaiseInput' || this.tutorialStep === 'firstRaiseOffer'
            || this.tutorialStep === 'firstResult')
          ? 430
        : focus.centerY < 360 ? 620 : 95;
    this.tutorialConnector.clear().lineStyle(2, 0xb98b45, 0.72);
    if (this.tutorialStep === 'observe') {
      const startX = panelX + 300;
      const startY = panelY + 38;
      const targetX = focus.centerX;
      const targetY = focus.top;
      const approachY = targetY - 18;
      this.tutorialConnector.beginPath().moveTo(startX, startY)
        .lineTo(targetX, startY).lineTo(targetX, approachY)
        .lineTo(targetX, targetY).strokePath()
        .fillStyle(0xd6a65a, 0.95)
        .fillTriangle(targetX, targetY, targetX - 7, targetY - 10, targetX + 7, targetY - 10)
        .setVisible(true);
    } else if (this.tutorialStep === 'secondIntro') {
      const startX = panelX + 300;
      const startY = panelY + 50;
      const targetX = focus.left;
      const targetY = focus.centerY;
      const elbowX = (startX + targetX) / 2;
      this.tutorialConnector.beginPath().moveTo(startX, startY)
        .lineTo(elbowX, startY).lineTo(elbowX, targetY).lineTo(targetX, targetY).strokePath()
        .fillStyle(0xd6a65a, 0.95)
        .fillTriangle(targetX, targetY, targetX - 10, targetY - 7, targetX - 10, targetY + 7)
        .setVisible(true);
    } else {
      const panelEdgeY = panelY > focus.centerY
        ? panelY - TUTORIAL_PANEL_HALF_HEIGHT : panelY + TUTORIAL_PANEL_HALF_HEIGHT;
      const focusEdgeY = panelY > focus.centerY ? focus.bottom : focus.top;
      const verticalGap = Math.abs(panelEdgeY - focusEdgeY);
      if (verticalGap < 32) {
        const startX = panelX + 300;
        const startY = panelY;
        const targetX = focus.right;
        const targetY = focus.centerY;
        const routeX = Math.max(startX + 36, targetX + 36);
        this.tutorialConnector.beginPath().moveTo(startX, startY)
          .lineTo(routeX, startY).lineTo(routeX, targetY).lineTo(targetX, targetY).strokePath()
          .fillStyle(0xd6a65a, 0.95)
          .fillTriangle(targetX, targetY, targetX + 10, targetY - 7, targetX + 10, targetY + 7)
          .setVisible(true);
      } else {
        const connectorX = Phaser.Math.Clamp(focus.centerX, panelX - 265, panelX + 265);
        const elbowY = (panelEdgeY + focusEdgeY) / 2;
        this.tutorialConnector.beginPath().moveTo(connectorX, panelEdgeY).lineTo(connectorX, elbowY)
          .lineTo(focus.centerX, elbowY).lineTo(focus.centerX, focusEdgeY).strokePath()
          .fillStyle(0xd6a65a, 0.95);
        const arrowDirection = panelY > focus.centerY ? -1 : 1;
        const arrowBaseY = focusEdgeY - arrowDirection * 10;
        this.tutorialConnector.fillTriangle(
          focus.centerX, focusEdgeY,
          focus.centerX - 7, arrowBaseY,
          focus.centerX + 7, arrowBaseY,
        ).setVisible(true);
      }
    }
    if (speechFocus && this.tutorialStep === 'secondRiskOffer') {
      const startX = panelX + 300;
      const startY = panelY - 35;
      const targetX = speechFocus.left;
      const targetY = speechFocus.centerY;
      const elbowX = (startX + targetX) / 2;
      this.tutorialConnector.lineStyle(2, 0xb98b45, 0.72)
        .beginPath().moveTo(startX, startY)
        .lineTo(elbowX, startY).lineTo(elbowX, targetY).lineTo(targetX, targetY).strokePath()
        .fillStyle(0xd6a65a, 0.95)
        .fillTriangle(targetX, targetY, targetX - 10, targetY - 7, targetX - 10, targetY + 7);
    } else if (speechFocus) {
      const speechConnectorX = Phaser.Math.Clamp(
        speechFocus.centerX, panelX - 265, panelX + 265,
      );
      const speechPanelEdgeY = panelY - TUTORIAL_PANEL_HALF_HEIGHT;
      const speechTargetY = speechFocus.bottom;
      const speechElbowY = (speechPanelEdgeY + speechTargetY) / 2;
      this.tutorialConnector.lineStyle(2, 0xb98b45, 0.72)
        .beginPath().moveTo(speechConnectorX, speechPanelEdgeY)
        .lineTo(speechConnectorX, speechElbowY)
        .lineTo(speechFocus.centerX, speechElbowY)
        .lineTo(speechFocus.centerX, speechTargetY).strokePath()
        .fillStyle(0xd6a65a, 0.95)
        .fillTriangle(
          speechFocus.centerX, speechTargetY,
          speechFocus.centerX - 7, speechTargetY + 10,
          speechFocus.centerX + 7, speechTargetY + 10,
        );
    }
    this.tutorialTitleText.setText(this.tutorialTitle());
    const tutorialInstructionFullText = this.tutorialInputError ?? this.tutorialMessage();
    const tutorialInstructionText = this.tutorialInputError
      ? Array.from(this.tutorialInputError).slice(0, this.tutorialInputErrorCharacterCount).join('')
      : tutorialInstructionFullText;
    this.tutorialInstruction
      .setPosition(-260, TUTORIAL_INSTRUCTION_TOP)
      .setText(tutorialInstructionText)
      .setColor(this.tutorialInputError ? '#df6259' : '#d8c49e');
    this.tutorialNextButton.setVisible(
      this.tutorialStep === 'intro' || this.tutorialStep === 'observe'
      || this.tutorialStep === 'firstResult' || this.tutorialStep === 'secondIntro'
      || this.tutorialStep === 'trustIntro',
    ).setText('다음');
    this.tutorialSkipButton.setVisible(this.tutorialStep !== 'attackResult');
    if (this.tutorialNeedsDirectAction()) {
      const actionBounds = this.tutorialActionTarget().getBounds();
      this.placeTutorialActionCue(actionBounds, panelX, panelY);
    } else {
      this.tutorialActionCue.setVisible(false);
    }
    this.tutorialPanel.setPosition(panelX, panelY).setVisible(true);
    if (!this.tutorialOverlayVisible) {
      this.tutorialOverlayVisible = true;
      const fadeTargets = [
        ...this.tutorialMasks, this.tutorialBorder, this.tutorialConnector,
        this.tutorialActionCue, this.tutorialPanel,
      ];
      fadeTargets.forEach((target) => target.setAlpha(0));
      this.tweens.add({
        targets: fadeTargets,
        alpha: 1,
        duration: TUTORIAL_CONFIG.overlayFadeDurationMilliseconds,
        ease: 'Sine.easeOut',
      });
    }
  }

  /**
   * 어두운 마스크를 hole 바깥 영역에만 깔아, hole로 지정한 사각형 구역들을 밝게 남긴다.
   * hole이 여러 개여도 되도록 가로 띠 단위로 잘라 배치한다.
   */
  private applyTutorialShade(holes: Phaser.Geom.Rectangle[]): void {
    const screenWidth = GAME_WIDTH;
    const screenHeight = GAME_HEIGHT;
    // 밴드 경계와 포함 판정에 같은 정수 좌표를 써야 한다. 반올림 값과 원본 값을 섞으면
    // 구멍이 자기 밴드의 포함 조건에서 탈락해 밴드 전체가 덮이고 대상 클릭이 막힌다.
    const cutouts = holes.map((hole) => ({
      top: Phaser.Math.Clamp(Math.floor(hole.top), 0, screenHeight),
      bottom: Phaser.Math.Clamp(Math.ceil(hole.bottom), 0, screenHeight),
      left: Phaser.Math.Clamp(Math.floor(hole.left), 0, screenWidth),
      right: Phaser.Math.Clamp(Math.ceil(hole.right), 0, screenWidth),
    })).filter((hole) => hole.bottom > hole.top && hole.right > hole.left);
    const bandEdges = [...new Set([
      0,
      screenHeight,
      ...cutouts.flatMap((hole) => [hole.top, hole.bottom]),
    ])].sort((left, right) => left - right);
    const regions: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let index = 0; index < bandEdges.length - 1; index += 1) {
      const bandTop = bandEdges[index]!;
      const bandBottom = bandEdges[index + 1]!;
      if (bandBottom <= bandTop) continue;
      const bandHoles = cutouts
        .filter((hole) => hole.top <= bandTop && hole.bottom >= bandBottom)
        .sort((left, right) => left.left - right.left);
      let cursorX = 0;
      bandHoles.forEach((hole) => {
        if (hole.left > cursorX) {
          regions.push({
            x: cursorX, y: bandTop, width: hole.left - cursorX, height: bandBottom - bandTop,
          });
        }
        cursorX = Math.max(cursorX, hole.right);
      });
      if (cursorX < screenWidth) {
        regions.push({
          x: cursorX, y: bandTop, width: screenWidth - cursorX, height: bandBottom - bandTop,
        });
      }
    }
    this.tutorialMasks.forEach((mask, index) => {
      const region = regions[index];
      if (!region) {
        mask.setVisible(false);
        return;
      }
      mask.setPosition(region.x, region.y)
        .setDisplaySize(Math.max(1, region.width), Math.max(1, region.height))
        .setVisible(true);
    });
  }

  private renderTutorialFinale(): void {
    const fullScreenMask = this.tutorialMasks[0]!;
    fullScreenMask.setPosition(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setVisible(true);
    this.tutorialMasks.slice(1).forEach((mask) => mask.setVisible(false));
    this.tutorialBorder.setVisible(false);
    this.tutorialConnector.setVisible(false);
    this.tutorialActionCue.setVisible(false);
    this.tutorialTitleText.setText('이제, 당신의 전당포입니다');
    this.tutorialInstruction
      .setPosition(-260, TUTORIAL_INSTRUCTION_TOP)
      .setText('손님의 말과 물건 속 단서를 살피고,\n신중하고 절묘하게 흥정하며 전당포를 운영해 보자.')
      .setColor('#d8c49e');
    this.tutorialNextButton.setVisible(true).setText('영업 시작');
    this.tutorialSkipButton.setVisible(false);
    this.tutorialPanel.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2).setVisible(true);

    if (!this.tutorialOverlayVisible) {
      this.tutorialOverlayVisible = true;
      const fadeTargets = [fullScreenMask, this.tutorialPanel];
      fadeTargets.forEach((target) => target.setAlpha(0));
      this.tweens.add({
        targets: fadeTargets,
        alpha: 1,
        duration: TUTORIAL_CONFIG.overlayFadeDurationMilliseconds,
        ease: 'Sine.easeOut',
      });
    }
  }

  private tutorialTitle(): string {
    switch (this.tutorialStep) {
      case 'intro':
      case 'observe': return '물건과 손님 살펴보기';
      case 'openItems':
      case 'chooseAppraisal':
      case 'confirmAppraisal': return '감정하기';
      case 'firstLowInput':
      case 'firstLowOffer':
      case 'firstRaiseInput':
      case 'firstRaiseOffer': return '가격 제안하기';
      case 'firstResult': return '매입 결과 확인하기';
      case 'secondIntro':
      case 'secondLowInput':
      case 'secondLowOffer': return '위험 신호 살펴보기';
      case 'secondRiskOffer': return '과도한 흥정 확인하기';
      case 'attackResult': return '공격 결과 확인하기';
      case 'trustIntro': return '신뢰도 알아보기';
      case 'finale': return '영업 시작하기';
      default: return '거래 배우기';
    }
  }

  private tutorialTarget(): Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle } {
    switch (this.tutorialStep) {
      case 'openItems': return this.appraisalButton;
      case 'chooseAppraisal': return this.specialItemAppraisalCard;
      case 'confirmAppraisal': return this.appraisalResultFrame;
      case 'firstLowInput':
      case 'firstRaiseInput':
      case 'secondLowInput': return this.offerInputBackground;
      case 'firstLowOffer':
      case 'firstRaiseOffer':
      case 'secondLowOffer':
      case 'secondRiskOffer': return this.offerButton;
      case 'firstResult': return this.offerInputBackground;
      case 'attackResult': return this.eventResultFrame;
      case 'trustIntro': return this.trustTutorialFocus;
      case 'observe': return this.tutorialItemClueFocus;
      case 'intro': return this.customerSpeechBubble;
      case 'secondIntro':
      default: return this.customerClueText;
    }
  }

  private tutorialNeedsDirectAction(): boolean {
    switch (this.tutorialStep) {
      case 'openItems':
      case 'chooseAppraisal':
      case 'confirmAppraisal':
      case 'firstLowInput':
      case 'firstLowOffer':
      case 'firstRaiseInput':
      case 'firstRaiseOffer':
      case 'secondLowInput':
      case 'secondLowOffer':
      case 'secondRiskOffer':
      case 'attackResult': return true;
      default: return false;
    }
  }

  private tutorialActionTarget(): Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle } {
    switch (this.tutorialStep) {
      case 'confirmAppraisal': return this.appraisalConfirmButton;
      case 'attackResult': return this.eventConfirmButton;
      default: return this.tutorialTarget();
    }
  }

  private placeTutorialActionCue(
    actionBounds: Phaser.Geom.Rectangle,
    panelX: number,
    panelY: number,
  ): void {
    const cueX = Phaser.Math.Clamp(actionBounds.centerX, 34, GAME_WIDTH - 34);
    const aboveY = actionBounds.top - TUTORIAL_ACTION_CUE_MARGIN;
    const belowY = actionBounds.bottom + TUTORIAL_ACTION_CUE_MARGIN;
    const panelBounds = new Phaser.Geom.Rectangle(
      panelX - TUTORIAL_PANEL_HALF_WIDTH,
      panelY - TUTORIAL_PANEL_HALF_HEIGHT,
      TUTORIAL_PANEL_HALF_WIDTH * 2,
      TUTORIAL_PANEL_HALF_HEIGHT * 2,
    );
    const candidateBounds = (y: number) => new Phaser.Geom.Rectangle(cueX - 34, y - 30, 68, 60);
    const placementPenalty = (bounds: Phaser.Geom.Rectangle): number => {
      const overflow = Math.max(0, 8 - bounds.top) + Math.max(0, bounds.bottom - (GAME_HEIGHT - 8));
      const overlapWidth = Math.max(0, Math.min(bounds.right, panelBounds.right) - Math.max(bounds.left, panelBounds.left));
      const overlapHeight = Math.max(0, Math.min(bounds.bottom, panelBounds.bottom) - Math.max(bounds.top, panelBounds.top));
      return overflow * 1_000 + overlapWidth * overlapHeight;
    };
    const abovePenalty = placementPenalty(candidateBounds(aboveY));
    const belowPenalty = placementPenalty(candidateBounds(belowY));
    const placement: 'above' | 'below' = abovePenalty <= belowPenalty ? 'above' : 'below';
    const cueY = placement === 'above' ? aboveY : belowY;

    if (this.tutorialActionCuePlacement !== placement) {
      this.tweens.killTweensOf(this.tutorialActionArrow);
      this.tutorialActionCuePlacement = placement;
      this.tutorialActionArrow
        .setText(placement === 'above' ? '▼\n▼' : '▲\n▲')
        .setPosition(0, 0)
        .setScale(1)
        .setAlpha(1);
      this.tweens.add({
        targets: this.tutorialActionArrow,
        y: placement === 'above' ? 10 : -10,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.82,
        duration: 430,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }

    this.tutorialActionCue
      .setPosition(cueX, Phaser.Math.Clamp(cueY, 38, GAME_HEIGHT - 38))
      .setVisible(true);
  }

  private tutorialMessage(): string {
    switch (this.tutorialStep) {
      case 'intro': return '첫 영업을 시작해 보자.\n손님의 말뿐 아니라 물건과 태도도 함께 살펴야 한다.';
      case 'observe': return '말과 물건 상태에는 특별한 이상이 없어 보인다.\n그래도 첫 거래이니 진품 여부를 확인해 보자.';
      case 'openItems': return '왼쪽의 아이템 창을 열고 감정 도구를 사용해 보자.\n(튜토리얼이 끝나면 아이템 창과 매입품 창은 드래그해서 움직일 수 있다.)';
      case 'chooseAppraisal': return '감정 도구를 선택하면 첫 제안 전에\n물건의 진품·가품 여부를 확인할 수 있다.';
      case 'confirmAppraisal': return `감정 결과는 진품이다.\n(가품일 경우 매입품 기준가의 ${Math.round(AUTHENTICITY_CONFIG.fakeDisposalRatio * 100)}%로만 판매할 수 있다.)`;
      case 'firstLowInput': return '매입가가 낮을수록 판매 이익의 여지는 커진다.\n최초 제시가 이하를 키보드로 입력하고 Enter로 제안해 보자.\n이후에는 매입 제안 버튼을 눌러도 제안할 수 있다.';
      case 'firstLowOffer': return '입력한 금액으로 제안해\n손님의 반응을 확인해 보자.';
      case 'firstRaiseInput': return this.tutorialInputError
        ?? '손님이 조금 더 올려 달라고 한다.\n8,000원 이상을 입력하고 Enter로 다시 제안해 보자.';
      case 'firstRaiseOffer': return `${this.typedOfferAmount.toLocaleString('ko-KR')}원이 입력됐다.\n매입 제안을 눌러 다시 제안해 보자.`;
      case 'firstResult': return '물건과 손님의 단서를 살펴 매입가를 정했다.\n판매할 때 이 거래의 실제 손익을 확인할 수 있다.';
      case 'secondIntro': return '말투가 거칠고 물건의 출처도 불분명하다.\n이번에는 거래의 위험 신호를 살펴보자.';
      case 'secondLowInput': return this.tutorialInputError
        ?? '과도한 흥정의 위험을 확인하기 위해\n9,000원 이하의 가격을 입력하고 Enter로 제안해 보자.';
      case 'secondLowOffer': return `${this.typedOfferAmount.toLocaleString('ko-KR')}원이 입력됐다.\n매입 제안을 눌러 손님의 반응을 확인해 보자.`;
      case 'secondRiskOffer': return `경고에도 ${this.typedOfferAmount.toLocaleString('ko-KR')}원으로 다시 제안한다.\n매입 제안을 눌러 과도한 흥정의 결과를 확인해 보자.`;
      case 'attackResult': return '과도한 흥정으로 손님에게 공격받아 거래가 끝났고,\n병원비가 지출됐다.';
      case 'trustIntro': return '거래가 성사되면 신뢰도가 오른다.\n과도한 흥정이 공격·결렬로 끝나면 한 번 낮아진다.\n신뢰도가 높으면 더 낮은 제안도 받아들일 수 있다.';
      case 'finale': return '손님의 말과 물건 속 단서를 살피고,\n신중하고 절묘하게 흥정하며 전당포를 운영해 보자.';
      default: return '';
    }
  }

  private createSpecialItemPopup(): void {
    const popupImage = this.add.image(0, 0, 'special-item-popup-title-clean')
      .setDisplaySize(656, 690)
      .setInteractive();
    const titleIcon = this.add.image(-74, -284, 'hud-v3-menu-appraise-magnifier-only')
      .setDisplaySize(54, 54);
    // fitToolWindowAtFinalSize의 0.68배 축소 후 거래 기록 제목과 같은 최종 32px가 된다.
    const title = this.add.text(18, -284, '아이템', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '47px', color: '#d9bd8b', fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(4);
    const dragHandle = this.add.rectangle(0, -302, 470, 62, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const closeHitArea = this.add.rectangle(269, -284, 54, 54, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleSpecialItemPopup());

    const definitions = [
      { label: SPECIAL_ITEM_PRESENTATION.market.name, description: SPECIAL_ITEM_PRESENTATION.market.description, texture: SPECIAL_ITEM_PRESENTATION.market.texture, x: -146, labelY: -4, countX: -47, countY: -195, artY: -115, artWidth: 116, artHeight: 116 },
      { label: SPECIAL_ITEM_PRESENTATION.time.name, description: SPECIAL_ITEM_PRESENTATION.time.description, texture: SPECIAL_ITEM_PRESENTATION.time.texture, x: 146, labelY: -4, countX: 244, countY: -195, artY: -118, artWidth: 92, artHeight: 128 },
      { label: SPECIAL_ITEM_PRESENTATION.appraisal.name, description: SPECIAL_ITEM_PRESENTATION.appraisal.description, texture: SPECIAL_ITEM_PRESENTATION.appraisal.texture, x: -146, labelY: 262, countX: -47, countY: 71, artY: 149, artWidth: 132, artHeight: 108 },
      { label: SPECIAL_ITEM_PRESENTATION.defense.name, description: SPECIAL_ITEM_PRESENTATION.defense.description, texture: SPECIAL_ITEM_PRESENTATION.defense.texture, x: 146, labelY: 262, countX: 244, countY: 71, artY: 146, artWidth: 108, artHeight: 128 },
    ] as const;
    // 아이템 창은 기존 아이템 전용 말풍선 에셋과 배치를 유지한다.
    this.specialItemTooltipBackground = this.add.image(0, 0, 'tooltip-left')
      .setDisplaySize(420, 250);
    this.specialItemTooltipTitle = this.add.text(TOOLTIP_FRAME.centerX, TOOLTIP_FRAME.titleY + 5, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '25px', color: '#f2d8a4', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
    this.specialItemTooltipBody = this.add.text(TOOLTIP_FRAME.centerX, TOOLTIP_FRAME.bodyY, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '19px', color: '#ead5ad', fontStyle: 'bold',
      lineSpacing: 8, fixedWidth: 330, align: 'center', wordWrap: { width: 330 },
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
    this.specialItemTooltip = this.add.container(
      0, 0, [this.specialItemTooltipBackground, this.specialItemTooltipTitle,
        this.specialItemTooltipBody],
    )
      .setDepth(TOOLTIP_DEPTH).setVisible(false);
    const cards = definitions.map((definition, index) => {
      const art = this.add.image(definition.x, definition.artY, definition.texture)
        .setDisplaySize(definition.artWidth, definition.artHeight);
      const labelText = this.add.text(definition.x, definition.labelY, definition.label, {
        fontFamily: INVENTORY_DISPLAY_FONT,
        fontSize: '24px',
        color: '#f0d39a',
        fontStyle: 'bold',
      }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
      const countText = this.add.text(definition.countX, definition.countY, 'x0', {
        fontFamily: UI_DISPLAY_FONT,
        fontSize: '25px',
        color: '#f5dba2',
        fontStyle: 'bold',
      }).setOrigin(0.5).setShadow(0, 2, '#000000', 3, true, true).setResolution(4);
      this.specialItemCountTexts.push(countText);
      const cardBounds = this.add.rectangle(0, 0, 277, 257, 0x000000, 0);
      const card = this.add.container(definition.x, index < 2 ? -101 : 165, [cardBounds])
        .setSize(277, 257).setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.tutorialStep !== 'inactive') {
            this.specialItemTooltip.setVisible(false);
            return;
          }
          this.specialItemTooltipTitle.setText(definition.label);
          // 모든 아이템은 동일한 오른쪽 말풍선으로 표시해 방향과 여백을 통일한다.
          this.specialItemTooltipBody.setText(definition.description);
          this.placeTooltipBesideCell(this.specialItemTooltip, this.specialItemPopup, {
            x: definition.x, y: index < 2 ? -101 : 165, width: 277,
          });
        })
        .on('pointerout', () => this.specialItemTooltip.setVisible(false))
        .on('pointerdown', () => this.useSpecialItemFromPopup(index));
      if (index === 1) this.specialItemTimeCard = card;
      if (index === 2) this.specialItemAppraisalCard = card;
      if (index === 3) this.specialItemDefenseCard = card;
      return [art, labelText, countText, card];
    });

    this.specialItemPopup = this.add.container(
      SPECIAL_ITEM_POPUP_DEFAULT_POSITION.x, SPECIAL_ITEM_POPUP_DEFAULT_POSITION.y,
      [popupImage, titleIcon, title, dragHandle, closeHitArea, ...cards.flat()],
    ).setDepth(TOOL_WINDOW_BASE_DEPTH).setVisible(false);
    this.fitToolWindowAtFinalSize(this.specialItemPopup, TOOL_WINDOW_SCALE);
    this.makeDraggableToolWindowAfterTutorial(
      this.specialItemPopup, dragHandle, 656 * TOOL_WINDOW_SCALE, 690 * TOOL_WINDOW_SCALE,
    );
  }

  private toggleSpecialItemPopup(): void {
    if (this.appraisalPopupOpen || this.eventPopupOpen || this.itemShopVisit) return;
    if (this.tutorialStep !== 'inactive' && this.tutorialStep !== 'openItems') return;
    this.specialItemPopupOpen = !this.specialItemPopupOpen;
    if (this.specialItemPopupOpen) this.focusToolWindow(this.specialItemPopup);
    if (this.tutorialStep === 'openItems' && this.specialItemPopupOpen) {
      this.specialItemPopup.setPosition(
        SPECIAL_ITEM_POPUP_DEFAULT_POSITION.x,
        SPECIAL_ITEM_POPUP_DEFAULT_POSITION.y,
      );
      this.tutorialStep = 'chooseAppraisal';
    }
    this.specialItemPopup.setVisible(this.specialItemPopupOpen);
    this.render();
  }

  private renderSpecialItemPopup(): void {
    this.specialItemPopup.setVisible(this.specialItemPopupOpen);
    if (!this.specialItemPopupOpen || this.tutorialStep !== 'inactive') {
      this.specialItemTooltip.setVisible(false);
    }
    const counts = [
      this.specialItems.marketPreviewTicketCount,
      this.specialItems.timeExtensionItemCount,
      this.specialItems.appraisalTicketCount,
      this.specialItems.defenseItemCount,
    ];
    this.specialItemCountTexts.forEach((text, index) => text.setText(`x${counts[index] ?? 0}`));
    const canAppraise = this.specialItemPopupOpen
      && this.trade.canAppraise && this.specialItems.appraisalTicketCount > 0;
    this.specialItemAppraisalCard.setAlpha(canAppraise ? 1 : 0.72);
    const canUseTime = this.state.phase === 'Open'
      && this.specialItems.timeExtensionItemCount > 0;
    const canUseDefense = this.state.phase === 'Open'
      && !this.defenseActive && this.specialItems.defenseItemCount > 0;
    this.specialItemTimeCard.setAlpha(canUseTime ? 1 : 0.72);
    this.specialItemDefenseCard.setAlpha(canUseDefense ? 1 : 0.72);
  }

  private useSpecialItemFromPopup(index: number): void {
    if (index === 2) {
      if (this.tutorialStep !== 'inactive' && this.tutorialStep !== 'chooseAppraisal') return;
      if (!this.trade.canAppraise || this.specialItems.appraisalTicketCount <= 0) return;
      this.specialItemPopupOpen = false;
      this.useAppraisalTicket();
    } else if (index === 1) {
      this.useTimeExtensionItem();
    } else if (index === 3) {
      this.activateDefense();
    }
  }

  private createInventoryPopup(): void {
    const background = this.add.rectangle(0, 0, 824, 664, 0x070708, 0.995).setInteractive();
    const popupBackground = this.add.image(0, 0, 'purchased-items-popup-title-clean').setDisplaySize(850, 690);
    // 최종 0.68배 축소를 역산: 기존 아이콘의 90%, 화면 기준 3px 왼쪽 이동.
    const titleIcon = this.add.image(-74 - (3 / TOOL_WINDOW_SCALE), -291, 'hud-v3-menu-inventory-bag-only')
      .setDisplaySize(54 * 0.9, 54 * 0.9);
    // fitToolWindowAtFinalSize의 0.68배 축소 후 거래 기록 제목과 같은 최종 32px가 된다.
    const title = this.add.text(15, -286, '매입품', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '47px', color: '#d9bd8b', fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(4);
    const dragHandle = this.add.rectangle(-40, -302, 610, 70, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    const closeHitArea = this.add.rectangle(367, -288, 50, 50, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleInventory());
    const children: Phaser.GameObjects.GameObject[] = [
      background, popupBackground, titleIcon, title, dragHandle, closeHitArea,
    ];
    const cellWidth = 249;
    const cellHeight = 164;
    const gapX = 17;
    const gapY = 10;
    const gridWidth = INVENTORY_CONFIG.columns * cellWidth
      + (INVENTORY_CONFIG.columns - 1) * gapX;
    const startX = -gridWidth / 2 + cellWidth / 2;
    const startY = -157;

    for (let index = 0; index < this.inventory.capacity; index += 1) {
      const column = index % INVENTORY_CONFIG.columns;
      const row = Math.floor(index / INVENTORY_CONFIG.columns);
      const cellX = startX + column * (cellWidth + gapX);
      const cellY = startY + row * (cellHeight + gapY);
      const frame = this.add.rectangle(0, 0, cellWidth - 7, cellHeight - 7, 0x402044, 0)
        .setStrokeStyle(0, 0x000000, 0);
      const ornament = this.add.graphics();
      const velvet = this.add.rectangle(0, -13, cellWidth - 24, cellHeight - 48, 0x5a2560, 0);
      const image = this.add.image(0, -13, 'item-vintage-camera').setVisible(false);
      const quantity = this.add.text(cellWidth / 2 - 24, -cellHeight / 2 + 20, 'x1', {
        fontFamily: UI_DISPLAY_FONT, fontSize: '23px', fontStyle: 'bold', color: '#f0d59b',
      }).setOrigin(1, 0.5).setShadow(0, 2, '#000000', 3, true, true).setVisible(false);
      const label = this.add.text(0, cellHeight / 2 - 17, '', {
        fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '24px', fontStyle: 'bold', color: '#e5cca0', align: 'center',
        fixedWidth: cellWidth - 18,
      }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true);
      const cell = this.add.container(
        cellX, cellY, [velvet, ornament, frame, image, quantity, label],
      )
        .setSize(cellWidth, cellHeight).setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.tutorialStep !== 'inactive') {
            this.hoveredInventoryIndex = null;
            this.inventoryDetailPanel.setVisible(false);
            return;
          }
          this.hoveredInventoryIndex = index;
          this.renderInventory();
        })
        .on('pointerout', () => {
          if (this.hoveredInventoryIndex === index) this.hoveredInventoryIndex = null;
          this.renderInventory();
        });
      this.inventoryCells.push(cell);
      this.inventoryCellFrames.push(frame);
      this.inventoryCellVelvets.push(velvet);
      this.inventoryCellOrnaments.push(ornament);
      this.inventoryCellImages.push(image);
      this.inventoryCellLabels.push(label);
      this.inventoryCellQuantities.push(quantity);
      children.push(cell);
    }

    this.inventoryDetailBackground = this.add.image(0, 0, 'tooltip-left')
      .setDisplaySize(TOOLTIP_FRAME.width, TOOLTIP_FRAME.height);
    this.inventoryDetailTitle = this.add.text(TOOLTIP_FRAME.centerX, TOOLTIP_FRAME.titleY + 10, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '22px', fontStyle: 'bold', color: '#f2d8a4',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
    this.inventoryDetail = this.add.text(TOOLTIP_FRAME.contentLeft, TOOLTIP_FRAME.contentTop, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '18px', fontStyle: 'bold', color: '#ead5ad',
      align: 'left', fixedWidth: 300, lineSpacing: 5,
    }).setOrigin(0, 0).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
    this.inventoryDetailAuthenticity = this.add.text(TOOLTIP_FRAME.contentLeft, TOOLTIP_FRAME.footerY, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '18px', fontStyle: 'bold', color: '#ead5ad',
      align: 'left', fixedWidth: 300,
    }).setOrigin(0, 0).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
    this.inventoryDetailPanel = this.add.container(0, 0, [
      this.inventoryDetailBackground, this.inventoryDetailTitle,
      this.inventoryDetail, this.inventoryDetailAuthenticity,
    ]).setDepth(TOOLTIP_DEPTH).setVisible(false);
    // 슬롯 카운트는 팝업 하단 여백에 고정해 상세 말풍선이 열려도 위로 밀리지 않게 한다.
    const slotText = this.add.text(0, 335, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '24px', fontStyle: 'bold', color: '#e0c28b',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 3, true, true).setName('inventory-slot-count');
    children.push(slotText);
    this.inventoryPopup = this.add.container(380, 360, children)
      .setDepth(TOOL_WINDOW_BASE_DEPTH).setVisible(false);
    this.fitToolWindowAtFinalSize(this.inventoryPopup, TOOL_WINDOW_SCALE);
    this.makeDraggableToolWindowAfterTutorial(
      this.inventoryPopup, dragHandle, 850 * TOOL_WINDOW_SCALE, 690 * TOOL_WINDOW_SCALE,
    );
  }

  /**
   * 말풍선을 호버한 칸 바로 옆(기본 오른쪽)에 씬 좌표로 놓는다.
   * 창은 TOOL_WINDOW_SCALE로 축소돼 있으므로 창 안쪽 좌표에 배율을 곱해 화면 좌표로 바꾼다.
   * 오른쪽에 자리가 없으면 왼쪽으로 뒤집고, 마지막에 화면 안으로 클램프한다.
   */
  private placeTooltipBesideCell(
    tooltip: Phaser.GameObjects.Container,
    window: Phaser.GameObjects.Container,
    cell: { x: number; y: number; width: number },
  ): void {
    const gap = 12;
    const halfTooltip = TOOLTIP_FRAME.width / 2;
    const halfCell = (cell.width * TOOL_WINDOW_SCALE) / 2;
    const cellScreenX = window.x + cell.x * TOOL_WINDOW_SCALE;
    const cellScreenY = window.y + cell.y * TOOL_WINDOW_SCALE;
    const rightX = cellScreenX + halfCell + gap + halfTooltip;
    const leftX = cellScreenX - halfCell - gap - halfTooltip;
    const x = rightX + halfTooltip <= GAME_WIDTH - 8 ? rightX : leftX;
    tooltip
      .setPosition(
        Phaser.Math.Clamp(x, halfTooltip + 8, GAME_WIDTH - halfTooltip - 8),
        Phaser.Math.Clamp(
          cellScreenY,
          TOOLTIP_FRAME.height / 2 + 8,
          GAME_HEIGHT - TOOLTIP_FRAME.height / 2 - 8,
        ),
      )
      .setVisible(true);
  }

  private fitToolWindowAtFinalSize(
    container: Phaser.GameObjects.Container, scale: number,
  ): void {
    container.list.forEach((child) => {
      const displayChild = child as Phaser.GameObjects.Container;
      displayChild.setPosition(displayChild.x * scale, displayChild.y * scale);
      if (child instanceof Phaser.GameObjects.Text) {
        const sourceFontSize = Number.parseFloat(String(child.style.fontSize));
        child.setFontSize(Math.max(10, Math.round(sourceFontSize * scale))).setResolution(4);
      } else if (child instanceof Phaser.GameObjects.Container) {
        if (child.width > 0 || child.height > 0) child.setSize(child.width * scale, child.height * scale);
        this.fitToolWindowAtFinalSize(child, scale);
      } else {
        displayChild.setScale(displayChild.scaleX * scale, displayChild.scaleY * scale);
      }
    });
  }

  private makeDraggableToolWindowAfterTutorial(
    window: Phaser.GameObjects.Container,
    handle: Phaser.GameObjects.Rectangle,
    windowWidth: number,
    windowHeight: number,
  ): void {
    let dragAllowed = false;
    let startX = window.x;
    let startY = window.y;
    let pointerStartX = 0;
    let pointerStartY = 0;
    this.toolWindows.push({ window, width: windowWidth, height: windowHeight });
    this.input.setDraggable(handle);
    handle.on('dragstart', (pointer: Phaser.Input.Pointer) => {
      dragAllowed = this.tutorialStep === 'inactive';
      if (!dragAllowed) return;
      startX = window.x;
      startY = window.y;
      pointerStartX = pointer.worldX;
      pointerStartY = pointer.worldY;
      this.focusToolWindow(window);
    });
    handle.on('drag', (pointer: Phaser.Input.Pointer) => {
      if (!dragAllowed || this.tutorialStep !== 'inactive') return;
      const halfWidth = windowWidth / 2;
      const halfHeight = windowHeight / 2;
      window.setPosition(
        Phaser.Math.Clamp(startX + pointer.worldX - pointerStartX, halfWidth, GAME_WIDTH - halfWidth),
        Phaser.Math.Clamp(startY + pointer.worldY - pointerStartY, halfHeight, GAME_HEIGHT - halfHeight),
      );
    });
    handle.on('dragend', () => {
      dragAllowed = false;
    });
  }

  /** 지정한 창을 맨 앞으로 올린다. 나머지는 최근에 본 순서대로 아래에 쌓인다. */
  private focusToolWindow(window: Phaser.GameObjects.Container): void {
    this.toolWindowOrder = [...this.toolWindowOrder.filter((entry) => entry !== window), window];
    this.toolWindowOrder.forEach((entry, index) => entry.setDepth(TOOL_WINDOW_BASE_DEPTH + index));
  }

  /** 두 창이 겹친 상태에서 클릭한 창을 앞으로 올린다. */
  private focusClickedToolWindow(pointer: Phaser.Input.Pointer): void {
    const clicked = [...this.toolWindows]
      .filter((entry) => entry.window.visible)
      .sort((left, right) => right.window.depth - left.window.depth)
      .find((entry) => new Phaser.Geom.Rectangle(
        entry.window.x - entry.width / 2, entry.window.y - entry.height / 2,
        entry.width, entry.height,
      ).contains(pointer.worldX, pointer.worldY));
    if (clicked) this.focusToolWindow(clicked.window);
  }

  private toggleInventory(): void {
    if (this.appraisalPopupOpen || this.itemShopVisit) return;
    this.inventoryOpen = !this.inventoryOpen;
    if (this.inventoryOpen) {
      this.focusToolWindow(this.inventoryPopup);
      this.playShopWindowBell();
    }
    else this.hoveredInventoryIndex = null;
    this.inventoryPopup.setVisible(this.inventoryOpen);
    this.render();
  }

  private renderInventory(): void {
    const canOpenInventory = this.state.phase === 'Open' && !this.appraisalPopupOpen && !this.eventPopupOpen;
    this.inventoryButton.setVisible(true).setAlpha(canOpenInventory ? 1 : 0.55);
    if (canOpenInventory) this.inventoryButton.setInteractive({ useHandCursor: true });
    else this.inventoryButton.disableInteractive();
    this.inventoryPopup.setVisible(this.inventoryOpen);
    const slots = this.inventory.slots;
    this.inventoryCells.forEach((_cell, index) => {
      const owned = slots[index];
      const frame = this.inventoryCellFrames[index]!;
      const velvet = this.inventoryCellVelvets[index]!;
      const ornament = this.inventoryCellOrnaments[index]!;
      const image = this.inventoryCellImages[index]!;
      const label = this.inventoryCellLabels[index]!;
      const quantity = this.inventoryCellQuantities[index]!;
      frame.setFillStyle(0x6b3173, 0)
        .setStrokeStyle(0, 0x000000, 0);
      velvet.setFillStyle(0x7a3781, 0);
      ornament.setAlpha(0.7);
      label.setText(owned?.item.name ?? '')
        .setColor(owned ? '#ead2a4' : '#756853');
      quantity.setVisible(Boolean(owned)).setText('x1');
      if (owned) this.showToolItemArt(image, owned.item.id, 110);
      else image.setVisible(false);
    });

    const slotText = this.inventoryPopup.getByName('inventory-slot-count') as Phaser.GameObjects.Text;
    slotText.setText(`보유 슬롯  ${this.inventory.size} / ${this.inventory.capacity}`);
    const detailIndex = this.hoveredInventoryIndex;
    const selectedOwned = detailIndex === null ? null : slots[detailIndex];
    if (this.tutorialStep !== 'inactive' || !this.inventoryOpen || !selectedOwned || detailIndex === null) {
      this.inventoryDetailPanel.setVisible(false);
      return;
    }
    const column = detailIndex % INVENTORY_CONFIG.columns;
    const row = Math.floor(detailIndex / INVENTORY_CONFIG.columns);
    this.placeTooltipBesideCell(this.inventoryDetailPanel, this.inventoryPopup, {
      x: -266 + column * 266, y: -157 + row * 174, width: 249,
    });
    this.inventoryDetailTitle.setText(selectedOwned.item.name);
    this.inventoryDetail.setText([
      `매입가:  ₩ ${selectedOwned.purchasePrice.toLocaleString('ko-KR')}`,
      `매입 시점:  ${selectedOwned.purchaseRecord ? `STAGE ${selectedOwned.purchaseRecord.stage} · DAY ${selectedOwned.purchaseRecord.day}` : '기록 없음'}`,
      this.inventoryMarketInfoLine(selectedOwned),
    ]);
    const authenticityKnown = selectedOwned.purchaseRecord?.authenticityKnown === true
      || this.hasPassedMorningSince(selectedOwned);
    this.inventoryDetailAuthenticity.setText(`진품 여부:  ${authenticityKnown ? (selectedOwned.authenticity === 'genuine' ? '진품' : '가품') : '미확인'}`)
      .setColor(!authenticityKnown ? '#a99573' : selectedOwned.authenticity === 'genuine' ? '#c26bd0' : '#d76f68');
  }

  private createSalesPopup(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const background = this.add.image(0, 0, 'sales-shell-clean')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setInteractive();
    const title = this.add.text(0, -302, '시세 확인 및 판매', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '36px', fontStyle: 'bold', color: '#d8b978',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true);
    const money = this.add.text(490, -300, '', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '21px', color: '#d8b978',
    }).setOrigin(1, 0.5).setName('sales-money');
    const children: Phaser.GameObjects.GameObject[] = [background, title, money];
    const cellWidth = 360;
    const cellHeight = 72;
    const startX = -393;
    const startY = -170;

    for (let index = 0; index < this.inventory.capacity; index += 1) {
      const frame = this.add.rectangle(0, 0, cellWidth, cellHeight, 0x4a2721, 0.94)
        .setStrokeStyle(2, 0xb78a45, 1)
        .setVisible(false);
      const image = this.add.image(-126, 0, 'item-vintage-camera')
        .setDisplaySize(62, 62)
        .setVisible(false);
      const name = this.add.text(-82, -23, '', {
        fontFamily: HUD_DISPLAY_FONT, fontSize: '18px', fontStyle: 'bold', color: '#4a321e',
        fixedWidth: 220,
      }).setOrigin(0, 0);
      const meta = this.add.text(-82, 5, '', {
        fontFamily: HUD_DISPLAY_FONT, fontSize: '15px', color: '#765338',
        fixedWidth: 225,
      }).setOrigin(0, 0);
      const separator = this.add.rectangle(12, 34, 310, 1, 0x7e6040, 0.28);
      const cell = this.add.container(startX, startY, [frame, separator, image, name, meta])
        .setSize(cellWidth, cellHeight).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectSaleItem(index));
      this.salesCells.push(cell);
      this.salesCellFrames.push(frame);
      this.salesCellImages.push(image);
      this.salesCellNames.push(name);
      this.salesCellMeta.push(meta);
      children.push(cell);
    }

    const previousPage = this.add.text(0, -3, '‹', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '30px', color: '#d7b675',
    }).setOrigin(0.5);
    this.salesPageText = this.add.text(-405, 290, '', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '18px', color: '#4e351f',
    }).setOrigin(0.5);
    const nextPage = this.add.text(0, -3, '›', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '30px', color: '#d7b675',
    }).setOrigin(0.5);

    this.salesPreviousPageButton = this.add.container(-450, 290, [previousPage])
      .setSize(44, 44).setInteractive({ useHandCursor: true })
      .on('pointerover', () => previousPage.setColor('#f2d59a'))
      .on('pointerout', () => previousPage.setColor('#d7b675'))
      .on('pointerdown', () => {
        this.salesPage = Math.max(0, this.salesPage - 1); this.renderSales();
      });
    this.salesNextPageButton = this.add.container(-360, 290, [nextPage])
      .setSize(44, 44).setInteractive({ useHandCursor: true })
      .on('pointerover', () => nextPage.setColor('#f2d59a'))
      .on('pointerout', () => nextPage.setColor('#d7b675'))
      .on('pointerdown', () => {
        this.salesPage = Math.min(1, this.salesPage + 1); this.renderSales();
      });
    this.salesEmptyText = this.add.text(-407, 25, '판매할 매입품이 없습니다.', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '22px', fontStyle: 'bold', color: '#5a3c25',
      fixedWidth: 340, align: 'center', resolution: 4,
    }).setOrigin(0.5).setVisible(false);

    this.salesPreviewImage = this.add.image(-30, -105, 'item-vintage-camera')
      .setVisible(false);
    this.salesDetail = this.add.text(125, -179, '', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '20px', fontStyle: 'bold', color: '#2f1c10',
      align: 'left', lineSpacing: 7, fixedWidth: 330, wordWrap: { width: 330 },
    }).setOrigin(0, 0);
    const detailRule = this.add.rectangle(200, 42, 720, 1, 0x76563a, 0.45);
    this.salesDetailRule = detailRule;
    this.salesChartTitle = this.add.text(-160, 62, '최근 시세', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '21px', fontStyle: 'bold', color: '#49301c',
    }).setOrigin(0, 0.5);
    // 실제 시세 이력은 최대 3일(2일 전·어제·오늘)이고, DAY에 따라 점 수가 달라진다.
    this.salesChartLabels = [0, 1, 2].map(() => this.add.text(0, 210, '', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '14px', fontStyle: 'bold', color: '#2f1c10',
      resolution: 4,
    }).setOrigin(0.5));
    this.salesChart = this.add.graphics();
    // 감정 결과·이벤트 결과와 같은 프레임을 사용해 팝업 디자인을 통일한다.
    // 프레임 원본 비율(1240x818 = 1.516)을 지켜 620x409로 그리고, 오른쪽 패널 중앙에 놓는다.
    const completeBackground = this.add.image(200, -9, 'appraisal-result-frame')
      .setDisplaySize(620, 409);
    this.salesCompleteTitle = this.add.text(200, -120, '판매 완료', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '28px', fontStyle: 'bold', color: '#e4c17d',
    }).setOrigin(0.5);
    this.salesCompleteText = this.add.text(200, 25, '', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '19px', color: '#f0dfba',
      align: 'center', lineSpacing: 10, fixedWidth: 520, wordWrap: { width: 500 },
    }).setOrigin(0.5);
    this.salesCompletePanel = this.add.container(0, 0, [
      completeBackground, this.salesCompleteTitle, this.salesCompleteText,
    ]).setVisible(false);

    const prediction = this.makeSalesAssetButton(
      -50, 285, '다음날 시세 예측', () => this.useMarketPreviewTicket(), 225,
    );
    this.marketPreviewButton = prediction.container;
    this.marketPreviewButtonLabel = prediction.label;
    const hintBackground = this.add.graphics()
      .fillStyle(0x17120e, 0.97).fillRoundedRect(-190, -40, 380, 80, 8)
      .lineStyle(2, 0xa9844d, 0.95).strokeRoundedRect(-190, -40, 380, 80, 8);
    const hintText = this.add.text(0, 0, SALES_PREVIEW_HINT, {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '16px', color: '#e2cda2',
      align: 'center', lineSpacing: 6, fixedWidth: 350, wordWrap: { width: 350 },
    }).setOrigin(0.5);
    this.marketPreviewHintText = hintText;
    this.marketPreviewHint = this.add.container(-50, 205, [hintBackground, hintText])
      .setVisible(false);
    this.marketPreviewButton
      .on('pointerover', () => this.marketPreviewHint.setVisible(this.marketPreviewButton.visible))
      .on('pointerout', () => this.marketPreviewHint.setVisible(false));
    const sale = this.makeSalesAssetButton(
      200, 285, '판매', () => this.sellSelectedItem(), 225,
    );
    this.sellButton = sale.container;
    const finish = this.makeSalesAssetButton(
      450, 285, '영업 시작', () => this.finishSalesAndOpen(), 225,
    );
    children.push(
      this.salesPreviousPageButton, this.salesPageText, this.salesNextPageButton, this.salesEmptyText,
      this.salesPreviewImage, this.salesDetail, detailRule, this.salesChartTitle, ...this.salesChartLabels, this.salesChart,
      this.salesCompletePanel, this.marketPreviewButton, this.sellButton,
      this.marketPreviewHint,
      finish.container,
    );
    this.salesPopup = this.add.container(centerX, centerY, children).setDepth(90).setVisible(false);
  }

  private selectSaleItem(index: number): void {
    const item = this.inventory.slots[index];
    this.selectedSaleId = item?.instanceId ?? null;
    this.salesMessage = item ? '' : '빈 수납칸입니다.';
    this.renderSales();
  }

  private sellSelectedItem(): void {
    if (!this.selectedSaleId) return;
    const result = sellItem(this.state, this.inventory, this.market, this.ledger, this.selectedSaleId);
    this.transactionHistory.recordSale(result.item, result.salePrice, this.holdingDays(result.item), '일반 판매');
    this.salesMessage = `판매 완료: ${result.item.item.name}\n매입 ${result.item.purchasePrice.toLocaleString('ko-KR')}원 → 판매 ${result.salePrice.toLocaleString('ko-KR')}원\n실현 손익 ${formatSignedMoney(result.profit)} · 보유 ${this.holdingDays(result.item)}일${result.item.authenticity === 'fake' ? '\n판매 결과: 가품' : ''}`;
    this.selectedSaleId = null;
    this.render();
    this.sound.play('sfx-cash-register', { volume: AUDIO_CONFIG.cashRegisterVolume });
    this.playResultEmphasis(this.salesCompleteText, feedbackKindForProfit(result.profit));
  }

  private finishSalesAndOpen(): void {
    if (this.state.phase !== 'BeforeOpen' || !this.salesOpen || this.shutterAnimating) return;
    this.salesOpen = false;
    this.selectedSaleId = null;
    this.marketPreviews.clear();
    if (this.state.canOpenShop) {
      // openingMoney는 DAY 진입 시점(아침 판매 전)의 현금이다. 여기서 판매 후 현금으로
      // 덮어쓰면 장부에는 판매 수익이 남고 실제 변동 기준만 바뀌어 마감 정산이 실패한다.
      this.state.openShop();
      this.startCustomerDay(true);
    }
    this.render();
    this.raiseShutter(() => this.presentFirstCustomerAfterShutter());
  }

  private renderSales(): void {
    // STAGE 목표 안내가 떠 있는 동안에는 판매 화면을 숨겨 팝업이 겹치지 않게 한다.
    const visible = this.state.phase === 'BeforeOpen' && this.salesOpen && !this.stageGoalOpen;
    this.salesPopup.setVisible(visible);
    if (!visible) return;
    const items = this.inventory.items;
    const slots = items;
    if (!this.selectedSaleId && items.length > 0 && !this.salesMessage.startsWith('판매 완료')) {
      this.selectedSaleId = items[0]!.instanceId;
    }
    const moneyText = this.salesPopup.getByName('sales-money') as Phaser.GameObjects.Text;
    moneyText.setText(`보유 현금  ${this.state.money.toLocaleString('ko-KR')}원`);
    const pageCount = Math.max(1, Math.ceil(items.length / 5));
    if (this.salesPage >= pageCount) this.salesPage = pageCount - 1;
    const hasMultiplePages = items.length > 5;
    this.salesPageText.setVisible(hasMultiplePages)
      .setText(hasMultiplePages ? `${this.salesPage + 1} / ${pageCount}` : '');
    this.salesPreviousPageButton.setVisible(hasMultiplePages);
    this.salesNextPageButton.setVisible(hasMultiplePages);
    this.salesEmptyText.setVisible(items.length === 0);
    this.salesCells.forEach((cell, index) => {
      const pageIndex = Math.floor(index / 5);
      const row = index % 5;
      const owned = slots[index];
      cell.setVisible(pageIndex === this.salesPage && owned !== undefined)
        .setPosition(-407, -170 + row * 82);
      if (pageIndex !== this.salesPage) return;
      const frame = this.salesCellFrames[index]!;
      const image = this.salesCellImages[index]!;
      const name = this.salesCellNames[index]!;
      const meta = this.salesCellMeta[index]!;
      if (!owned) {
        frame.setVisible(false);
        image.setVisible(false);
        name.setText('');
        meta.setText('');
        return;
      }
      const selected = owned.instanceId === this.selectedSaleId;
      const trend = owned.authenticity === 'fake'
        ? '가품 · 고정가' : trendLabel(this.market.trend(owned.item.category));
      const trendColor = owned.authenticity === 'fake' ? '#cf8f8f'
        : this.market.trend(owned.item.category) === 'up' ? '#8fd3a6'
          : this.market.trend(owned.item.category) === 'down' ? '#e08a82' : '#d4c39b';
      frame.setVisible(selected);
      this.showItemArt(image, owned.item.id, 62);
      name.setPosition(-82, -23).setText(owned.item.name)
        .setColor(selected ? '#e3c58e' : '#4a321e');
      meta.setText(
        `₩ ${this.market.salePrice(owned.item, owned.authenticity).toLocaleString('ko-KR')}   ${trend}`,
      ).setColor(selected ? trendColor : '#765338');
    });

    const selected = items.find((item) => item.instanceId === this.selectedSaleId);
    this.sellButton.setVisible(selected !== undefined);
    const showPreviewButton = selected !== undefined;
    this.marketPreviewButton.setVisible(showPreviewButton);
    if (!showPreviewButton) this.marketPreviewHint.setVisible(false);
    if (showPreviewButton) {
      const hasTicket = this.specialItems.marketPreviewTicketCount > 0;
      const isFake = selected.authenticity === 'fake';
      const isFinalDay = this.state.day >= this.state.daysPerStage;
      const previewCompleted = this.marketPreviews.has(selected.instanceId);
      const canPreview = hasTicket && !isFake && !isFinalDay && !previewCompleted;
      // 비활성 상태에서도 호버 안내를 띄워야 해서 interactive는 유지한다.
      // 실제 사용은 useMarketPreviewTicket()이 보유 수량으로 막는다.
      // 컨테이너 알파는 자식에게 곱해지므로 라벨에는 따로 걸지 않는다.
      this.marketPreviewButtonLabel.setText(previewCompleted ? '예측 완료' : '다음날 시세 예측').setAlpha(1);
      this.marketPreviewHintText.setText(
        previewCompleted ? COMPLETED_SALES_PREVIEW_HINT
          : isFinalDay ? FINAL_DAY_SALES_PREVIEW_HINT
            : isFake ? FAKE_SALES_PREVIEW_HINT : SALES_PREVIEW_HINT,
      );
      this.marketPreviewButton.setAlpha(canPreview ? 1 : isFake || isFinalDay || previewCompleted ? 0.42 : 0.6)
        .setInteractive({ useHandCursor: canPreview });
    }
    if (!selected) {
      const completed = this.salesMessage.startsWith('판매 완료');
      this.salesCompletePanel.setVisible(completed);
      if (completed) {
        this.salesCompleteText.setText(this.salesMessage
          .replace(/^판매 완료:\s*/, '')
          .replace(/\n판매 결과: 가품$/, ' · 가품'));
      }
      this.salesDetail.setText(items.length === 0 || completed ? '' : this.salesMessage);
      this.salesPreviewImage.setVisible(false);
      this.salesDetailRule.setVisible(false);
      this.salesChart.clear();
      this.salesChartTitle.setVisible(false);
      this.salesChartLabels.forEach((label) => label.setVisible(false));
      return;
    }
    this.salesCompletePanel.setVisible(false);
    this.salesDetailRule.setVisible(true);
    const salePrice = this.market.salePrice(selected.item, selected.authenticity);
    const profit = salePrice - selected.purchasePrice;
    const preview = this.marketPreviews.get(selected.instanceId);
    this.showItemArt(this.salesPreviewImage, selected.item.id, 190);
    this.salesChartTitle.setVisible(true);
    this.salesDetail.setText([
      selected.item.name,
      '',
      '현재 판매가',
      `₩ ${salePrice.toLocaleString('ko-KR')}`,
      `${formatSignedMoney(profit)}  ·  ${selected.authenticity === 'fake' ? '가품' : trendLabel(this.market.trend(selected.item.category))}`,
      ...(preview === undefined ? [] : [
        `내일 예상  ₩ ${preview.toLocaleString('ko-KR')}`,
      ]),
    ]);
    this.renderSalesChart(selected.item, selected.authenticity, salePrice);
  }

  private renderSalesChart(item: ItemSeed, authenticity: 'genuine' | 'fake', current: number): void {
    const graphics = this.salesChart;
    graphics.clear();
    const left = -140;
    const right = 540;
    const top = 92;
    const bottom = 192;
    graphics.lineStyle(1, 0x765c3f, 0.35);
    for (let row = 0; row < 4; row += 1) {
      const y = top + row * ((bottom - top) / 3);
      graphics.lineBetween(left, y, right, y);
    }
    const prices = this.market.recentSalePrices(item, authenticity);
    const min = Math.min(...prices) * 0.92;
    const max = Math.max(...prices) * 1.08;
    const range = Math.max(1, max - min);
    const plotLeft = left + 40;
    const plotRight = right - 40;
    const step = prices.length > 1 ? (plotRight - plotLeft) / (prices.length - 1) : 0;
    const points = prices.map((price, index) => ({
      x: prices.length > 1 ? plotLeft + step * index : (plotLeft + plotRight) / 2,
      y: bottom - ((price - min) / range) * (bottom - top),
    }));
    // 라벨은 오른쪽이 오늘이다. 이력이 짧으면 그만큼만 보여 준다.
    const dayLabels = ['2일 전', '어제', '오늘'].slice(-prices.length);
    this.salesChartLabels.forEach((label, index) => {
      const point = points[index];
      if (!point) {
        label.setVisible(false);
        return;
      }
      label.setPosition(point.x, bottom + 18).setText(dayLabels[index] ?? '').setVisible(true);
    });
    const rising = current >= prices[0]!;
    const color = rising ? 0x5f7f4d : 0x9e3f31;
    graphics.lineStyle(3, color, 1);
    points.forEach((point, index) => {
      const previous = points[index - 1];
      if (previous) graphics.lineBetween(previous.x, previous.y, point.x, point.y);
    });
    points.forEach((point, index) => {
      const isToday = index === points.length - 1;
      graphics.fillStyle(isToday ? color : 0xc7954f, 1).fillCircle(point.x, point.y, isToday ? 7 : 6);
    });
  }

  private useMarketPreviewTicket(): void {
    if (this.state.day >= this.state.daysPerStage
      || this.specialItems.marketPreviewTicketCount <= 0 || !this.selectedSaleId) return;
    const selected = this.inventory.items.find((item) => item.instanceId === this.selectedSaleId);
    if (!selected || selected.authenticity === 'fake'
      || this.marketPreviews.has(selected.instanceId)) return;
    this.specialItems.useMarketPreviewTicket();
    const nextDaySalePrice = this.market.nextDaySalePrice(selected.item, selected.authenticity);
    this.marketPreviews.set(selected.instanceId, nextDaySalePrice);
    this.inventory.recordMarketCheck(selected.instanceId, {
      stage: this.state.stage, day: this.state.day, nextDaySalePrice,
    });
    this.transactionHistory.recordMarketCheck(selected.instanceId, {
      stage: this.state.stage, day: this.state.day, nextDaySalePrice,
    });
    this.render();
  }

  private useTimeExtensionItem(): void {
    if (this.specialItems.timeExtensionItemCount <= 0 || this.state.phase !== 'Open') return;
    this.specialItems.useTimeExtensionItem();
    this.state.addRemainingTime(ITEM_SHOP_CONFIG.timeExtensionSeconds);
    this.specialItemPopupOpen = false;
    this.render();
  }

  private createDayEndUi(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    this.shutterBacking = this.add.rectangle(
      centerX, centerY, GAME_WIDTH, GAME_HEIGHT, 0x070605,
    ).setDepth(49).setInteractive();
    this.shutter = this.add.image(centerX, centerY, 'roll-shutter')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(50)
      .setInteractive();
    this.gameTitleLogo = this.add.image(
      centerX,
      centerY + SHUTTER_LAYOUT.titleLogoOffsetY,
      'game-title-logo',
    )
      .setScale(SHUTTER_LAYOUT.titleLogoWidth / this.textures.get('game-title-logo').getSourceImage().width)
      .setDepth(59);
    this.gameStartButton = this.add.image(
      centerX,
      centerY + SHUTTER_LAYOUT.gameStartButtonOffsetY,
      'button-game-start',
    )
      .setScale(SHUTTER_LAYOUT.gameStartButtonWidth / this.textures.get('button-game-start').getSourceImage().width)
      .setDepth(60)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.gameStartButton.setTint(0xffe2a8))
      .on('pointerout', () => this.gameStartButton.clearTint())
      .on('pointerdown', () => this.startGameFromShutter());

    const paper = this.add.image(0, 0, 'statement-base')
      .setDisplaySize(500, 625)
      .setInteractive();
    const title = this.add.text(0, -213, '정산서', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '32px', fontStyle: 'bold', color: '#211509',
    }).setOrigin(0.5).setShadow(0, 1, '#d8bb8c', 2, false, true);
    this.statementDayText = this.add.text(0, -174, '', {
      fontFamily: UI_DISPLAY_FONT,
      fontSize: `${STATEMENT_SUBTITLE.baseFontSize}px`,
      fontStyle: 'bold',
      color: '#3b2c1d',
    }).setOrigin(0.5);
    const sectionPlaque = this.add.image(0, -134, 'statement-section-plaque')
      .setDisplaySize(390, 130);
    const sectionTitle = this.add.text(0, -134, '거래 내역', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '17px', fontStyle: 'bold', color: '#f6e6c4',
    }).setOrigin(0.5).setShadow(0, 1, '#100a05', 3, false, true);
    this.statementLabelsText = this.add.text(-166, -104, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '14px', fontStyle: 'bold', color: '#22170e',
      lineSpacing: 1,
    }).setOrigin(0, 0);
    this.statementValuesText = this.add.text(166, -104, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '14px', fontStyle: 'bold', color: '#22170e',
      align: 'right', lineSpacing: 1,
    }).setOrigin(1, 0);
    const totalFrame = this.add.image(0, 140, 'statement-total-frame').setDisplaySize(380, 126);
    const totalLabel = this.add.text(-145, 140, '마감 현금', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '20px', fontStyle: 'bold', color: '#340f26',
    }).setOrigin(0, 0.5);
    this.statementTotalText = this.add.text(90, 140, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '26px', fontStyle: 'bold', color: '#340f26',
    }).setOrigin(1, 0.5);
    this.statementStamp = this.add.image(158, 167, 'statement-stamp')
      .setDisplaySize(84, 84)
      .setAngle(8)
      .setVisible(false);
    const nextBackground = this.add.image(0, 0, 'statement-next-button').setDisplaySize(245, 105);
    const nextLabel = this.add.text(0, 0, '다음 DAY', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '22px', fontStyle: 'bold', color: '#fbeecd',
    }).setOrigin(0.5).setShadow(0, 1, '#160d06', 3, false, true);
    const nextDay = this.add.container(0, 227, [nextBackground, nextLabel])
      .setSize(245, 82)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => nextBackground.setTint(0xffdfaa))
      .on('pointerout', () => nextBackground.clearTint())
      .on('pointerdown', () => this.advanceFromStatement());
    this.statementPopup = this.add.container(centerX, centerY, [
      paper, title, this.statementDayText, sectionPlaque, sectionTitle,
      this.statementLabelsText, this.statementValuesText, totalFrame, totalLabel,
      this.statementTotalText, this.statementStamp, nextDay,
    ])
      .setDepth(100).setVisible(false);
  }

  private startGameFromShutter(): void {
    if (this.gameStarted || this.shutterAnimating) return;
    this.gameStarted = true;
    this.startBackgroundMusic();
    this.gameTitleLogo.setVisible(false);
    this.gameStartButton.disableInteractive().setVisible(false);
    if (this.state.canOpenShop && !this.salesOpen) {
      // DAY 시작 기준 현금은 create/전환 시 이미 설정되어 있으며 DEV 지급금은
      // devCashAdjustment로 별도 추적한다. 영업 시작 시 기준을 다시 잡지 않는다.
      this.state.openShop();
      this.startCustomerDay(true);
    }
    this.raiseShutter(() => this.presentFirstCustomerAfterShutter());
  }

  private raiseShutter(afterOpen?: () => void): void {
    if (this.shutterAnimating) return;
    this.shutterAnimating = true;
    this.playEventSound('sfx-shutter');
    this.shutterBacking
      .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setVisible(true);
    this.shutter.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2).setVisible(true);
    this.tweens.add({
      targets: [this.shutterBacking, this.shutter],
      y: -GAME_HEIGHT / 2,
      duration: DAY_TRANSITION_CONFIG.shutterDurationMilliseconds,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.shutterBacking.setVisible(false);
        this.shutter.setVisible(false);
        this.shutterAnimating = false;
        afterOpen?.();
        this.render();
      },
    });
  }

  private createItemShopPopup(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const detailCenterX = 400;
    const blocker = this.add.rectangle(0, 0, 1280, 720, 0x080706, 1).setInteractive();
    const ledger = this.add.image(-230, 0, 'item-shop-ledger').setDisplaySize(780, 439);
    const detailSheet = this.add.image(detailCenterX, 5, 'item-shop-detail-sheet')
      .setDisplaySize(380, 520);
    const shell = this.add.image(0, 0, 'item-shop-shell').setDisplaySize(1280, 720);
    this.itemShopStageDayText = this.add.text(-555, -299, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '21px', color: '#f0cf8a', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
    const title = this.add.text(0, -298, '아이템 상점', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '42px', color: '#f0d18c',
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 5, true, true).setResolution(4);
    this.itemShopMoneyText = this.add.text(422, -299, '', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '20px', color: '#f0cf8a', fontStyle: 'bold',
      fixedWidth: 220, align: 'right',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
    const children: Phaser.GameObjects.GameObject[] = [
      blocker, shell, ledger, detailSheet, this.itemShopStageDayText, title, this.itemShopMoneyText,
    ];
    const productCenters = [
      { x: -379, y: -88 }, { x: -81, y: -88 },
      { x: -379, y: 88 }, { x: -81, y: 88 },
    ] as const;
    ITEM_SHOP_PRODUCT_ORDER.forEach((key, index) => {
      const spec = this.itemShopProductSpec(key);
      const position = productCenters[index]!;
      const selectedFrame = this.add.rectangle(0, 0, 292, 170, 0x6b3f61, 0.09)
        .setStrokeStyle(3, 0x9a6b32, 0.92)
        .setVisible(false);
      const image = this.add.image(0, -43, spec.texture);
      image.setScale(Math.min(78 / image.width, 78 / image.height));
      const name = this.add.text(0, 12, spec.name, {
        fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '22px', color: '#382015',
        fixedWidth: 258, align: 'center', fontStyle: 'bold',
      }).setOrigin(0.5).setShadow(0, 1, '#fff1cf', 2, true, true).setResolution(4);
      const owned = this.add.text(0, 38, '', {
        fontFamily: HUD_DISPLAY_FONT, fontSize: '16px', color: '#5a351f', fontStyle: 'bold',
        fixedWidth: 258, align: 'center',
      }).setOrigin(0.5).setResolution(4);
      const price = this.add.text(0, 64, `${spec.price.toLocaleString('ko-KR')}원`, {
        fontFamily: HUD_DISPLAY_FONT, fontSize: '19px', color: '#51301d', fontStyle: 'bold',
        fixedWidth: 258, align: 'center',
      }).setOrigin(0.5).setResolution(4);
      const card = this.add.container(position.x, position.y, [selectedFrame, image, name, owned, price])
        .setSize(292, 170).setInteractive({ useHandCursor: true })
        .on('pointerover', () => selectedFrame.setAlpha(0.62).setVisible(true))
        .on('pointerout', () => this.renderItemShop())
        .on('pointerdown', () => {
          this.selectedItemShopProduct = key;
          this.renderItemShop();
        });
      this.itemShopProductFrames.set(key, selectedFrame);
      this.itemShopProductNameTexts.set(key, name);
      this.itemShopProductOwnedTexts.set(key, owned);
      this.itemShopProductPriceTexts.set(key, price);
      children.push(card);
    });

    this.itemShopDetailTitle = this.add.text(detailCenterX, -160, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '34px', color: '#4a211b',
      fixedWidth: 280, align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(4);
    const detailDivider = this.add.rectangle(detailCenterX, -127, 220, 1, 0x76512c, 0.75);
    this.itemShopDetailImage = this.add.image(detailCenterX, -38, 'special-item-appraisal')
      .setDisplaySize(145, 145);
    this.itemShopDetailDescription = this.add.text(detailCenterX, 68, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '17px', color: '#3d281e', fontStyle: 'bold',
      fixedWidth: 250, align: 'center', wordWrap: { width: 250 }, lineSpacing: 5,
    }).setOrigin(0.5).setResolution(4);
    this.itemShopDetailPrice = this.add.text(detailCenterX, 130, '', {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '25px', color: '#4b291b',
      fixedWidth: 280, align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(4);
    this.itemShopPurchaseBackground = this.add.image(0, 0, 'item-shop-purchase-button')
      .setDisplaySize(190, 50);
    this.itemShopPurchaseLabel = this.add.text(0, 0, '구매', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '20px', color: '#ead29d', fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(4);
    this.itemShopPurchaseButton = this.add.container(
      detailCenterX, 178, [this.itemShopPurchaseBackground, this.itemShopPurchaseLabel],
    ).setSize(190, 50).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.itemShopPurchaseBackground.setTint(0xffd4ee))
      .on('pointerout', () => this.itemShopPurchaseBackground.clearTint())
      .on('pointerdown', () => this.buySelectedItemShopProduct());
    const footer = this.add.text(0, 315, '—  아이템은 다음 영업일부터 사용할 수 있습니다.  —', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '18px', color: '#efd08b', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true).setResolution(4);
    children.push(
      this.itemShopDetailTitle, detailDivider, this.itemShopDetailImage,
      this.itemShopDetailDescription, this.itemShopDetailPrice, this.itemShopPurchaseButton,
      footer,
    );
    this.itemShopPopup = this.add.container(centerX, centerY, children).setDepth(125).setVisible(false);
    this.itemShopCloseButton = this.add.image(
      centerX + 565, centerY - 299, 'item-shop-close-button',
    ).setDisplaySize(58, 58).setDepth(126).setVisible(false);
    this.itemShopCloseHitArea = this.add.rectangle(
      centerX + 565, centerY - 299, 72, 72, 0x000000, 0.001,
    ).setDepth(127).setVisible(false).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.itemShopCloseButton.setTint(0xffdca0))
      .on('pointerout', () => this.itemShopCloseButton.clearTint())
      .on('pointerdown', () => this.finishItemShop());
  }

  /**
   * 매입 다음 날 아침 '시세 확인 및 판매'를 거치면 그 물건의 시세와 진품 여부가 드러난다.
   * 매입 당일에는 알 수 없다.
   */
  private hasPassedMorningSince(owned: OwnedItem): boolean {
    return owned.purchaseRecord !== undefined && this.holdingDays(owned) >= 1;
  }

  /** 매입품 상세의 시세 정보 한 줄. 수첩으로 미리 본 다음 DAY 가격이 있으면 그쪽을 우선한다. */
  private inventoryMarketInfoLine(owned: OwnedItem): string {
    const marketCheck = owned.purchaseRecord?.marketCheck;
    if (marketCheck) {
      return `시세 정보:  내일 예상 ₩ ${marketCheck.nextDaySalePrice.toLocaleString('ko-KR')}`;
    }
    if (!this.hasPassedMorningSince(owned)) return '시세 정보:  미확인';
    const price = this.market.salePrice(owned.item, owned.authenticity).toLocaleString('ko-KR');
    const note = owned.authenticity === 'fake'
      ? '가품 고정가' : trendLabel(this.market.trend(owned.item.category));
    return `시세 정보:  ₩ ${price} · ${note}`;
  }

  private holdingDays(item: { purchaseRecord?: { stage: number; day: number } }): number {
    if (!item.purchaseRecord) return 0;
    return calculateHoldingDays(
      item.purchaseRecord,
      { stage: this.state.stage, day: this.state.day },
      this.state.daysPerStage,
    );
  }

  private itemShopProductSpec(key: ItemShopProductKey): {
    name: string; description: string; texture: string; price: number;
  } {
    const specs = {
      appraisal: { ...SPECIAL_ITEM_PRESENTATION.appraisal, price: ITEM_SHOP_CONFIG.appraisalTicketPrice },
      market: { ...SPECIAL_ITEM_PRESENTATION.market, price: ITEM_SHOP_CONFIG.marketPreviewTicketPrice },
      time: { ...SPECIAL_ITEM_PRESENTATION.time, price: ITEM_SHOP_CONFIG.timeExtensionItemPrice },
      defense: { ...SPECIAL_ITEM_PRESENTATION.defense, price: ITEM_SHOP_CONFIG.defenseItemPrice },
    } satisfies Record<ItemShopProductKey, { name: string; description: string; texture: string; price: number }>;
    return specs[key];
  }

  private itemShopOwnedCount(key: ItemShopProductKey): number {
    if (key === 'appraisal') return this.specialItems.appraisalTicketCount;
    if (key === 'market') return this.specialItems.marketPreviewTicketCount;
    if (key === 'time') return this.specialItems.timeExtensionItemCount;
    return this.specialItems.defenseItemCount;
  }

  private itemShopRemainingStock(key: ItemShopProductKey): number {
    if (!this.itemShopVisit) return 0;
    if (key === 'appraisal') return this.itemShopVisit.remainingStock;
    if (key === 'market') return this.itemShopVisit.remainingMarketPreviewStock;
    if (key === 'time') return this.itemShopVisit.remainingTimeExtensionStock;
    return this.itemShopVisit.remainingDefenseStock;
  }

  private buySelectedItemShopProduct(): void {
    if (this.selectedItemShopProduct === 'appraisal') this.buyAppraisalTicket();
    else if (this.selectedItemShopProduct === 'market') this.buyMarketPreviewTicket();
    else if (this.selectedItemShopProduct === 'time') this.buyTimeExtensionItem();
    else this.buyDefenseItem();
  }

  private buyAppraisalTicket(): void {
    if (!this.itemShopVisit) return;
    try {
      this.itemShopVisit.buyAppraisalTicket(this.state, this.specialItems, this.ledger);
      this.closingMoney = this.state.money;
      this.render();
    } catch { /* 구매 버튼의 비활성 상태로만 실패를 표시한다. */ }
  }

  private buyMarketPreviewTicket(): void {
    if (!this.itemShopVisit) return;
    try {
      this.itemShopVisit.buyMarketPreviewTicket(this.state, this.specialItems, this.ledger);
      this.closingMoney = this.state.money;
      this.render();
    } catch { /* 구매 버튼의 비활성 상태로만 실패를 표시한다. */ }
  }

  private buyDefenseItem(): void {
    if (!this.itemShopVisit) return;
    try {
      this.itemShopVisit.buyDefenseItem(this.state, this.specialItems, this.ledger);
      this.closingMoney = this.state.money;
      this.render();
    } catch { /* 구매 버튼의 비활성 상태로만 실패를 표시한다. */ }
  }

  private buyTimeExtensionItem(): void {
    if (!this.itemShopVisit) return;
    try {
      this.itemShopVisit.buyTimeExtensionItem(this.state, this.specialItems, this.ledger);
      this.closingMoney = this.state.money;
      this.render();
    } catch { /* 구매 버튼의 비활성 상태로만 실패를 표시한다. */ }
  }

  private finishItemShop(): void {
    if (!this.itemShopVisit) return;
    this.itemShopVisit = null;
    this.closingMoney = this.state.money;
    if (this.state.isStageFinished) {
      const rentResult = this.state.settleRent(this.stageRealizedProfit);
      if (rentResult.success) this.ledger.recordRent(rentResult.rent);
      this.closingMoney = this.state.money;
    } else {
      this.statementReady = true;
    }
    this.render();
  }

  private renderItemShop(): void {
    const visible = this.itemShopVisit !== null;
    // DEV 패널은 우측 상단 버튼과 겹칠 수 있으므로 상점 이용 중에는 입력·표시를 끈다.
    if (import.meta.env.DEV && visible) this.devPanel.setVisible(false);
    this.itemShopPopup.setDepth(125).setVisible(visible);
    this.itemShopCloseButton.setVisible(visible);
    this.itemShopCloseHitArea.setVisible(visible);
    if (!visible) return;
    this.itemShopStageDayText.setText(`STAGE ${this.state.stage} · DAY ${this.state.day} 종료`);
    this.itemShopMoneyText.setText(`보유 현금 ${this.state.money.toLocaleString('ko-KR')}원`);
    ITEM_SHOP_PRODUCT_ORDER.forEach((key) => {
      const selected = key === this.selectedItemShopProduct;
      this.itemShopProductFrames.get(key)?.setVisible(selected).setAlpha(selected ? 1 : 0);
      this.itemShopProductNameTexts.get(key)?.setColor('#49311f');
      this.itemShopProductOwnedTexts.get(key)
        ?.setText(`보유 ×${this.itemShopOwnedCount(key)}`)
        .setColor('#735333');
      this.itemShopProductPriceTexts.get(key)?.setColor('#6e4925');
    });
    const spec = this.itemShopProductSpec(this.selectedItemShopProduct);
    const remaining = this.itemShopRemainingStock(this.selectedItemShopProduct);
    const insufficient = this.state.money < spec.price;
    this.itemShopDetailTitle.setText(spec.name);
    this.itemShopDetailDescription
      .setFontSize(spec.description.length > 34 ? 16 : 17)
      .setText(spec.description);
    this.itemShopDetailImage.setTexture(spec.texture);
    this.itemShopDetailImage.setScale(Math.min(
      150 / this.itemShopDetailImage.width,
      150 / this.itemShopDetailImage.height,
    ));
    this.itemShopDetailPrice.setText(`가격  ${spec.price.toLocaleString('ko-KR')}원`);
    this.itemShopPurchaseLabel.setText(
      remaining <= 0 ? '구매 완료' : '구매',
    );
    const canPurchase = remaining > 0 && !insufficient;
    this.itemShopPurchaseButton.setAlpha(canPurchase ? 1 : 0.42);
    this.itemShopPurchaseBackground.clearTint();
    if (canPurchase) this.itemShopPurchaseButton.setInteractive({ useHandCursor: true });
    else this.itemShopPurchaseButton.disableInteractive();
  }

  private createResultPopupBlockers(): Phaser.GameObjects.Rectangle[] {
    const leftMenuWidth = 112;
    const dimmedWidth = GAME_WIDTH - leftMenuWidth;
    const dimmer = this.add.rectangle(
      leftMenuWidth / 2,
      0,
      dimmedWidth,
      GAME_HEIGHT,
      0x050403,
      0.34,
    ).setInteractive();
    const leftMenuInputShield = this.add.rectangle(
      -GAME_WIDTH / 2 + leftMenuWidth / 2,
      0,
      leftMenuWidth,
      GAME_HEIGHT,
      0x000000,
      0,
    ).setInteractive();
    return [dimmer, leftMenuInputShield];
  }

  /**
   * STAGE 시작 전 목표 안내. 감정 결과 팝업과 같은 프레임을 써서 분위기를 맞춘다.
   * STAGE 1은 튜토리얼 마지막 '영업 시작' 뒤, STAGE 2는 STAGE 진입 직후에 띄운다.
   */
  private createStageGoalPopup(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const blockers = this.createResultPopupBlockers();
    const frame = this.add.image(0, 0, 'appraisal-result-frame').setScale(0.5);
    this.stageGoalTitle = this.add.text(0, -112, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '30px', color: '#e4c17d', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true);
    this.stageGoalText = this.add.text(0, 12, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '18px', color: '#ecd9b0',
      align: 'center', lineSpacing: 7, fixedWidth: 520, wordWrap: { width: 490 },
    }).setOrigin(0.5);
    const confirmBackground = this.add.image(0, 0, 'appraisal-result-confirm').setScale(160 / 340);
    const confirmLabel = this.add.text(0, 0, '확인', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '21px', color: '#dfc48c', fontStyle: 'bold',
    }).setOrigin(0.5);
    const confirmButton = this.add.container(0, 137, [confirmBackground, confirmLabel])
      .setSize(160, 72).setInteractive({ useHandCursor: true })
      .on('pointerover', () => confirmBackground.setTint(0xffdfad))
      .on('pointerout', () => confirmBackground.clearTint())
      .on('pointerdown', () => this.closeStageGoal());
    this.stageGoalPopup = this.add.container(centerX, centerY, [
      ...blockers, frame, this.stageGoalTitle, this.stageGoalText, confirmButton,
    ]).setDepth(210).setVisible(false);
  }

  /** STAGE 목표 안내의 마지막 한 줄. 채워야 하는 조건과 통과 뒤 갈 곳을 함께 알린다. */
  private stageGoalFooter(hasProfitGoal: boolean, isFinalStage: boolean): string {
    const requirement = hasProfitGoal ? '월세를 내고 목표 손익까지 채우면' : '마지막 DAY까지 월세를 마련하면';
    return isFinalStage ? `${requirement} 데모를 완주한다.` : `${requirement} 다음 STAGE로 간다.`;
  }

  /** STAGE 목표 안내를 띄운다. 확인을 누를 때까지 시간과 손님이 멈춘다. */
  private openStageGoal(): void {
    const stage = this.state.stage;
    const rent = this.state.rentDue;
    const goal = this.state.profitGoalDue;
    this.stageGoalTitle.setText(`STAGE ${stage} 목표`);
    const lines = [
      goal > 0
        ? `DAY 1 ~ ${this.state.daysPerStage} 동안 실현 손익 ${goal.toLocaleString('ko-KR')}원 이상`
        : `DAY 1 ~ ${this.state.daysPerStage} 동안 월세 ${rent.toLocaleString('ko-KR')}원 마련`,
      '',
      // 보유 현금은 넣지 않는다. 목표 항목과 나란히 놓이면 그 금액까지 모아야 하는 것으로 읽힌다.
      `납부할 월세      ${rent.toLocaleString('ko-KR')}원`,
      ...(goal > 0 ? [`목표 실현 손익    ${goal.toLocaleString('ko-KR')}원`] : []),
      '',
      // 마지막 STAGE는 통과해도 다음 STAGE가 없다. 목표 유무와 최종 STAGE 여부를 따로 본다.
      this.stageGoalFooter(goal > 0, this.state.isFinalDemoStage),
    ];
    this.stageGoalText.setText(lines);
    this.stageGoalOpen = true;
    this.stageGoalPopup.setVisible(true);
    this.render();
  }

  private closeStageGoal(): void {
    if (!this.stageGoalOpen) return;
    this.stageGoalOpen = false;
    this.stageGoalPopup.setVisible(false);
    if (this.state.phase === 'BeforeOpen' && this.salesOpen) this.playShopWindowBell();
    this.presentNextCustomerIfReady();
    this.render();
  }

  private createAppraisalPopup(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const blockers = this.createResultPopupBlockers();
    this.appraisalResultFrame = this.add.image(0, 0, 'appraisal-result-frame').setDisplaySize(500, 330);
    const title = this.add.text(0, -93, '감정 결과', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '26px', color: '#ddc28e', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.appraisalResultText = this.add.text(0, -8, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '48px', fontStyle: 'bold', color: '#f1d38e',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 5, true, true);
    const confirmBackground = this.add.image(0, 0, 'appraisal-result-confirm').setDisplaySize(142, 58);
    const confirmLabel = this.add.text(0, 0, '확인', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '20px', color: '#dfc48c', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.appraisalConfirmButton = this.add.container(0, 108, [confirmBackground, confirmLabel])
      .setSize(142, 58).setInteractive({ useHandCursor: true })
      .on('pointerover', () => confirmBackground.setTint(0xffdfad))
      .on('pointerout', () => confirmBackground.clearTint())
      .on('pointerdown', () => this.closeAppraisalPopup());
    this.appraisalPopup = this.add.container(
      centerX, centerY, [
        ...blockers, this.appraisalResultFrame, title, this.appraisalResultText, this.appraisalConfirmButton,
      ],
    ).setDepth(150).setVisible(false);
  }

  private useAppraisalTicket(): void {
    if (!this.trade.canAppraise || this.appraisalPopupOpen
      || this.specialItems.appraisalTicketCount <= 0) return;
    const result = this.trade.appraise(this.specialItems);
    this.appraisalResultText.setText(result === 'genuine' ? '진품' : '가품');
    this.appraisalPopupOpen = true;
    this.appraisalPopup.setVisible(true);
    if (this.tutorialStep === 'chooseAppraisal') this.tutorialStep = 'confirmAppraisal';
    this.render();
    this.playResultEmphasis(this.appraisalResultText, result === 'genuine' ? 'genuine' : 'fake');
  }

  private closeAppraisalPopup(): void {
    if (!this.appraisalPopupOpen) return;
    if (this.tutorialStep !== 'inactive' && this.tutorialStep !== 'confirmAppraisal') return;
    this.appraisalPopupOpen = false;
    this.appraisalPopup.setVisible(false);
    if (this.tutorialStep === 'confirmAppraisal') {
      this.tutorialStep = 'firstLowInput';
      this.typedOffer = String(this.trade.customer?.initialAskingPrice ?? 0);
      this.replaceOfferOnNextDigit = true;
    }
    this.render();
  }

  private activateDefense(): void {
    if (this.state.phase !== 'Open' || this.defenseActive
      || this.specialItems.defenseItemCount <= 0) return;
    this.specialItems.useDefenseItem();
    this.defenseActive = true;
    this.specialItemPopupOpen = false;
    this.render();
  }

  private createEventPopup(): void {
    const blockers = this.createResultPopupBlockers();
    this.eventResultFrame = this.add.image(0, 0, 'appraisal-result-frame').setDisplaySize(500, 330);
    this.eventTitle = this.add.text(0, -93, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '26px', color: '#ddc28e', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.eventText = this.add.text(0, -3, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '19px', color: '#eee1ca', align: 'center',
      lineSpacing: 12, fixedWidth: 390, wordWrap: { width: 390 },
    }).setOrigin(0.5);
    const confirmBackground = this.add.image(0, 0, 'appraisal-result-confirm').setDisplaySize(142, 58);
    const confirmLabel = this.add.text(0, 0, '확인', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '20px', color: '#dfc48c', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.eventConfirmButton = this.add.container(0, 108, [confirmBackground, confirmLabel])
      .setSize(142, 58).setInteractive({ useHandCursor: true })
      .on('pointerover', () => confirmBackground.setTint(0xffdfad))
      .on('pointerout', () => confirmBackground.clearTint())
      .on('pointerdown', () => this.closeEventPopup());
    this.eventPopup = this.add.container(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      [...blockers, this.eventResultFrame, this.eventTitle, this.eventText, this.eventConfirmButton],
    ).setDepth(160).setVisible(false);
  }

  private showEvent(title: string, message: string): void {
    this.eventTitle.setText(title);
    this.eventText.setText(message);
    this.eventPopupOpen = true;
    this.eventPopup.setVisible(true);
    this.render();
  }

  private playResultEmphasis(
    target: Phaser.GameObjects.Text,
    kind: ResultFeedbackKind,
  ): void {
    this.tweens.killTweensOf(target);
    target.setColor(feedbackColor(kind)).setScale(1);
    this.tweens.add({
      targets: target,
      scale: RESULT_FEEDBACK_CONFIG.pulseScale,
      duration: RESULT_FEEDBACK_CONFIG.pulseDurationMs,
      yoyo: true,
      ease: 'Sine.Out',
    });
  }

  private closeEventPopup(): void {
    if (!this.eventPopupOpen) return;
    this.eventPopupOpen = false;
    this.eventPopup.setVisible(false);
    if (this.tutorialStep === 'attackResult') {
      const attackedCustomerName = this.trade.customer?.name;
      this.tutorialTrustSnapshot = attackedCustomerName
        ? this.customerProfiles.profile(attackedCustomerName).trust
        : CUSTOMER_CONFIG.startingTrust;
      this.tutorialStep = 'trustIntro';
      this.completeResolvedCustomerExit();
      return;
    }
    if (this.trade.outcome === 'inventoryFull') this.resetCustomerSpeech();
    this.render();
    if (this.trade.status === 'Resolved') this.scheduleCustomerExit();
  }

  private createMerchantPopup(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const dimmer = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
      .setInteractive();
    // 새 배경은 기존 1280×720을 축소하지 않고 실제 표시 크기인 1024×576으로 제작했다.
    const background = this.add.image(0, 0, 'merchant-background').setInteractive();
    const speechBubble = this.add.image(-245, 130, 'merchant-speech-bubble').setDisplaySize(188, 126);
    this.merchantSpeechText = this.add.text(
      -245, 149, MERCHANT_INTRO_SPEECH,
      {
        fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '12px', fontStyle: 'bold', color: '#f0ddb6',
        lineSpacing: 5, fixedWidth: 170, align: 'center', resolution: 6,
      },
    ).setOrigin(0.5).setShadow(0, 2, '#080503', 3, true, true);
    const overlayChildren: Phaser.GameObjects.GameObject[] = [];
    // background-clean-v11.webp의 1024×576 원본 픽셀 좌표를 팝업 중심 기준으로 사용한다.
    const cardCentersX = [-95, 28, 152, 277, 402] as const;

    for (let index = 0; index < BAG_MERCHANT_CONFIG.pageSize; index += 1) {
      const selectionFrame = this.add.rectangle(0, 0, 98, 180, 0x000000, 0)
        .setStrokeStyle(2, 0xb88948, 0)
        .setVisible(false);
      const image = this.add.image(0, -25, 'item-vintage-camera').setVisible(false);
      const name = this.add.text(0, 34, '', {
        fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '14px', fontStyle: 'bold', color: '#ecd8b0',
        fixedWidth: 98, align: 'center', resolution: 6,
      }).setOrigin(0.5).setShadow(0, 1, '#050302', 3, true, true);
      const price = this.add.text(0, 58, '', {
        fontFamily: HUD_DISPLAY_FONT, fontSize: '13px', fontStyle: 'bold', color: '#e4b96f',
        fixedWidth: 98, align: 'center', resolution: 6,
      }).setOrigin(0.5).setShadow(0, 1, '#050302', 3, true, true);
      const badge = this.add.text(0, -72, '', {
        fontFamily: HUD_DISPLAY_FONT, fontSize: '12px', fontStyle: 'bold', color: '#f0d9a6', resolution: 6,
      }).setOrigin(0.5).setShadow(0, 1, '#000000', 3, true, true);
      const content = this.add.container(0, 0, [image, name, price]);
      // 보유 수량은 상품 내용과 분리해 카드 상단 기준선을 유지한다.
      const cell = this.add.container(cardCentersX[index]!, -89, [selectionFrame, content, badge])
        .setSize(108, 190).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectMerchantOfferOnPage(index));
      this.merchantOfferCells.push(cell);
      this.merchantOfferFrames.push(selectionFrame);
      this.merchantOfferImages.push(image);
      this.merchantOfferNames.push(name);
      this.merchantOfferPrices.push(price);
      this.merchantOfferBadges.push(badge);
      overlayChildren.push(cell);
    }

    const merchantPageButtonStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: HUD_DISPLAY_FONT, fontSize: '34px', fontStyle: 'bold', color: '#d7bd87', resolution: 6,
    };
    this.merchantPreviousPage = this.add.text(-165, -89, '‹', merchantPageButtonStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.merchantPreviousPage.setColor('#fff0bd'))
      .on('pointerout', () => this.merchantPreviousPage.setColor('#d7bd87'))
      .on('pointerdown', () => this.changeMerchantPage(-1));
    this.merchantNextPage = this.add.text(480, -89, '›', merchantPageButtonStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.merchantNextPage.setColor('#fff0bd'))
      .on('pointerout', () => this.merchantNextPage.setColor('#d7bd87'))
      .on('pointerdown', () => this.changeMerchantPage(1));
    overlayChildren.push(this.merchantPreviousPage, this.merchantNextPage);

    this.merchantDetailImage = this.add.image(-72, MERCHANT_DETAIL_LAYOUT.centerY, 'item-vintage-camera')
      .setVisible(false);
    this.merchantMessage = this.add.text(206, 104, '', {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '18px', fontStyle: 'bold', color: '#ead7af',
      align: 'center', lineSpacing: 7, fixedWidth: 380, resolution: 6,
    }).setOrigin(0.5).setShadow(0, 2, '#080503', 3, true, true);
    const detailTextStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: INVENTORY_DISPLAY_FONT, fontSize: '18px', fontStyle: 'bold', color: '#ead7af',
      align: 'left', resolution: 6,
    };
    this.merchantDetailTitle = this.add.text(20, MERCHANT_DETAIL_LAYOUT.centerY - MERCHANT_DETAIL_LAYOUT.rowGap, '', {
      ...detailTextStyle, fontSize: '20px', fixedWidth: 420, color: '#f0d29a',
    }).setOrigin(0, 0.5).setVisible(false).setShadow(0, 2, '#080503', 3, true, true);
    const detailValueStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      ...detailTextStyle, align: 'right', fixedWidth: 310,
    };
    this.merchantPurchasePrice = this.add.text(128, MERCHANT_DETAIL_LAYOUT.centerY, '', detailValueStyle)
      .setOrigin(0, 0.5).setVisible(false).setShadow(0, 2, '#080503', 3, true, true);
    this.merchantOfferPrice = this.add.text(128, MERCHANT_DETAIL_LAYOUT.centerY + MERCHANT_DETAIL_LAYOUT.rowGap, '', {
      ...detailValueStyle, color: '#e0a5e2',
    }).setOrigin(0, 0.5).setVisible(false).setShadow(0, 2, '#080503', 3, true, true);
    const merchantWindowTitle = this.add.text(0, -256, '보따리 상인', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '30px', fontStyle: 'bold', color: '#f0cf91',
      resolution: 6,
    }).setOrigin(0.5).setShadow(0, 2, '#160d07', 3, true, true);
    const merchantPurchaseLabel = this.add.text(20, MERCHANT_DETAIL_LAYOUT.centerY, '매입가', {
      ...detailTextStyle, fixedWidth: 92, color: '#e2ad63',
    }).setOrigin(0, 0.5).setShadow(0, 2, '#080503', 3, true, true);
    const merchantOfferLabel = this.add.text(20, MERCHANT_DETAIL_LAYOUT.centerY + MERCHANT_DETAIL_LAYOUT.rowGap, '제안가', {
      ...detailTextStyle, fixedWidth: 92, color: '#d69ad8',
    }).setOrigin(0, 0.5).setShadow(0, 2, '#080503', 3, true, true);
    this.merchantSellButton = this.makeMerchantAssetButton(
      45, 232, 'merchant-sale-button', '판매', 180, 56, () => this.sellSelectedMerchantOffer(),
    );
    this.merchantFinishButton = this.makeMerchantAssetButton(
      273, 232, 'merchant-stage-end-button', '스테이지 종료', 180, 56, () => this.finishMerchantVisit(),
    );

    const saleResultDimmer = this.add.rectangle(0, 0, 1024, 576, 0x050403, 0.58).setInteractive();
    const saleResultFrame = this.add.image(0, 0, 'appraisal-result-frame').setDisplaySize(500, 330);
    const saleResultTitle = this.add.text(0, -93, '판매 완료', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '26px', color: '#ddc28e', fontStyle: 'bold', resolution: 6,
    }).setOrigin(0.5);
    this.merchantSaleResultText = this.add.text(0, -3, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '19px', color: '#eee1ca', align: 'center',
      lineSpacing: 10, fixedWidth: 410, wordWrap: { width: 400 }, resolution: 6,
    }).setOrigin(0.5);
    const saleResultConfirmBackground = this.add.image(0, 0, 'appraisal-result-confirm').setDisplaySize(142, 58);
    const saleResultConfirmLabel = this.add.text(0, 0, '확인', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '20px', color: '#dfc48c', fontStyle: 'bold', resolution: 6,
    }).setOrigin(0.5);
    const saleResultConfirm = this.add.container(
      0, 108, [saleResultConfirmBackground, saleResultConfirmLabel],
    ).setSize(142, 58).setInteractive({ useHandCursor: true })
      .on('pointerover', () => saleResultConfirmBackground.setTint(0xffdfad))
      .on('pointerout', () => saleResultConfirmBackground.clearTint())
      .on('pointerdown', () => {
        this.merchantSaleFeedback = null;
        this.renderMerchant();
      });
    this.merchantSaleResultPanel = this.add.container(0, 0, [
      saleResultDimmer, saleResultFrame, saleResultTitle, this.merchantSaleResultText,
      saleResultConfirm,
    ]).setVisible(false);
    overlayChildren.push(
      this.merchantDetailImage, this.merchantMessage,
      merchantWindowTitle, merchantPurchaseLabel, merchantOfferLabel,
      this.merchantDetailTitle, this.merchantPurchasePrice, this.merchantOfferPrice,
      this.merchantSellButton, this.merchantFinishButton,
      this.merchantSaleResultPanel,
    );
    const merchantOverlay = this.add.container(0, 0, overlayChildren);
    const merchantSpeechOverlay = this.add.container(0, 0, [speechBubble, this.merchantSpeechText])
      .setScale(1280 / 920);
    this.merchantPopup = this.add.container(
      centerX, centerY, [dimmer, background, merchantOverlay, merchantSpeechOverlay],
    )
      .setDepth(120).setVisible(false);
  }

  private makeMerchantAssetButton(
    x: number, y: number, texture: string, label: string,
    width: number, height: number, action: () => void,
  ): Phaser.GameObjects.Container {
    const background = this.add.image(0, 0, texture).setDisplaySize(width, height);
    const labelX = 27;
    const labelText = this.add.text(labelX, 0, label, {
      fontFamily: UI_DISPLAY_FONT,
      fontSize: label.length > 2 ? '17px' : '19px',
      fontStyle: 'bold',
      color: '#f0cf91',
      resolution: 6,
    }).setOrigin(0.5).setShadow(0, 2, '#050302', 3, true, true);
    const button = this.add.container(x, y, [background, labelText])
      .setSize(width, height)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => background.setTint(0xffd58a))
      .on('pointerout', () => {
        background.clearTint();
        button.setScale(1);
      })
      .on('pointerdown', () => button.setScale(0.96))
      .on('pointerup', () => {
        button.setScale(1);
        action();
      });
    return button;
  }

  private makeSalesAssetButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
    width = 230,
  ): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const height = Math.round(width * (116 / 440));
    const background = this.add.image(0, 0, 'item-shop-purchase-button')
      .setDisplaySize(width, height);
    const labelText = this.add.text(0, 0, label, {
      fontFamily: HUD_DISPLAY_FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#e1c48a',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 3, true, true);
    const container = this.add.container(x, y, [background, labelText])
      .setSize(width, height)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => background.setTint(0xffd4ee))
      .on('pointerout', () => background.clearTint())
      .on('pointerdown', action);
    return { container, label: labelText };
  }

  private selectMerchantOffer(index: number): void {
    if (this.bagMerchant.status !== 'visiting') return;
    const offer = this.bagMerchant.offers[index];
    if (!offer) return;
    this.merchantSaleFeedback = null;
    const ownedCount = this.inventory.items.filter((owned) => owned.item.id === offer.item.id).length;
    if (ownedCount === 0) {
      this.selectedMerchantOfferIndex = null;
      this.merchantSpeechText.setText(`허허, ${topicParticle(offer.item.name)}\n자네 보따리에 없는 것 같은데?`);
      this.renderMerchant();
      return;
    }
    this.selectedMerchantOfferIndex = index;
    const owned = this.inventory.items.find((item) => item.item.id === offer.item.id)!;
    const shownPrice = owned.authenticity === 'fake'
      ? this.market.salePrice(owned.item, 'fake')
      : offer.price;
    this.merchantSpeechText.setText(
      `흠, ${copulaParticle(offer.item.name)}라…\n${shownPrice.toLocaleString('ko-KR')}원은 쳐주지.`,
    );
    this.renderMerchant();
  }

  private sellSelectedMerchantOffer(): void {
    if (this.bagMerchant.status !== 'visiting' || this.selectedMerchantOfferIndex === null) return;
    const offer = this.bagMerchant.offers[this.selectedMerchantOfferIndex];
    if (!offer) return;
    const result = sellToMerchant(this.state, this.inventory, this.ledger, offer);
    this.transactionHistory.recordSale(result.item, result.salePrice, this.holdingDays(result.item), '보따리 상인');
    this.merchantSpeechText.setText(
      `${result.item.item.name}, 약속대로 챙겨주지.\n${result.salePrice.toLocaleString('ko-KR')}원이네.`,
    );
    this.merchantSaleFeedback = `판매 완료: ${result.item.item.name}\n매입 ${result.item.purchasePrice.toLocaleString('ko-KR')}원 → 판매 ${result.salePrice.toLocaleString('ko-KR')}원\n실현 손익 ${formatSignedMoney(result.profit)} · 보유 ${this.holdingDays(result.item)}일${result.item.authenticity === 'fake' ? '\n판매 결과: 가품' : ''}`;
    const hasAnother = this.inventory.items.some((owned) => owned.item.id === offer.item.id);
    if (!hasAnother) {
      this.selectedMerchantOfferIndex = null;
    }
    this.render();
    this.sound.play('sfx-cash-register', { volume: AUDIO_CONFIG.cashRegisterVolume });
    this.playResultEmphasis(this.merchantSaleResultText, feedbackKindForProfit(result.profit));
  }

  private selectMerchantOfferOnPage(cellIndex: number): void {
    const entry = this.availableMerchantOffers()[
      this.merchantPage * BAG_MERCHANT_CONFIG.pageSize + cellIndex
    ];
    if (entry) this.selectMerchantOffer(entry.offerIndex);
  }

  private availableMerchantOffers(): Array<{ offerIndex: number; offer: MerchantOffer }> {
    return this.bagMerchant.offers
      .map((offer, offerIndex) => ({ offerIndex, offer }))
      .filter(({ offer }) => this.inventory.items.some((owned) => owned.item.id === offer.item.id));
  }

  private changeMerchantPage(direction: -1 | 1): void {
    const pageCount = Math.max(
      1, Math.ceil(this.availableMerchantOffers().length / BAG_MERCHANT_CONFIG.pageSize),
    );
    const nextPage = Phaser.Math.Clamp(this.merchantPage + direction, 0, pageCount - 1);
    if (nextPage === this.merchantPage) return;
    this.merchantPage = nextPage;
    this.selectedMerchantOfferIndex = null;
    this.merchantSaleFeedback = null;
    this.renderMerchant();
  }

  private finishMerchantVisit(): void {
    if (this.bagMerchant.status !== 'visiting' || this.shutterAnimating) return;
    this.selectedMerchantOfferIndex = null;
    this.merchantSaleFeedback = null;
    this.bagMerchant.finishVisit();
    this.merchantPopup.setVisible(false);
    this.lowerShutterAfterMerchant(() => {
      this.selectedItemShopProduct = 'market';
      this.itemShopVisit = new ItemShopVisit();
      this.closingMoney = this.state.money;
      this.playShopWindowBell();
      this.render();
    });
  }

  private renderMerchant(): void {
    const visible = this.state.isStageFinished && this.bagMerchant.status === 'visiting';
    this.merchantPopup.setVisible(visible);
    if (!visible) return;
    const offers = this.bagMerchant.offers;
    const availableOffers = this.availableMerchantOffers();
    const pageCount = Math.max(1, Math.ceil(availableOffers.length / BAG_MERCHANT_CONFIG.pageSize));
    this.merchantPage = Phaser.Math.Clamp(this.merchantPage, 0, pageCount - 1);
    const pageStart = this.merchantPage * BAG_MERCHANT_CONFIG.pageSize;
    const pageOffers = availableOffers.slice(pageStart, pageStart + BAG_MERCHANT_CONFIG.pageSize);
    this.merchantPreviousPage.setVisible(pageCount > 1).setAlpha(this.merchantPage > 0 ? 1 : 0.35);
    this.merchantNextPage.setVisible(pageCount > 1)
      .setAlpha(this.merchantPage < pageCount - 1 ? 1 : 0.35);
    this.merchantOfferCells.forEach((cell, index) => {
      const entry = pageOffers[index];
      if (!entry) {
        this.merchantOfferImages[index]!.setVisible(false);
        this.merchantOfferNames[index]!.setText('');
        this.merchantOfferPrices[index]!.setText('');
        this.merchantOfferBadges[index]!.setVisible(false);
        this.merchantOfferFrames[index]!.setVisible(false);
        cell.setAlpha(1).disableInteractive();
        return;
      }
      const { offer, offerIndex } = entry;
      const matchingItems = this.inventory.items.filter((owned) => owned.item.id === offer.item.id);
      const ownedCount = matchingItems.length;
      const nextOwned = matchingItems[0];
      const shownPrice = nextOwned?.authenticity === 'fake'
        ? this.market.salePrice(nextOwned.item, 'fake')
        : offer.price;
      this.showMerchantItemArt(this.merchantOfferImages[index]!, offer.item.id);
      this.merchantOfferNames[index]!.setText(offer.item.name);
      this.merchantOfferPrices[index]!.setText(`₩ ${shownPrice.toLocaleString('ko-KR')}`);
      this.merchantOfferBadges[index]!.setText(`보유 ${ownedCount}`).setColor('#f0d9a6')
        .setVisible(ownedCount > 0);
      cell.setAlpha(1).setInteractive({ useHandCursor: true });
      this.merchantOfferImages[index]!.clearTint();
      this.merchantOfferNames[index]!.setColor('#ecd8b0');
      this.merchantOfferPrices[index]!.setColor('#e4b96f');
      const selected = offerIndex === this.selectedMerchantOfferIndex;
      this.merchantOfferFrames[index]!.setVisible(selected).setStrokeStyle(2, 0xb88948, 0.9);
    });
    const selectedOffer = this.selectedMerchantOfferIndex === null
      ? undefined : offers[this.selectedMerchantOfferIndex];
    const selectedOwned = selectedOffer
      ? this.inventory.items.find((owned) => owned.item.id === selectedOffer.item.id)
      : undefined;
    const canSell = selectedOffer !== undefined && selectedOwned !== undefined;
    this.merchantSellButton.setAlpha(canSell ? 1 : 0.42);
    if (canSell) this.merchantSellButton.setInteractive({ useHandCursor: true });
    else this.merchantSellButton.disableInteractive();
    this.merchantDetailImage.setVisible(canSell);
    this.merchantDetailTitle.setVisible(canSell);
    this.merchantPurchasePrice.setVisible(canSell);
    this.merchantOfferPrice.setVisible(canSell);
    this.merchantMessage.setVisible(false).setText('');
    this.merchantSaleResultPanel.setVisible(this.merchantSaleFeedback !== null);
    if (selectedOffer && selectedOwned) {
      const merchantPrice = selectedOwned.authenticity === 'fake'
        ? this.market.salePrice(selectedOwned.item, 'fake')
        : selectedOffer.price;
      // 117×117px 상세 슬롯 안쪽에 약 8px의 안전 여백을 둔다.
      this.showItemArt(this.merchantDetailImage, selectedOwned.item.id, 100);
      this.merchantDetailTitle.setText(
        `${selectedOwned.item.name}  ·  ${selectedOwned.authenticity === 'fake' ? '가품' : '진품'}`,
      );
      this.merchantPurchasePrice.setText(`₩ ${selectedOwned.purchasePrice.toLocaleString('ko-KR')}`);
      this.merchantOfferPrice.setText(`₩ ${merchantPrice.toLocaleString('ko-KR')}`);
    }
    if (this.merchantSaleFeedback) {
      this.merchantSaleResultText.setText(this.merchantSaleFeedback
        .replace(/^판매 완료:\s*/, '')
        .replace(/\n판매 결과: 가품$/, ' · 가품'));
    }
  }

  private createStageResultPopup(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;
    const dimmer = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setInteractive();
    const frame = this.add.image(0, 0, 'appraisal-result-frame')
      .setDisplaySize(620, 440);
    this.stageResultTitle = this.add.text(0, -150, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '32px', fontStyle: 'bold', color: '#e3c88f',
    }).setOrigin(0.5);
    this.stageResultText = this.add.text(0, -5, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '18px', color: '#d8c7a7',
      align: 'left', lineSpacing: 7,
    }).setOrigin(0.5);
    this.stageResultActionBackground = this.add.image(0, 0, 'appraisal-result-confirm')
      .setDisplaySize(170, 50);
    this.stageResultAction = this.add.text(0, 0, '', {
      fontFamily: UI_DISPLAY_FONT, fontSize: '20px', fontStyle: 'bold', color: '#e3c88f',
      fixedWidth: 160, align: 'center',
    }).setOrigin(0.5);
    this.stageResultActionButton = this.add.container(
      0, 164, [this.stageResultActionBackground, this.stageResultAction],
    )
      .setSize(190, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.stageResultActionBackground.setTint(0xffdfad))
      .on('pointerout', () => this.stageResultActionBackground.clearTint())
      .on('pointerdown', () => this.onStageResultAction());
    this.stageResultPopup = this.add.container(
      centerX, centerY, [
        dimmer, frame, this.stageResultTitle, this.stageResultText,
        this.stageResultActionButton,
      ],
    ).setDepth(130).setVisible(false);
  }

  private renderStageResult(): void {
    const phase = this.state.phase;
    const visible = phase === 'StageResult' || phase === 'GameOver' || phase === 'DemoClear';
    this.stageResultPopup.setVisible(visible);
    if (!visible) return;
    const result = this.state.rentResult;
    if (!result) return;

    // 성공·실패 결과 모두 같은 세로 배열을 사용한다.
    this.stageResultTitle.setY(-130);
    this.stageResultText.setY(15);
    this.stageResultActionButton.setY(154);

    if (phase === 'GameOver') {
      this.stageResultTitle.setText('GAME OVER');
      if (result.failureReason === 'profitGoal') {
        this.stageResultText.setText([
          `STAGE ${this.state.stage} 목표 실적 미달`, '',
          `목표 실현 손익    ${result.profitGoal.toLocaleString('ko-KR')}원`,
          `달성 실현 손익    ${result.realizedProfit.toLocaleString('ko-KR')}원`,
          '────────────────────',
          `부족한 손익      ${(result.profitGoal - result.realizedProfit).toLocaleString('ko-KR')}원`, '',
          '월세는 냈지만 장사로 남긴 것이 없습니다.',
        ]);
        this.stageResultAction.setText('처음부터');
        return;
      }
      this.stageResultText.setText([
        `STAGE ${this.state.stage} 월세 정산 실패`, '',
        `보유 현금       ${result.moneyBefore.toLocaleString('ko-KR')}원`,
        `납부할 월세    -${result.rent.toLocaleString('ko-KR')}원`,
        '────────────────────',
        `부족 금액       ${result.shortfall.toLocaleString('ko-KR')}원`,
      ]);
      this.stageResultAction.setText('처음부터');
      return;
    }

    const demoClear = phase === 'DemoClear';
    const balanceLabel = demoClear ? '최종 잔액' : '이월 잔액';
    this.stageResultTitle.setText(demoClear ? 'DEMO CLEAR' : `STAGE ${this.state.stage} CLEAR`);
    this.stageResultText.setText([
      `STAGE ${this.state.stage} ${demoClear ? '데모 완료' : '월세 정산 완료'}`, '',
      `목표 실현 손익    ${result.profitGoal.toLocaleString('ko-KR')}원`,
      `달성 실현 손익    ${formatSignedMoney(result.realizedProfit)}`,
      '────────────────────',
      `${balanceLabel}        ${result.moneyAfter.toLocaleString('ko-KR')}원`, '',
      `월세 ${result.rent.toLocaleString('ko-KR')}원을 내고 ${demoClear ? '데모를 완료했습니다.' : '다음 STAGE로 넘어갑니다.'}`,
    ]);
    this.stageResultAction.setText(demoClear ? '처음부터' : '다음 STAGE');
  }

  private onStageResultAction(): void {
    if (this.state.phase === 'StageResult') {
      this.advanceToNextStage();
      return;
    }
    if (this.state.phase === 'GameOver' || this.state.phase === 'DemoClear') this.restartGame();
  }

  private advanceToNextStage(): void {
    this.state.advanceToNextStage();
    this.closedDaysRealizedProfit = 0;
    this.ledger.reset();
    this.devCashAdjustment = 0;
    this.market = new Market();
    this.market.updateForDay(this.state.day);
    this.customerQueue = new CustomerQueue(customerQueueConfigForStage(this.state.stage));
    this.bagMerchant = new BagMerchant(BAG_MERCHANT_CONFIG);
    this.trade = new TradeSession();
    this.defenseActive = false;
    this.openingMoney = this.state.money;
    this.closingMoney = this.state.money;
    this.statementReady = false;
    this.salesOpen = true;
    this.selectedSaleId = null;
    this.selectedMerchantOfferIndex = null;
    this.marketPreviews.clear();
    this.salesMessage = '판매할 물건을 선택하세요.';
    this.merchantMessage.setText('제안을 선택하면 매입가와 예상 손익을 확인할 수 있습니다.');
    this.merchantSpeechText.setText(MERCHANT_INTRO_SPEECH);
    this.shutterBacking.setVisible(false);
    this.shutter.setVisible(false);
    this.openStageGoal();
  }

  private restartGame(): void {
    if (this.backgroundMusicStopping) return;
    this.fadeOutBackgroundMusic(() => this.completeRestartGame());
  }

  /** 닫힌 셔터 위에서 DAY 표기는 고정하고 숫자만 교체하는 날짜 증가 연출. */
  private createDayChangeOverlay(): void {
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: HUD_DISPLAY_FONT,
      fontSize: '52px',
      fontStyle: 'bold',
      color: COLOR_HUD_GOLD,
      resolution: 4,
    };
    this.dayChangeLabel = this.add.text(DAY_CHANGE_LAYOUT.labelRightX, 0, 'DAY', textStyle)
      .setOrigin(1, 0.5)
      .setShadow(0, 3, '#120b04', 7, true, true);
    this.dayChangeOldNumber = this.add.text(DAY_CHANGE_LAYOUT.numberLeftX, 0, '', textStyle)
      .setOrigin(0, 0.5)
      .setShadow(0, 3, '#120b04', 7, true, true);
    this.dayChangeNewNumber = this.add.text(DAY_CHANGE_LAYOUT.numberLeftX, 0, '', textStyle)
      .setOrigin(0, 0.5)
      .setShadow(0, 3, '#120b04', 7, true, true);
    // 정산서(100)·보따리 상인(120)·아이템 상점(125)·STAGE 결과(210)·튜토리얼 마스크(200~204)
    // 위에 올라가야 어떤 DAY 전환에서도 숫자가 가려지지 않는다. DEV 패널(300)만 위에 둔다.
    this.dayChangeOverlay = this.add.container(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      [this.dayChangeLabel, this.dayChangeOldNumber, this.dayChangeNewNumber],
    ).setDepth(220).setVisible(false);
  }

  /**
   * DAY 표기 전체를 화면 가로 중앙에 놓는다.
   *
   * 라벨은 오른쪽 정렬, 숫자는 왼쪽 정렬로 각각 고정 좌표에 붙어 있다. 숫자가 세로로만
   * 움직이게 하려면 이 고정이 필요하지만, 그대로 두면 `DAY`(108px)와 숫자 사이 간격까지
   * 합쳐 그룹 중심이 컨테이너 원점에서 47px 왼쪽으로 밀린다. 실제 글자 폭을 재서 되돌린다.
   */
  private centerDayChangeOverlay(): void {
    const groupLeft = DAY_CHANGE_LAYOUT.labelRightX - this.dayChangeLabel.width;
    const groupRight = DAY_CHANGE_LAYOUT.numberLeftX
      + Math.max(this.dayChangeOldNumber.width, this.dayChangeNewNumber.width);
    this.dayChangeOverlay.setX(GAME_WIDTH / 2 - (groupLeft + groupRight) / 2);
  }

  private playDayChangeTransition(previousDay: number, nextDay: number, onComplete: () => void): void {
    const travel = DAY_TRANSITION_CONFIG.dayNumberTravelPixels;
    this.dayChangeAnimating = true;
    this.tweens.killTweensOf([this.dayChangeOldNumber, this.dayChangeNewNumber]);
    this.dayNumberSwapSoundTimer?.remove(false);
    this.dayNumberSwapSoundTimer = undefined;
    this.dayChangeOldNumber.setText(String(previousDay))
      .setPosition(DAY_CHANGE_LAYOUT.numberLeftX, 0).setAlpha(1).setScale(1);
    this.dayChangeNewNumber.setText(String(nextDay))
      .setPosition(DAY_CHANGE_LAYOUT.numberLeftX, travel).setAlpha(0).setScale(0.92);
    // 숫자 폭이 자릿수에 따라 달라지므로 글자를 넣은 뒤에 중앙을 다시 잡는다.
    this.centerDayChangeOverlay();
    this.dayChangeOverlay.setVisible(true);
    this.tweens.add({
      targets: this.dayChangeOldNumber,
      y: -travel,
      alpha: 0,
      scale: 0.92,
      delay: DAY_TRANSITION_CONFIG.dayNumberHoldMilliseconds,
      duration: DAY_TRANSITION_CONFIG.dayNumberSwapDurationMilliseconds,
      ease: 'Cubic.easeInOut',
    });
    this.tweens.add({
      targets: this.dayChangeNewNumber,
      y: 0,
      alpha: 1,
      scale: 1,
      delay: DAY_TRANSITION_CONFIG.dayNumberHoldMilliseconds,
      duration: DAY_TRANSITION_CONFIG.dayNumberSwapDurationMilliseconds,
      ease: 'Cubic.easeInOut',
      // 새 숫자가 자리를 잡은 뒤 읽을 시간을 준다. 별도 타이머로 이어 붙이면
      // 트윈이 중간에 끊길 때 이 콜백이 아예 실행되지 않아 다음 DAY로 넘어가지 못한다.
      completeDelay: DAY_TRANSITION_CONFIG.dayNumberSettleMilliseconds,
      onStart: () => {
        // 움직임과 동시에 울리면 이르게 들려, 숫자가 자리를 잡는 무렵으로 늦춘다.
        this.dayNumberSwapSoundTimer = this.time.delayedCall(
          DAY_TRANSITION_CONFIG.dayNumberSwapSoundDelayMilliseconds,
          () => {
            this.dayNumberSwapSoundTimer = undefined;
            this.sound.play('sfx-day-number-swap', { volume: AUDIO_CONFIG.dayNumberSwapVolume });
          },
        );
      },
      onComplete: () => {
        this.dayChangeOverlay.setVisible(false);
        this.dayChangeAnimating = false;
        onComplete();
      },
    });
  }

  private completeRestartGame(): void {
    this.inventory = new Inventory();
    this.ledger = new DailyLedger();
    this.transactionHistory = new TransactionHistory();
    this.historyOpen = false;
    this.tutorialPurchaseResult = null;
    this.tutorialTrustSnapshot = null;
    this.setTutorialInputError(null);
    this.tutorialStep = 'inactive';
    this.tutorialSkipped = false;
    this.market = new Market();
    this.customerQueue = new CustomerQueue(customerQueueConfigForStage(1));
    this.bagMerchant = new BagMerchant(BAG_MERCHANT_CONFIG);
    this.trade = new TradeSession();
    this.customerProfiles = new CustomerProfileStore();
    this.todaysCustomerNames = [];
    this.todaysItemIds = [];
    this.specialItems = new SpecialItemInventory(ITEM_SHOP_CONFIG.startingAppraisalTicketCount);
    this.itemShopVisit = null;
    this.appraisalPopupOpen = false;
    this.eventPopupOpen = false;
    this.defenseActive = false;
    this.inventoryCells = [];
    this.inventoryCellFrames = [];
    this.inventoryCellVelvets = [];
    this.inventoryCellOrnaments = [];
    this.inventoryCellImages = [];
    this.inventoryCellLabels = [];
    this.inventoryCellQuantities = [];
    this.salesCells = [];
    this.salesCellFrames = [];
    this.salesCellImages = [];
    this.salesCellNames = [];
    this.salesCellMeta = [];
    this.salesPage = 0;
    this.merchantOfferCells = [];
    this.toolWindows = [];
    this.toolWindowOrder = [];
    this.inventoryOpen = false;
    this.salesOpen = true;
    this.selectedSaleId = null;
    this.selectedMerchantOfferIndex = null;
    this.marketPreviews.clear();
    this.statementReady = false;
    this.closedDaysRealizedProfit = 0;
    this.scene.restart();
  }

  /** 영업이 끝나면 열려 있던 도구 창·말풍선을 모두 닫는다. 다음 단계 화면 위에 남지 않게 한다. */
  private closeToolPopups(): void {
    this.inventoryOpen = false;
    this.specialItemPopupOpen = false;
    this.historyOpen = false;
    this.hoveredInventoryIndex = null;
    this.inventoryDetailPanel.setVisible(false);
    this.specialItemTooltip.setVisible(false);
    this.inventoryPopup.setVisible(false);
    this.specialItemPopup.setVisible(false);
    this.historyPopup.setVisible(false);
  }

  /**
   * 영업이 끝났는데 마감 화면이 하나도 뜨지 않은 상태를 되살린다.
   * 샤따 연출이 진행되는 동안 DAY 종료가 겹치면 handleShopClosed()가 한 번 걸러지고
   * 다시 호출되지 않아 화면이 멈춘다(DEV 패널의 DAY 즉시 종료로 재현됨).
   */
  private recoverStalledDayClose(): void {
    if (this.shutterAnimating || this.shutter.visible || this.shutterBacking.visible) return;
    if (this.statementReady || this.itemShopVisit !== null) return;
    if (this.bagMerchant.status === 'visiting') return;
    if (this.state.rentResult !== null) return;
    this.handleShopClosed();
  }

  /** STAGE 시작부터 지금까지 확정된 실현 손익. */
  private get stageRealizedProfit(): number {
    return this.closedDaysRealizedProfit + this.ledger.realizedProfit;
  }

  private handleShopClosed(): void {
    if (this.shutterBacking.visible || this.shutter.visible || this.shutterAnimating || this.statementReady) return;
    this.closingMoney = this.state.money;
    this.closeToolPopups();
    this.shutterBacking
      .setPosition(GAME_WIDTH / 2, -GAME_HEIGHT / 2)
      .setVisible(true);
    this.shutter.setPosition(GAME_WIDTH / 2, -GAME_HEIGHT / 2).setVisible(true);
    this.shutterAnimating = true;
    this.playEventSound('sfx-shutter-close');
    this.tweens.add({
      targets: [this.shutterBacking, this.shutter],
      y: GAME_HEIGHT / 2,
      duration: DAY_TRANSITION_CONFIG.shutterLowerDurationMilliseconds,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.shutterAnimating = false;
        this.finishClosedDayTransition();
      },
    });
  }

  private finishClosedDayTransition(): void {
    if (this.state.isStageFinished) {
      this.shutterAnimating = true;
      this.time.delayedCall(DAY_TRANSITION_CONFIG.shutterClosedHoldMilliseconds, () => {
        this.raiseShutterForMerchant(() => {
          if (this.bagMerchant.status === 'idle') {
            this.merchantPage = 0;
            this.bagMerchant.startVisit(this.inventory.items.map((owned) => owned.item));
          }
          this.merchantSpeechText.setText(MERCHANT_INTRO_SPEECH);
          this.sound.play('sfx-customer-bell', { volume: AUDIO_CONFIG.customerBellVolume });
          this.render();
        });
      });
      return;
    }
    if (shouldOpenItemShop(this.state.stage, this.state.day, this.state.daysPerStage)) {
      this.selectedItemShopProduct = 'market';
      this.itemShopVisit = new ItemShopVisit();
      this.playShopWindowBell();
    } else {
      this.statementReady = true;
    }
    this.render();
  }

  private raiseShutterForMerchant(afterRaise: () => void): void {
    this.shutterAnimating = true;
    this.playEventSound('sfx-shutter');
    this.shutterBacking.setDepth(139).setVisible(true);
    this.shutter.setDepth(140).setVisible(true);
    this.tweens.add({
      targets: [this.shutterBacking, this.shutter],
      y: -GAME_HEIGHT / 2,
      duration: DAY_TRANSITION_CONFIG.shutterDurationMilliseconds,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.shutterAnimating = false;
        this.shutterBacking.setDepth(49).setVisible(false);
        this.shutter.setDepth(50).setVisible(false);
        afterRaise();
      },
    });
  }

  private lowerShutterAfterMerchant(afterLower: () => void): void {
    this.shutterAnimating = true;
    this.playEventSound('sfx-shutter-close');
    this.shutterBacking
      .setPosition(GAME_WIDTH / 2, -GAME_HEIGHT / 2)
      .setDepth(139).setVisible(true);
    this.shutter
      .setPosition(GAME_WIDTH / 2, -GAME_HEIGHT / 2)
      .setDepth(140).setVisible(true);
    this.tweens.add({
      targets: [this.shutterBacking, this.shutter],
      y: GAME_HEIGHT / 2,
      duration: DAY_TRANSITION_CONFIG.shutterLowerDurationMilliseconds,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.shutterAnimating = false;
        this.shutterBacking.setDepth(49).setVisible(false);
        this.shutter.setDepth(50).setVisible(false);
        afterLower();
      },
    });
  }

  private advanceFromStatement(): void {
    if (this.shutterAnimating || this.dayChangeAnimating
      || !this.statementReady || !this.state.canAdvanceToNextDay) return;
    // 공개 연출 중이면 먼저 전부 보여 주고, 다시 눌러야 다음 DAY로 넘어간다.
    if (this.completeStatementReveal()) return;
    const previousDay = this.state.day;
    this.state.advanceToNextDay();
    this.deactivateTutorialOutsideConfiguredDay();
    this.closedDaysRealizedProfit += this.ledger.realizedProfit;
    this.ledger.reset();
    this.devCashAdjustment = 0;
    this.openingMoney = this.state.money;
    this.closingMoney = this.state.money;
    this.statementReady = false;
    this.market.updateForDay(this.state.day);
    this.salesOpen = false;
    this.defenseActive = false;
    this.selectedSaleId = null;
    this.salesMessage = '판매할 물건을 선택하세요.';
    // 어제 확인한 '내일 예상'은 오늘 시세가 됐으므로 버린다(다시 확인할 수 있게 한다).
    this.marketPreviews.clear();
    this.render();
    this.playDayChangeTransition(previousDay, this.state.day, () => {
      this.salesOpen = true;
      this.playShopWindowBell();
      this.render();
    });
  }

  private renderStatement(): void {
    const visible = this.state.phase === 'Closed' && this.statementReady && !this.state.isStageFinished;
    this.statementPopup.setVisible(visible);
    if (!visible) {
      this.statementWasVisible = false;
      this.statementRevealTimers.forEach((timer) => timer.remove(false));
      this.statementRevealTimers = [];
      this.statementStampDelayTimer?.remove(false);
      this.statementStampDelayTimer = undefined;
      this.tweens.killTweensOf(this.statementStamp);
      this.tweens.killTweensOf(this.statementPopup);
      this.statementStamp.setVisible(false);
      this.statementRevealContent = null;
      this.clearStatementLines();
      return;
    }
    const statement = this.ledger.statement(
      this.openingMoney, this.closingMoney, this.devCashAdjustment,
    );
    const profitGoal = this.state.profitGoalDue;
    this.setStatementSubtitle(profitGoal > 0
      ? `DAY ${this.state.day} · 영업 종료${STATEMENT_SUBTITLE.separator}STAGE 목표 손익 ${this.stageRealizedProfit.toLocaleString('ko-KR')} / ${profitGoal.toLocaleString('ko-KR')}원`
      : `DAY ${this.state.day} · 영업 종료`);
    const labels = [
      '일반 판매', '매입 건수', '물건 매입', '아이템 구매', '병원비',
      '─────────────', '오늘 현금 변동', '판매 합계', '실현 손익', '최대 이익 / 손실',
    ];
    const values = [
      `+${statement.salesRevenue.toLocaleString('ko-KR')}원`,
      `${statement.purchaseCount}건`,
      `-${statement.purchaseExpense.toLocaleString('ko-KR')}원`,
      `-${statement.itemPurchaseExpense.toLocaleString('ko-KR')}원`,
      `-${statement.hospitalExpense.toLocaleString('ko-KR')}원`,
      '─────────────',
      formatSignedMoney(statement.netCashChange),
      `${statement.saleCount + statement.merchantSaleCount}건`,
      formatSignedMoney(statement.realizedProfit),
      `${statement.bestRealizedProfit === null ? '-' : formatSignedMoney(statement.bestRealizedProfit)} / ${statement.worstRealizedProfit === null ? '-' : formatSignedMoney(statement.worstRealizedProfit)}`,
    ];
    if (!this.statementWasVisible) {
      this.statementWasVisible = true;
      this.clearStatementLines();
      const targetY = GAME_HEIGHT / 2;
      this.statementPopup
        .setPosition(GAME_WIDTH / 2, targetY - 420)
        .setAlpha(0);
      this.sound.play('sfx-statement-paper', { volume: AUDIO_CONFIG.statementPaperVolume });
      this.tweens.add({
        targets: this.statementPopup,
        y: targetY,
        alpha: 1,
        duration: DAY_TRANSITION_CONFIG.statementEntranceDurationMilliseconds,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (!this.statementPopup.visible || !this.statementReady) return;
          this.playStatementTextReveal(labels, values, `${statement.closingMoney.toLocaleString('ko-KR')}원`);
        },
      });
    }
  }

  /**
   * 정산서 부제를 종이 폭 안에 넣는다.
   * STAGE·DAY와 목표 손익 자릿수에 따라 길이가 달라지므로 매번 기본 크기부터 다시 잰다.
   */
  private setStatementSubtitle(subtitle: string): void {
    let fontSize = STATEMENT_SUBTITLE.baseFontSize;
    this.statementDayText.setFontSize(fontSize).setText(subtitle);
    while (this.statementDayText.width > STATEMENT_SUBTITLE.maxWidth
      && fontSize > STATEMENT_SUBTITLE.minimumFontSize) {
      fontSize -= 1;
      this.statementDayText.setFontSize(fontSize);
    }
  }

  /** 정산서에 남은 지난 DAY 내용을 비운다. */
  private clearStatementLines(): void {
    this.statementLabelsText.setText('');
    this.statementValuesText.setText('');
    this.statementTotalText.setText('');
  }

  /** 공개 애니메이션이 진행 중이면 전부 즉시 표시하고 true를 돌려준다. */
  private completeStatementReveal(): boolean {
    if (this.statementRevealTimers.length === 0 || !this.statementRevealContent) return false;
    this.statementRevealTimers.forEach((timer) => timer.remove(false));
    this.statementRevealTimers = [];
    const { labels, values, total } = this.statementRevealContent;
    this.statementLabelsText.setText(labels);
    this.statementValuesText.setText(values);
    this.statementTotalText.setText(total);
    this.playStatementStampEffect();
    return true;
  }

  private playStatementTextReveal(labels: string[], values: string[], total: string): void {
    this.statementRevealTimers.forEach((timer) => timer.remove(false));
    this.statementRevealTimers = [];
    this.statementRevealContent = { labels, values, total };
    this.clearStatementLines();
    labels.forEach((_label, index) => {
      const timer = this.time.delayedCall(
        index * DAY_TRANSITION_CONFIG.statementTextLineIntervalMilliseconds,
        () => {
          this.sound.play('sfx-statement-line', { volume: AUDIO_CONFIG.statementClickVolume });
          this.statementLabelsText.setText(labels.slice(0, index + 1));
          this.statementValuesText.setText(values.slice(0, index + 1));
          if (index === labels.length - 1) {
            this.statementTotalText.setText(total);
            this.statementRevealTimers = [];
            this.playStatementStampEffect();
          }
        },
      );
      this.statementRevealTimers.push(timer);
    });
  }

  private playStatementStampEffect(): void {
    this.statementStampDelayTimer?.remove(false);
    this.tweens.killTweensOf(this.statementStamp);
    const finalScaleX = 84 / this.statementStamp.width;
    const finalScaleY = 84 / this.statementStamp.height;
    this.statementStamp
      .setVisible(false)
      .setAlpha(0)
      .setScale(finalScaleX * 1.55, finalScaleY * 1.55)
      .setAngle(-4);
    this.statementStampDelayTimer = this.time.delayedCall(
      DAY_TRANSITION_CONFIG.statementStampDelayMilliseconds,
      () => {
        this.statementStampDelayTimer = undefined;
        if (!this.statementPopup.visible || !this.statementReady) return;
        this.statementStamp.setVisible(true);
        this.tweens.add({
          targets: this.statementStamp,
          alpha: 0.86,
          scaleX: finalScaleX * 0.92,
          scaleY: finalScaleY * 0.92,
          angle: 8,
          duration: DAY_TRANSITION_CONFIG.statementStampImpactDurationMilliseconds,
          ease: 'Back.easeIn',
          onComplete: () => {
            this.sound.play('sfx-cash-register', { volume: AUDIO_CONFIG.cashRegisterVolume });
            this.cameras.main.shake(DAY_TRANSITION_CONFIG.statementStampShakeDurationMilliseconds, 0.0022);
            this.tweens.add({
              targets: this.statementStamp,
              scaleX: finalScaleX,
              scaleY: finalScaleY,
              alpha: 0.78,
              duration: DAY_TRANSITION_CONFIG.statementStampSettleDurationMilliseconds,
              ease: 'Sine.easeOut',
            });
          },
        });
      },
    );
  }

  private showItemArt(image: Phaser.GameObjects.Image, itemId: string, size: number): void {
    const textureKey = itemTextureKey(itemId);
    if (!textureKey) {
      image.setVisible(false);
      return;
    }
    const displaySize = size * (ITEM_ART_SCALE_BY_ID[itemId] ?? 1);
    // 가장 크게 그리는 곳이 190px이라 1254px 원본 대신 256px 썸네일을 쓴다.
    image.setTexture(textureKey)
      .setCrop()
      .setDisplaySize(displaySize, displaySize)
      .setVisible(true);
  }

  private showMerchantItemArt(image: Phaser.GameObjects.Image, itemId: string): void {
    const textureKey = itemTextureKey(itemId);
    if (!textureKey) {
      image.setVisible(false);
      return;
    }
    const itemScale = ITEM_ART_SCALE_BY_ID[itemId] ?? 1;
    const displaySize = Phaser.Math.Clamp(82 * itemScale, 58, 88);
    image.setTexture(textureKey)
      .setCrop()
      .setDisplaySize(displaySize, displaySize)
      .setVisible(true);
  }

  private showToolItemArt(image: Phaser.GameObjects.Image, itemId: string, size: number): void {
    const textureKey = itemTextureKey(itemId);
    if (!textureKey) {
      image.setVisible(false);
      return;
    }
    const displaySize = size * (INVENTORY_ITEM_ART_SCALE_BY_ID[itemId] ?? 0.72);
    image.setTexture(textureKey)
      .setCrop()
      .setDisplaySize(displaySize, displaySize)
      .setVisible(true);
  }
}

/** 초를 m:ss 로 표시한다. */
function formatTime(totalSeconds: number): string {
  const whole = Math.ceil(totalSeconds);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatSignedMoney(amount: number): string {
  const sign = amount >= 0 ? '+' : '-';
  return `${sign}${Math.abs(amount).toLocaleString('ko-KR')}원`;
}

function customerOpeningLine(
  name: string, type: CustomerType, itemName: string, askingPrice: number,
): string {
  const speech = CUSTOMER_SPEECH_BY_NAME[name] ?? CUSTOMER_SPEECH_BY_TYPE[type];
  return speech(itemName, askingPrice.toLocaleString('ko-KR'));
}

function trendLabel(trend: MarketTrend): string {
  switch (trend) {
    case 'down': return '시세 하락';
    case 'normal': return '시세 보통';
    case 'up': return '시세 상승';
  }
}
