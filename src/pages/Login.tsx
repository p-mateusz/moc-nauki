import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const storedUserId = localStorage.getItem("userId");
      if (session && storedUserId && storedUserId !== "guest") {
        navigate("/dashboard", { replace: true });
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Podaj nazwę użytkownika i hasło");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-login", {
        body: { username: username.trim(), password },
      });
      if (error) {
        const message = (error as any)?.context?.error || (error as any)?.message || "Nieprawidłowa nazwa użytkownika lub hasło";
        toast.error(message);
        return;
      }
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      localStorage.removeItem("guestMode");
      localStorage.removeItem("guestListId");
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("userName", data.name);
      localStorage.setItem("userUsername", data.username);
      localStorage.setItem("userRole", data.role || "uczeń");
      navigate("/dashboard");
    } catch (e: any) {
      toast.error("Nieprawidłowa nazwa użytkownika lub hasło");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const ready = username.trim() && password.trim() && !loading;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060d1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 20px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Blobs */}
      <div style={{
        position: "fixed", top: "-20%", left: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-20%", right: "-10%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: ".72rem", fontWeight: 700, color: "#3b82f6",
            letterSpacing: ".12em", marginBottom: 10,
          }}>
            MOC NAUKI
          </div>
          <h1 style={{
            fontSize: "clamp(1.6rem, 4vw, 2rem)", fontWeight: 900,
            color: "#fff", margin: 0, lineHeight: 1.2,
          }}>
            Witaj z powrotem.
          </h1>
          <p style={{ color: "#8899b4", fontSize: ".87rem", marginTop: 8 }}>
            Zaloguj się i wróć do nauki
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#0f1117",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(59,130,246,0.08), 0 24px 48px rgba(0,0,0,0.5)",
        }}>
          {/* Top accent */}
          <div style={{
            height: 3,
            background: "linear-gradient(90deg, #3b82f6, #6366f1, #a78bfa)",
          }} />

          <div style={{ padding: "32px 28px" }}>
            {/* Username */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: ".65rem", fontWeight: 700, color: "#475569",
                letterSpacing: ".08em", marginBottom: 6,
              }}>
                NAZWA UŻYTKOWNIKA
              </div>
              <input
                type="text"
                placeholder="np. jan_kowalski"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: username ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  color: "#f1f5f9", borderRadius: 12,
                  padding: "13px 16px", fontSize: ".92rem",
                  fontFamily: "inherit", outline: "none",
                  transition: "border-color .2s",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: ".65rem", fontWeight: 700, color: "#475569",
                letterSpacing: ".08em", marginBottom: 6,
              }}>
                HASŁO
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: password ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: "#f1f5f9", borderRadius: 12,
                    padding: "13px 46px 13px 16px",
                    fontSize: ".92rem", fontFamily: "inherit",
                    outline: "none", transition: "border-color .2s",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                  onTouchStart={() => setShowPassword(true)}
                  onTouchEnd={() => setShowPassword(false)}
                  style={{
                    position: "absolute", right: 14, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    color: "#475569", cursor: "pointer",
                    padding: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* CTA */}
            <motion.button
              onClick={handleLogin}
              disabled={!ready}
              whileHover={ready ? { scale: 1.02, boxShadow: "0 8px 30px rgba(59,130,246,0.45)" } : {}}
              whileTap={ready ? { scale: 0.98 } : {}}
              style={{
                width: "100%",
                background: ready
                  ? "linear-gradient(135deg, #3b82f6, #6366f1)"
                  : "rgba(59,130,246,0.2)",
                color: ready ? "#fff" : "#475569",
                border: "none", padding: "14px",
                borderRadius: 12, fontWeight: 700,
                fontSize: ".95rem", cursor: ready ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                boxShadow: ready ? "0 4px 20px rgba(59,130,246,0.3)" : "none",
                transition: "all .25s",
              }}
            >
              {loading ? "Logowanie..." : "Zaloguj się →"}
            </motion.button>
          </div>
        </div>

        {/* Footer links */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <p style={{ color: "#8899b4", fontSize: ".84rem", marginBottom: 10 }}>
            Nie masz konta?{" "}
            <span
              onClick={() => navigate("/register")}
              style={{ color: "#60a5fa", cursor: "pointer", fontWeight: 600 }}
            >
              Załóż konto
            </span>
          </p>
            <button onClick={() => navigate("/")} style={{ marginTop: 16, background: "none", border: "none", color: "#60a5fa", fontSize: ".86rem", cursor: "pointer", fontFamily: "inherit" }}>
             ← Wróć na stronę główną
            </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
