import { Environment } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  Noise,
  N8AO,
  SMAA,
} from "@react-three/postprocessing";

export function PostProcessing() {
  return (
    <>
      <Environment
        preset="studio"
        environmentIntensity={0.2}
        background={false}
      />
      <EffectComposer>
        <SMAA key="smaa" />
        <N8AO key="n8ao" halfRes aoSamples={8} aoRadius={0.3} intensity={1.6} />
        <Bloom
          key="bloom"
          intensity={0.75}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.25}
          kernelSize={5}
          mipmapBlur
        />

        <HueSaturation key="hs" saturation={0.2} />
        <Noise key="noise" opacity={0.035} />
        <Vignette key="vignette" darkness={0.5} />
      </EffectComposer>
    </>
  );
}
