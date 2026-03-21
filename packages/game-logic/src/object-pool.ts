export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFn: (obj: T) => void;
  private _activeCount = 0;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number) {
    this.factory = factory;
    this.resetFn = reset;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /** Get an object from the pool or create a new one. */
  acquire(): T {
    this._activeCount++;
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /** Return an object to the pool after resetting it. */
  release(obj: T): void {
    this.resetFn(obj);
    this._activeCount--;
    this.pool.push(obj);
  }

  get activeCount(): number {
    return this._activeCount;
  }
}
