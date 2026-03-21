import type { GameEvent } from '@curious/shared';

type EventListener = (event: GameEvent) => void;

class GameEventBus {
  private listeners: EventListener[] = [];

  subscribe(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const eventBus = new GameEventBus();
