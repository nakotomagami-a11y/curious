import * as THREE from 'three';
import { extend } from '@react-three/fiber';

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vViewPosition;

  // Shadow support — manual declarations (no #include)
  #ifdef USE_SHADOWMAP
    #if NUM_DIR_LIGHT_SHADOWS > 0
      uniform mat4 directionalShadowMatrix[NUM_DIR_LIGHT_SHADOWS];
      varying vec4 vDirectionalShadowCoord[NUM_DIR_LIGHT_SHADOWS];
    #endif
  #endif

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = mvPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;

    // Compute shadow coordinates
    #ifdef USE_SHADOWMAP
      #if NUM_DIR_LIGHT_SHADOWS > 0
        vDirectionalShadowCoord[0] = directionalShadowMatrix[0] * worldPos;
      #endif
    #endif
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uDissolveProgress;
  uniform vec3 uEdgeColor;
  uniform float uEdgeWidth;
  uniform float uAmbientLight;
  uniform vec3 uLightDir;
  uniform float uMarbleStrength;
  uniform float uMetalness;
  uniform float uRoughness;
  uniform vec3 uRimLightDir;
  uniform vec3 uRimLightColor;
  uniform vec3 uEmissive;
  uniform float uEmissiveIntensity;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vViewPosition;

  #if NUM_POINT_LIGHTS > 0
  struct PointLight {
    vec3 position;
    vec3 color;
    float distance;
    float decay;
  };
  uniform PointLight pointLights[NUM_POINT_LIGHTS];
  #endif

  // Shadow support — manual declarations (no #include)
  #ifdef USE_SHADOWMAP
    #if NUM_DIR_LIGHT_SHADOWS > 0
      uniform sampler2D directionalShadowMap[NUM_DIR_LIGHT_SHADOWS];
      varying vec4 vDirectionalShadowCoord[NUM_DIR_LIGHT_SHADOWS];
    #endif
  #endif

  // Hash-based 3D value noise
  float hash(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.zxy + 19.19);
    return fract(p.x * p.y * p.z);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    // Multi-octave noise for organic dissolve pattern
    float noiseVal = noise3D(vWorldPosition * 0.06) * 0.6
                   + noise3D(vWorldPosition * 0.13) * 0.3
                   + noise3D(vWorldPosition * 0.26) * 0.1;

    // Discard dissolved fragments
    if (uDissolveProgress > 0.001 && noiseVal < uDissolveProgress) {
      discard;
    }

    // ── Diffuse (Lambert) ──────────────────────────────────
    float NdotL = max(dot(N, uLightDir), 0.0);
    float directional = (1.0 - uAmbientLight) * NdotL;
    float light = uAmbientLight + directional;

    // Rim light diffuse contribution
    float rimNdotL = max(dot(N, uRimLightDir), 0.0);
    light += rimNdotL * 0.3;

    // ── Shadow map — darken directional contribution ────────
    #ifdef USE_SHADOWMAP
    #if NUM_DIR_LIGHT_SHADOWS > 0
    {
      vec4 sc = vDirectionalShadowCoord[0];
      sc.xyz /= sc.w;
      sc.xyz = sc.xyz * 0.5 + 0.5;

      float shadow = 1.0;
      if (sc.x >= 0.0 && sc.x <= 1.0 && sc.y >= 0.0 && sc.y <= 1.0 && sc.z < 1.0) {
        // 4-tap PCF for slightly soft edges
        float texelSize = 1.0 / 2048.0;
        float bias = 0.003;
        shadow = 0.0;
        shadow += step(sc.z - bias, texture2D(directionalShadowMap[0], sc.xy + vec2(-0.5, -0.5) * texelSize).r);
        shadow += step(sc.z - bias, texture2D(directionalShadowMap[0], sc.xy + vec2( 0.5, -0.5) * texelSize).r);
        shadow += step(sc.z - bias, texture2D(directionalShadowMap[0], sc.xy + vec2(-0.5,  0.5) * texelSize).r);
        shadow += step(sc.z - bias, texture2D(directionalShadowMap[0], sc.xy + vec2( 0.5,  0.5) * texelSize).r);
        shadow *= 0.25;
      }

      // Re-compose light with shadow on directional part only
      light = uAmbientLight + directional * shadow + rimNdotL * 0.3;
    }
    #endif
    #endif

    vec3 baseColor = uColor * light;

    // ── Blinn-Phong Specular (key light) ───────────────────
    float shininess = 2.0 / (uRoughness * uRoughness + 0.001) - 2.0;
    shininess = clamp(shininess, 8.0, 256.0);

    vec3 H = normalize(uLightDir + V);
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, shininess);

    // Metallic: specular is tinted by base color; dielectric: white specular
    vec3 specColor = mix(vec3(0.04), uColor, uMetalness);
    vec3 specContrib = specColor * spec * 1.2;

    // ── Specular from rim light ────────────────────────────
    vec3 H2 = normalize(uRimLightDir + V);
    float NdotH2 = max(dot(N, H2), 0.0);
    float spec2 = pow(NdotH2, shininess * 0.7); // slightly softer
    vec3 rimSpecContrib = specColor * spec2 * uRimLightColor * 0.8;

    // ── Fresnel Rim ────────────────────────────────────────
    float fresnel = 1.0 - max(dot(N, V), 0.0);
    fresnel = pow(fresnel, 3.0);
    // Metallic fresnel reflects base color; dielectric reflects white
    vec3 fresnelColor = mix(vec3(0.6), uColor * 0.8, uMetalness);
    vec3 fresnelContrib = fresnelColor * fresnel * 0.4;

    // ── Combine ────────────────────────────────────────────
    vec3 finalColor = baseColor + specContrib + rimSpecContrib + fresnelContrib;

    // ── Dynamic point lights (hit flash glow spill) ────────
    #if NUM_POINT_LIGHTS > 0
    {
      vec3 viewN = normalize(vNormal);
      vec3 viewV = -normalize(vViewPosition);
      for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
        vec3 plDir = pointLights[i].position - vViewPosition;
        float plDist = length(plDir);
        plDir /= plDist;
        float plAtten = 1.0 - smoothstep(0.0, pointLights[i].distance, plDist);
        // Diffuse
        float plNdotL = max(dot(viewN, plDir), 0.0);
        finalColor += uColor * pointLights[i].color * plNdotL * plAtten * 0.01;
        // Specular (Blinn-Phong)
        vec3 plH = normalize(plDir + viewV);
        float plNdotH = max(dot(viewN, plH), 0.0);
        float plSpec = pow(plNdotH, shininess);
        finalColor += specColor * pointLights[i].color * plSpec * plAtten * 0.006;
      }
    }
    #endif

    // ── Marble veining (optional layer) ────────────────────
    if (uMarbleStrength > 0.0) {
      float warp = noise3D(vWorldPosition * 0.08) * 4.0
                 + noise3D(vWorldPosition * 0.16) * 2.0;
      float vein = sin(vWorldPosition.y * 0.3 + vWorldPosition.x * 0.15 + warp);
      vein = 1.0 - smoothstep(-0.1, 0.3, abs(vein));

      float cloud = noise3D(vWorldPosition * 0.05) * 0.3;

      vec3 marbleColor = finalColor * (1.0 - vein * 0.4 - cloud * 0.12);
      finalColor = mix(finalColor, marbleColor, uMarbleStrength);
    }

    // ── Emissive glow (hit flash, effects) ─────────────────
    finalColor += uEmissive * uEmissiveIntensity;

    // ── Edge glow at dissolve boundary ─────────────────────
    if (uDissolveProgress > 0.001) {
      float edgeDist = noiseVal - uDissolveProgress;
      float edgeFactor = 1.0 - smoothstep(0.0, uEdgeWidth, edgeDist);
      finalColor = mix(finalColor, uEdgeColor, edgeFactor);
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class DissolveMaterialImpl extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: THREE.UniformsUtils.merge([
        {
          uColor: { value: new THREE.Color('#cc4444') },
          uDissolveProgress: { value: 0.0 },
          uEdgeColor: { value: new THREE.Color('#ff8844') },
          uEdgeWidth: { value: 0.08 },
          uAmbientLight: { value: 0.18 },
          uLightDir: { value: new THREE.Vector3(0.3, 0.8, -0.3).normalize() },
          uMarbleStrength: { value: 0.0 },
          uMetalness: { value: 0.7 },
          uRoughness: { value: 0.35 },
          uRimLightDir: { value: new THREE.Vector3(-0.2, 0.5, -0.8).normalize() },
          uRimLightColor: { value: new THREE.Color('#aaccff') },
          uEmissive: { value: new THREE.Color('#000000') },
          uEmissiveIntensity: { value: 0.0 },
        },
        THREE.UniformsLib.lights,
      ]),
      vertexShader,
      fragmentShader,
      lights: true,
    });
  }

  get color() {
    return this.uniforms.uColor.value;
  }
  set color(v: any) {
    if (v instanceof THREE.Color) {
      this.uniforms.uColor.value.copy(v);
    } else {
      this.uniforms.uColor.value.set(v);
    }
  }

  get dissolveProgress() {
    return this.uniforms.uDissolveProgress.value;
  }
  set dissolveProgress(v: number) {
    this.uniforms.uDissolveProgress.value = v;
  }

  get edgeColor() {
    return this.uniforms.uEdgeColor.value;
  }
  set edgeColor(v: any) {
    if (v instanceof THREE.Color) {
      this.uniforms.uEdgeColor.value.copy(v);
    } else {
      this.uniforms.uEdgeColor.value.set(v);
    }
  }

  get edgeWidth() {
    return this.uniforms.uEdgeWidth.value;
  }
  set edgeWidth(v: number) {
    this.uniforms.uEdgeWidth.value = v;
  }

  get marbleStrength() {
    return this.uniforms.uMarbleStrength.value;
  }
  set marbleStrength(v: number) {
    this.uniforms.uMarbleStrength.value = v;
  }

  get metalness() {
    return this.uniforms.uMetalness.value;
  }
  set metalness(v: number) {
    this.uniforms.uMetalness.value = v;
  }

  get roughness() {
    return this.uniforms.uRoughness.value;
  }
  set roughness(v: number) {
    this.uniforms.uRoughness.value = v;
  }

  get emissive() {
    return this.uniforms.uEmissive.value;
  }
  set emissive(v: any) {
    if (v instanceof THREE.Color) {
      this.uniforms.uEmissive.value.copy(v);
    } else {
      this.uniforms.uEmissive.value.set(v);
    }
  }

  get emissiveIntensity() {
    return this.uniforms.uEmissiveIntensity.value;
  }
  set emissiveIntensity(v: number) {
    this.uniforms.uEmissiveIntensity.value = v;
  }
}

extend({ DissolveMaterial: DissolveMaterialImpl });

// TypeScript JSX declaration for R3F custom element
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      dissolveMaterial: any;
    }
  }
}
