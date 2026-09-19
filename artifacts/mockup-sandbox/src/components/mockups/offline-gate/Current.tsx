import "./_group.css";
import { RefreshCw, Wifi } from "lucide-react";
import { useState } from "react";

export function Current() {
  const [checking, setChecking] = useState(false);

  const retry = () => {
    setChecking(true);
    window.setTimeout(() => setChecking(false), 900);
  };

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 28,
        color: "#fff",
        background:
          "radial-gradient(circle at 50% 38%, rgba(176,146,69,0.12), transparent 34%), #090909",
      }}
    >
      <section
        style={{
          width: "min(100%, 360px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "28px 24px",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: 28,
          background: "rgba(20,20,20,0.88)",
          boxShadow: "0 20px 48px rgba(0,0,0,0.36)",
        }}
      >
        <div
          aria-label="لا يوجد اتصال"
          style={{
            width: 96,
            height: 96,
            display: "grid",
            placeItems: "center",
            marginBottom: 10,
            border: "1px solid #b09245",
            borderRadius: "50%",
            background: "rgba(176,146,69,0.08)",
            boxShadow: "0 0 28px rgba(176,146,69,0.28)",
          }}
        >
          <div
            style={{
              width: 78,
              height: 78,
              position: "relative",
              display: "grid",
              placeItems: "center",
              border: "1.5px solid #b09245",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.55)",
            }}
          >
            <span className="offline-wifi-pulse" />
            <span className="offline-wifi-symbol">
              <Wifi size={42} strokeWidth={2.35} color="#b09245" />
              <span className="offline-wifi-dot" />
            </span>
          </div>
        </div>

        <h1
          style={{
            margin: 0,
            color: "#b09245",
            fontSize: 22,
            lineHeight: 1.35,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          لا يوجد اتصال بالإنترنت
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            color: "rgba(255,255,255,0.85)",
            fontSize: 14,
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          سيعود التطبيق تلقائياً بمجرد عودة الاتصال.
        </p>

        <button
          type="button"
          onClick={retry}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 18,
            padding: "12px 22px",
            border: 0,
            borderRadius: 16,
            color: "#000",
            background: "#b09245",
            font: "700 14px Inter, Arial, sans-serif",
            cursor: "pointer",
            opacity: checking ? 0.7 : 1,
          }}
        >
          <RefreshCw size={16} />
          {checking ? "جارٍ التحقق..." : "إعادة المحاولة"}
        </button>
      </section>
    </main>
  );
}