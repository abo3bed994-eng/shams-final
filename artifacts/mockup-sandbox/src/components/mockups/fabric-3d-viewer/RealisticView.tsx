import { Suspense, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { TextureLoader, RepeatWrapping } from "three";

type GarmentKey = "suit" | "shirt" | "pants" | "thobe";
type FabricKey = "black" | "navy" | "burgundy";

const FABRICS: Record<FabricKey, { label: string; src: string; tone: string }> = {
  black: {
    label: "أسود ملكي",
    src: "/__mockup/images/fabric-classic-black.png",
    tone: "#1a1a1a",
  },
  navy: {
    label: "كحلي مخطط",
    src: "/__mockup/images/fabric-navy-herringbone.png",
    tone: "#1a2540",
  },
  burgundy: {
    label: "خمري ملكي",
    src: "/__mockup/images/fabric-burgundy-silk.png",
    tone: "#3d1820",
  },
};

const GARMENTS: Record<GarmentKey, { label: string; emoji: string }> = {
  suit: { label: "بدلة", emoji: "🤵" },
  shirt: { label: "قميص", emoji: "👔" },
  pants: { label: "بنطلون", emoji: "👖" },
  thobe: { label: "جلابية", emoji: "🧕" },
};

// ----- Fabric material with texture -----
function useFabricMaterial(textureSrc: string) {
  const texture = useLoader(TextureLoader, textureSrc);
  return useMemo(() => {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(2, 2.5);
    texture.anisotropy = 16;
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.75,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
  }, [texture]);
}

// ----- 3D Garment Models (parametric) -----
function SuitModel({ material }: { material: THREE.Material }) {
  const group = useRef<THREE.Group>(null);
  return (
    <group ref={group} position={[0, -0.2, 0]}>
      {/* Torso (jacket body) */}
      <mesh position={[0, 0.5, 0]} material={material}>
        <boxGeometry args={[1.4, 1.6, 0.45]} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[0, 1.25, 0]} material={material}>
        <boxGeometry args={[1.7, 0.25, 0.5]} />
      </mesh>
      {/* Left lapel */}
      <mesh position={[-0.3, 0.85, 0.24]} rotation={[0, 0, 0.15]} material={material}>
        <boxGeometry args={[0.35, 1.1, 0.04]} />
      </mesh>
      {/* Right lapel */}
      <mesh position={[0.3, 0.85, 0.24]} rotation={[0, 0, -0.15]} material={material}>
        <boxGeometry args={[0.35, 1.1, 0.04]} />
      </mesh>
      {/* Left sleeve */}
      <mesh position={[-1.05, 0.45, 0]} rotation={[0, 0, 0.1]} material={material}>
        <cylinderGeometry args={[0.22, 0.2, 1.6, 24]} />
      </mesh>
      {/* Right sleeve */}
      <mesh position={[1.05, 0.45, 0]} rotation={[0, 0, -0.1]} material={material}>
        <cylinderGeometry args={[0.22, 0.2, 1.6, 24]} />
      </mesh>
      {/* Buttons (gold) */}
      {[0.4, 0.0, -0.4].map((y) => (
        <mesh key={y} position={[0, y + 0.2, 0.235]}>
          <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function ShirtModel({ material }: { material: THREE.Material }) {
  return (
    <group position={[0, -0.2, 0]}>
      {/* Body */}
      <mesh position={[0, 0.5, 0]} material={material}>
        <boxGeometry args={[1.3, 1.5, 0.4]} />
      </mesh>
      {/* Collar */}
      <mesh position={[0, 1.3, 0.18]} material={material}>
        <boxGeometry args={[0.5, 0.18, 0.08]} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[0, 1.18, 0]} material={material}>
        <boxGeometry args={[1.55, 0.2, 0.45]} />
      </mesh>
      {/* Left sleeve (short — rolled up) */}
      <mesh position={[-0.95, 0.7, 0]} rotation={[0, 0, 0.1]} material={material}>
        <cylinderGeometry args={[0.2, 0.18, 1.0, 24]} />
      </mesh>
      {/* Right sleeve */}
      <mesh position={[0.95, 0.7, 0]} rotation={[0, 0, -0.1]} material={material}>
        <cylinderGeometry args={[0.2, 0.18, 1.0, 24]} />
      </mesh>
      {/* Pearl buttons */}
      {[0.7, 0.4, 0.1, -0.2, -0.5].map((y) => (
        <mesh key={y} position={[0, y, 0.21]}>
          <sphereGeometry args={[0.025, 16, 16]} />
          <meshStandardMaterial color="#f5f5f0" metalness={0.3} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function PantsModel({ material }: { material: THREE.Material }) {
  return (
    <group position={[0, -0.2, 0]}>
      {/* Waist */}
      <mesh position={[0, 1.3, 0]} material={material}>
        <boxGeometry args={[1.0, 0.4, 0.4]} />
      </mesh>
      {/* Left leg */}
      <mesh position={[-0.27, 0.2, 0]} material={material}>
        <cylinderGeometry args={[0.22, 0.19, 1.9, 24]} />
      </mesh>
      {/* Right leg */}
      <mesh position={[0.27, 0.2, 0]} material={material}>
        <cylinderGeometry args={[0.22, 0.19, 1.9, 24]} />
      </mesh>
      {/* Belt loops (gold accents) */}
      <mesh position={[0, 1.5, 0.21]}>
        <boxGeometry args={[1.05, 0.06, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

function ThobeModel({ material }: { material: THREE.Material }) {
  return (
    <group position={[0, -0.5, 0]}>
      {/* Body — long flowing robe (cone) */}
      <mesh position={[0, 0.6, 0]} material={material}>
        <cylinderGeometry args={[0.55, 1.1, 2.6, 32]} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[0, 1.85, 0]} material={material}>
        <boxGeometry args={[1.4, 0.25, 0.45]} />
      </mesh>
      {/* Left sleeve */}
      <mesh position={[-0.95, 1.15, 0]} rotation={[0, 0, 0.18]} material={material}>
        <cylinderGeometry args={[0.28, 0.32, 1.6, 24]} />
      </mesh>
      {/* Right sleeve */}
      <mesh position={[0.95, 1.15, 0]} rotation={[0, 0, -0.18]} material={material}>
        <cylinderGeometry args={[0.28, 0.32, 1.6, 24]} />
      </mesh>
      {/* Collar trim (gold) */}
      <mesh position={[0, 1.95, 0.23]}>
        <boxGeometry args={[0.5, 0.04, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
      </mesh>
    </group>
  );
}

function GarmentScene({ garment, fabric }: { garment: GarmentKey; fabric: FabricKey }) {
  const material = useFabricMaterial(FABRICS[fabric].src);
  const group = useRef<THREE.Group>(null);

  // Slow auto-rotate when user not interacting
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.15;
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

// ----- Main page -----
export function RealisticView() {
  const [garment, setGarment] = useState<GarmentKey>("suit");
  const [fabric, setFabric] = useState<FabricKey>("black");

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a1610 0%, #0a0806 60%, #000 100%)",
        fontFamily: "'Cairo', 'Tajawal', sans-serif",
      }}
    >
      {/* Top bar */}
      <header className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div>
          <div
            className="text-[10px] tracking-[0.3em] mb-1"
            style={{ color: "#d4af37" }}
          >
            SHAMS TEX • شمس تكس
          </div>
          <h1
            className="text-2xl font-bold"
            style={{
              background: "linear-gradient(135deg, #f4d27a 0%, #d4af37 50%, #b8941f 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            رؤية واقعية
          </h1>
          <p className="text-xs mt-1" style={{ color: "#8a7a5c" }}>
            شاهد قماشتك على الموديل من كل الزوايا
          </p>
        </div>
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            border: "1px solid #2a2418",
            background: "rgba(20, 16, 10, 0.6)",
            color: "#d4af37",
          }}
        >
          ✕
        </button>
      </header>

      {/* 3D Canvas */}
      <div
        className="flex-1 mx-4 rounded-2xl overflow-hidden relative"
        style={{
          border: "1px solid #2a2418",
          background:
            "linear-gradient(180deg, rgba(40,32,18,0.4) 0%, rgba(10,8,4,0.9) 100%)",
          minHeight: "380px",
        }}
      >
        <Canvas
          camera={{ position: [0, 0.5, 4.5], fov: 38 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#0a0806"]} />
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[3, 5, 5]}
            intensity={1.2}
            color="#fff5e0"
            castShadow
          />
          <directionalLight position={[-3, 2, -3]} intensity={0.3} color="#d4af37" />
          <Suspense fallback={null}>
            <GarmentScene garment={garment} fabric={fabric} />
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
            minDistance={3}
            maxDistance={7}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Canvas>
        {/* Hint badge */}
        <div
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-[10px]"
          style={{
            background: "rgba(212, 175, 55, 0.12)",
            border: "1px solid rgba(212, 175, 55, 0.3)",
            color: "#d4af37",
            backdropFilter: "blur(8px)",
          }}
        >
          ✋ اسحب للتدوير • ⊕ لتغيير الحجم
        </div>
      </div>

      {/* Fabric selector */}
      <div className="px-4 mt-4">
        <div
          className="text-[10px] mb-2 tracking-widest"
          style={{ color: "#8a7a5c" }}
        >
          القماش
        </div>
        <div className="flex gap-3">
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
                    ? "rgba(212, 175, 55, 0.08)"
                    : "rgba(20, 16, 10, 0.4)",
                  transform: active ? "translateY(-2px)" : "none",
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg mb-1.5"
                  style={{
                    backgroundImage: `url(${f.src})`,
                    backgroundSize: "cover",
                    boxShadow: active ? "0 4px 12px rgba(212,175,55,0.3)" : "none",
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
      <div className="px-4 mt-4 mb-4">
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
                className="rounded-xl py-3 flex flex-col items-center gap-1 transition-all"
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
      <div className="px-4 pb-6">
        <button
          className="w-full py-3.5 rounded-xl font-bold text-sm"
          style={{
            background: "linear-gradient(135deg, #d4af37 0%, #b8941f 100%)",
            color: "#0a0806",
            boxShadow: "0 8px 24px rgba(212, 175, 55, 0.3)",
          }}
        >
          أضف للسلة • قماش {FABRICS[fabric].label}
        </button>
      </div>
    </div>
  );
}
