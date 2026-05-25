import { beginCell, Cell } from "@ton/core";

export interface BetPayload {
  roundId: number;
  side: 'LONG' | 'SHORT';
  amount: bigint;
}

export function encodeBet(payload: BetPayload): Cell {
  return beginCell()
    .storeUint(payload.roundId, 32)
    .storeBit(payload.side === 'LONG')
    .storeCoins(payload.amount)
    .endCell();
}

export function decodeBet(cell: Cell): BetPayload {
  const slice = cell.beginParse();
  return {
    roundId: slice.loadUint(32),
    side: slice.loadBit() ? 'LONG' : 'SHORT',
    amount: slice.loadCoins(),
  };
}
