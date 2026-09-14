import { Suspense, useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { TextureLoader, RepeatWrapping } from "three";

const BASE = import.meta.env.BASE_URL;

type GarmentKey = "suit" | "shirt" | "pants" | "thobe";
type FabricKey = "black" | "navy" | "burgundy";

const FABRICS: Record<
  FabricKey,
  { label: string; src: string; tone: string; arabicTone: string }
> = {
  black: {
    label: "أسود ملكي",
    src: `${BASE}images/fabric-classic-black.png`,
    tone: "#1a1a1a",
    arabicTone: "صوف فاخر",
  },
  navy: {
    label: "كحلي مخطط",
    src: `${BASE}images/fabric-navy-herringbone.png`,
    tone: "#1a2540",
    arabicTone: "هيرنج بون",
  },
  burgundy: {
    label: "خمري ملكي",
    src: `${BASE}images/fabric-burgundy-silk.png`,
    tone: "#3d1820",
    arabicTone: "حرير ملكي",
  },
};

const GARMENTS: Record<GarmentKey, { label: string; emoji: string }> = {
  suit: { label: "بدلة", emoji: "🤵" },
  shirt: { label: "قميص", emoji: "👔" },
  pants: { label: "بنطلون", emoji: "👖" },
  thobe: { label: "جلابية", emoji: "🧕" },
};

// ----- Fabric material with high-detail texture (anisotropy + finer repeat for zoom) -----
function useFabricMaterial(textureSrc: string) {
  const texture = useLoader(TextureLoader, textureSrc);
  return useMemo(() => {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(3, 4);
    texture.anisotropy = 16;
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.78,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
  }, [texture]);
}

// Higher poly counts for smooth zoom-in
const SEG = 48;

function SuitModel({ material }: { material: THREE.Material }) {
  return (
    <group position={[0, -0.2, 0]}>
      {/* Torso */}
      <mesh position={[0, 0.5, 0]} material={material} castShadow receiveShadow>
        <boxGeometry args={[1.4, 1.6, 0.45, 8, 8, 4]} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[0, 1.25, 0]} material={material} castShadow>
        <boxGeometry args={[1.7, 0.25, 0.5, 8, 4, 4]} />
      </mesh>
      {/* Lapels */}
      <mesh
        position={[-0.3, 0.85, 0.24]}
        rotation={[0, 0, 0.15]}
        material={material}
        castShadow
      >
        <boxGeometry args={[0.35, 1.1, 0.04]} />
      </mesh>
      <mesh
        position={[0.3, 0.85, 0.24]}
        rotation={[0, 0, -0.15]}
        material={material}
        castShadow
      >
        <boxGeometry args={[0.35, 1.1, 0.04]} />
      </mesh>
      {/* Sleeves */}
      <mesh
        position={[-1.05, 0.45, 0]}
        rotation={[0, 0, 0.1]}
        material={material}
        castShadow
      >
        <cylinderGeometry args={[0.22, 0.2, 1.6, SEG]} />
      </mesh>
      <mesh
        position={[1.05, 0.45, 0]}
        rotation={[0, 0, -0.1]}
        material={material}
        castShadow
      >
        <cylinderGeometry args={[0.22, 0.2, 1.6, SEG]} />
      </mesh>
      {/* Buttons */}
      {[0.4, 0.0, -0.4].map((y) => (
        <mesh key={y} position={[0, y + 0.2, 0.235]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.02, 24]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.95}
            roughness={0.18}
          />
        </mesh>
      ))}
    </group>
  );
}

