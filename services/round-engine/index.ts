export interface RoundState {
  id: number;
  status: 'OPEN' | 'LOCKED' | 'SETTLING' | 'CLOSED';
  startTime: number;
  p0?: number;
  p1?: number;
}

export class RoundCoordinator {
  private currentRound: RoundState;

  constructor() {
    this.currentRound = {
      id: 1,
      status: 'CLOSED',
      startTime: Date.now(),
    };
  }

  public startNewRound(price: number) {
    this.currentRound = {
      id: this.currentRound.id + 1,
      status: 'OPEN',
      startTime: Date.now(),
      p0: price,
    };
    console.log(`Round ${this.currentRound.id} started at price ${price}`);
  }

  public lockRound() {
    if (this.currentRound.status === 'OPEN') {
      this.currentRound.status = 'LOCKED';
      console.log(`Round ${this.currentRound.id} locked`);
    }
  }

  public settleRound(price: number) {
    if (this.currentRound.status === 'LOCKED') {
      this.currentRound.status = 'SETTLING';
      this.currentRound.p1 = price;
      // Payout logic would go here
      this.currentRound.status = 'CLOSED';
      console.log(`Round ${this.currentRound.id} settled at price ${price}`);
    }
  }

  public getState(): RoundState {
    return this.currentRound;
  }
}
