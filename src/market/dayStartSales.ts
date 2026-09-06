/** 새 게임 첫 영업에는 판매할 재고가 없으므로 판매 단계를 생략한다. */
export function shouldOpenDayStartSales(stage: number, day: number, inventorySize: number): boolean {
  return !(stage === 1 && day === 1 && inventorySize === 0);
}