function ShirtModel({ material }: { material: THREE.Material }) {
  return (
    <group position={[0, -0.2, 0]}>
      <mesh position={[0, 0.5, 0]} material={material} castShadow receiveShadow>
        <boxGeometry args={[1.3, 1.5, 0.4, 8, 8, 4]} />
      </mesh>
      <mesh position={[0, 1.3, 0.18]} material={material} castShadow>
        <boxGeometry args={[0.5, 0.18, 0.08]} />
      </mesh>
      <mesh position={[0, 1.18, 0]} material={material} castShadow>
        <boxGeometry args={[1.55, 0.2, 0.45]} />
      </mesh>
      <mesh
        position={[-0.95, 0.7, 0]}
        rotation={[0, 0, 0.1]}
        material={material}
        castShadow
      >
        <cylinderGeometry args={[0.2, 0.18, 1.0, SEG]} />
      </mesh>
      <mesh
        position={[0.95, 0.7, 0]}
        rotation={[0, 0, -0.1]}
        material={material}
        castShadow
      >
        <cylinderGeometry args={[0.2, 0.18, 1.0, SEG]} />
      </mesh>
      {[0.7, 0.4, 0.1, -0.2, -0.5].map((y) => (
        <mesh key={y} position={[0, y, 0.21]} castShadow>
          <sphereGeometry args={[0.025, 24, 24]} />
          <meshStandardMaterial
            color="#f5f5f0"
            metalness={0.35}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

function PantsModel({ material }: { material: THREE.Material }) {
  return (
    <group position={[0, -0.2, 0]}>
      <mesh position={[0, 1.3, 0]} material={material} castShadow>
        <boxGeometry args={[1.0, 0.4, 0.4, 8, 4, 4]} />
      </mesh>
      <mesh position={[-0.27, 0.2, 0]} material={material} castShadow>
        <cylinderGeometry args={[0.22, 0.19, 1.9, SEG]} />
      </mesh>
      <mesh position={[0.27, 0.2, 0]} material={material} castShadow>
        <cylinderGeometry args={[0.22, 0.19, 1.9, SEG]} />
      </mesh>
      <mesh position={[0, 1.5, 0.21]} castShadow>
        <boxGeometry args={[1.05, 0.06, 0.02]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.9}
          roughness={0.25}
        />
      </mesh>
      {/* Belt loops */}
      {[-0.4, 0, 0.4].map((x) => (
        <mesh key={x} position={[x, 1.5, 0.22]} castShadow>
          <boxGeometry args={[0.06, 0.12, 0.02]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.9}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

function ThobeModel({ material }: { material: THREE.Material }) {
  return (
    <group position={[0, -0.5, 0]}>
      <mesh position={[0, 0.6, 0]} material={material} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 1.1, 2.6, SEG]} />
      </mesh>
      <mesh position={[0, 1.85, 0]} material={material} castShadow>
        <boxGeometry args={[1.4, 0.25, 0.45]} />
      </mesh>
      <mesh
        position={[-0.95, 1.15, 0]}
        rotation={[0, 0, 0.18]}
        material={material}
        castShadow
      >
        <cylinderGeometry args={[0.28, 0.32, 1.6, SEG]} />
      </mesh>
      <mesh
        position={[0.95, 1.15, 0]}
        rotation={[0, 0, -0.18]}
        material={material}
        castShadow
      >
        <cylinderGeometry args={[0.28, 0.32, 1.6, SEG]} />
      </mesh>
      {/* Neckline gold trim */}
      <mesh position={[0, 1.95, 0.23]} castShadow>
        <boxGeometry args={[0.5, 0.04, 0.02]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.95}
          roughness={0.15}
        />
      </mesh>
      {/* Vertical placket */}
      <mesh position={[0, 1.4, 0.26]} castShadow>
        <boxGeometry args={[0.04, 1.0, 0.01]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

function GarmentScene({
  garment,
  fabric,
  autoRotate,
}: {
  garment: GarmentKey;
  fabric: FabricKey;
  autoRotate: boolean;
}) {
  const material = useFabricMaterial(FABRICS[fabric].src);
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && group.current) {
      group.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group ref={group}>
      {garment === "suit" && <SuitModel material={material} />}
      {garment === "shirt" && <ShirtModel material={material} />}
      {garment === "pants" && <PantsModel material={material} />}
      {garment === "thobe" && <ThobeModel material={material} />}
    </group>
  );
}

function LoadingFallback() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: "rgba(10, 8, 4, 0.6)" }}
    >
      <div
        className="w-12 h-12 rounded-full mb-3 animate-spin"
        style={{
          border: "3px solid #2a2418",
          borderTopColor: "#d4af37",
        }}
      />
      <p className="text-xs" style={{ color: "#d4af37" }}>
        جارٍ تحميل القماشة...
      </p>
    </div>
  );
}

export default function App() {
  const [garment, setGarment] = useState<GarmentKey>("suit");
  const [fabric, setFabric] = useState<FabricKey>("black");
  const [autoRotate, setAutoRotate] = useState(true);
  const [showHint, setShowHint] = useState(true);

  // Auto-hide hint after 5s
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a1610 0%, #0a0806 60%, #000 100%)",
        fontFamily: "'Cairo', 'Tajawal', sans-serif",
      }}
    >
      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div>
          <div
            className="text-[9px] tracking-[0.3em] mb-1"
            style={{ color: "#d4af37" }}
          >
            SHAMS TEX • شمس تكس
          </div>
          <h1
            className="text-2xl font-bold leading-tight"
            style={{
              background:
                "linear-gradient(135deg, #f4d27a 0%, #d4af37 50%, #b8941f 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            رؤية ثلاثية الأبعاد
          </h1>
          <p className="text-[11px] mt-1" style={{ color: "#8a7a5c" }}>
            لف الموديل واقترب لتشاهد تفاصيل القماشة
          </p>
        </div>
      </header>

      {/* 3D Canvas */}
      <div
        className="flex-1 mx-3 rounded-2xl overflow-hidden relative"
        style={{
          border: "1px solid #2a2418",
          background:
            "linear-gradient(180deg, rgba(40,32,18,0.4) 0%, rgba(10,8,4,0.95) 100%)",
          minHeight: 320,
        }}
      >
        <Canvas
          camera={{ position: [0, 0.5, 4.5], fov: 38 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
          dpr={[1, 2]}
          shadows
        >
          <color attach="background" args={["#0a0806"]} />
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[3, 5, 5]}
            intensity={1.3}
            color="#fff5e0"
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight
            position={[-3, 2, -3]}
            intensity={0.4}
            color="#d4af37"
          />
          <directionalLight
            position={[0, -2, 3]}
            intensity={0.15}
            color="#fff"
          />
          <Suspense fallback={null}>
            <Environment preset="apartment" />
            <GarmentScene
              garment={garment}
              fabric={fabric}
              autoRotate={autoRotate}
            />
            <ContactShadows
              position={[0, -1.4, 0]}
              opacity={0.55}
              scale={6}
              blur={2.5}
              far={4}
            />
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={1.5}
            maxDistance={8}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.6}
            onStart={() => setAutoRotate(false)}
          />
        </Canvas>

        {/* Hint badge */}
        {showHint && (
          <div
            onClick={() => setShowHint(false)}
            className="absolute top-3 left-3 right-3 px-4 py-2.5 rounded-xl text-xs text-center"
            style={{
              background: "rgba(10, 8, 4, 0.85)",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              color: "#f4d27a",
              backdropFilter: "blur(10px)",
            }}
          >
            ✋ اسحب للتدوير • 🔍 قرّب الإصبعين للتكبير
          </div>
        )}

        {/* Bottom-left fabric tag */}
        <div
          className="absolute bottom-3 left-3 px-3 py-2 rounded-xl flex items-center gap-2"
          style={{
            background: "rgba(10, 8, 4, 0.85)",
            border: "1px solid rgba(212, 175, 55, 0.3)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="w-7 h-7 rounded-md"
            style={{
              backgroundImage: `url(${FABRICS[fabric].src})`,
              backgroundSize: "cover",
              border: "1px solid rgba(212, 175, 55, 0.4)",
            }}
          />
          <div>
            <div
              className="text-[10px] font-bold leading-tight"
              style={{ color: "#f4d27a" }}
            >
              {FABRICS[fabric].label}
            </div>
            <div
              className="text-[9px] leading-tight"
              style={{ color: "#8a7a5c" }}
            >
              {FABRICS[fabric].arabicTone}
            </div>
          </div>
        </div>

        {/* Auto-rotate toggle */}
        <button
          onClick={() => setAutoRotate((v) => !v)}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-base"
          style={{
            background: autoRotate
              ? "rgba(212, 175, 55, 0.2)"
              : "rgba(10, 8, 4, 0.85)",
            border: `1px solid ${
              autoRotate ? "#d4af37" : "rgba(212, 175, 55, 0.3)"
            }`,
            color: "#d4af37",
            backdropFilter: "blur(8px)",
          }}
          aria-label="تشغيل/إيقاف الدوران التلقائي"
        >
          {autoRotate ? "⏸" : "↻"}
        </button>
      </div>

      {/* Fabric selector */}
      <div className="px-3 mt-4">
        <div
          className="text-[10px] mb-2 tracking-widest"
          style={{ color: "#8a7a5c" }}
        >
          القماش
        </div>
        <div className="flex gap-2.5">
          {(Object.keys(FABRICS) as FabricKey[]).map((key) => {
            const f = FABRICS[key];
            const active = key === fabric;
            return (
              <button
                key={key}
                onClick={() => setFabric(key)}
                className="flex-1 rounded-xl overflow-hidden flex flex-col items-center pt-2 pb-2 transition-all"
                style={{
                  border: `2px solid ${active ? "#d4af37" : "#2a2418"}`,
                  background: active
                    ? "rgba(212, 175, 55, 0.1)"
                    : "rgba(20, 16, 10, 0.4)",
                  transform: active ? "translateY(-2px)" : "none",
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg mb-1.5"
                  style={{
                    backgroundImage: `url(${f.src})`,
                    backgroundSize: "cover",
                    boxShadow: active
                      ? "0 4px 12px rgba(212,175,55,0.35)"
                      : "none",
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: active ? "#d4af37" : "#7a6a4c" }}
                >
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Garment selector */}
      <div className="px-3 mt-3 mb-3">
        <div
          className="text-[10px] mb-2 tracking-widest"
          style={{ color: "#8a7a5c" }}
        >
          الموديل
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(GARMENTS) as GarmentKey[]).map((key) => {
            const g = GARMENTS[key];
            const active = key === garment;
            return (
              <button
                key={key}
                onClick={() => setGarment(key)}
                className="rounded-xl py-2.5 flex flex-col items-center gap-0.5 transition-all"
                style={{
                  border: `1.5px solid ${active ? "#d4af37" : "#2a2418"}`,
                  background: active
                    ? "linear-gradient(180deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.05) 100%)"
                    : "rgba(20, 16, 10, 0.4)",
                }}
              >
                <span className="text-2xl">{g.emoji}</span>
                <span
                  className="text-[11px] font-medium"
                  style={{ color: active ? "#f4d27a" : "#7a6a4c" }}
                >
                  {g.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="px-3 pb-4">
        <button
          className="w-full py-3.5 rounded-xl font-bold text-sm"
          style={{
            background: "linear-gradient(135deg, #d4af37 0%, #b8941f 100%)",
            color: "#0a0806",
            boxShadow: "0 8px 24px rgba(212, 175, 55, 0.3)",
          }}
        >
          اطلب {GARMENTS[garment].label} • {FABRICS[fabric].label}
        </button>
      </div>

      {/* Suspense overlay */}
      <Suspense fallback={<LoadingFallback />}>
        <></>
      </Suspense>
    </div>
  );
}
