export class FirstUseGuideGate {
  private claimed = false;

  trySchedule(alreadySeen: boolean): boolean {
    if (this.claimed) return false;
    this.claimed = true;
    return !alreadySeen;
  }
}
