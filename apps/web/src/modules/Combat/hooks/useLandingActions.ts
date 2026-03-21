import { useState, useCallback, FormEvent } from 'react';
import { useAppStore } from '@lib/stores/app-store';
import { initAudio } from '@modules/Audio/audio-engine';
import { playUiConfirm } from '@modules/Audio/sounds';

const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 16;

function sanitizeName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_ -]/g, '').trim();
}

export function useLandingActions() {
  const [name, setName] = useState('');
  const setPlayerName = useAppStore((s) => s.setPlayerName);
  const setScene = useAppStore((s) => s.setScene);

  const sanitized = sanitizeName(name);
  const canSubmit = sanitized.length >= MIN_NAME_LENGTH && sanitized.length <= MAX_NAME_LENGTH;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      initAudio();
      playUiConfirm();

      setPlayerName(sanitized);
      setScene('mode-select');
    },
    [canSubmit, sanitized, setPlayerName, setScene]
  );

  return { name, setName, handleSubmit, canSubmit };
}
