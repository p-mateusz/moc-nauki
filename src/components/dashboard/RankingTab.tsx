import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchTests, Test,
  BADGES, getEarnedFromTests, ptsFromTests, calcStreak, avInitials,
} from "@/lib/testsStore";
import UserProfileModal from "./UserProfileModal";

interface Props { userName: string; guestMode?: boolean }

type SortKey = "points" | "tests" | "likes" | "uses";

interface DBUser {
  id: string;
  name: string;
  avatar_color?: string;
  avatar_url?: string | null;
  activityDays: string[];
}

const RankingTab = ({ userName, guestMode }: Props) => {
  const userId = localStorage.getItem("userId") || "";
  const [allTests, setAllTests] = useState<Test[]>([]);
  const [sort, setSort] = useState<SortKey>("points");
  const [dbUsers, setDbUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (guestMode) {
        const demoUsers: DBUser[] = [
          { id: "demo1", name: "Anna Kowalska", avatar_color: "av-c1", avatar_url: null, activityDays: Array.from({ length: 60 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo2", name: "Michał Wiśniewski", avatar_color: "av-c2", avatar_url: null, activityDays: Array.from({ length: 45 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo3", name: "Katarzyna Nowak", avatar_color: "av-c3", avatar_url: null, activityDays: Array.from({ length: 50 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo4", name: "Piotr Lewandowski", avatar_color: "av-c4", avatar_url: null, activityDays: Array.from({ length: 40 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo5", name: "Maria Szymankowska", avatar_color: "av-c5", avatar_url: null, activityDays: Array.from({ length: 55 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo6", name: "Tomasz Jankowski", avatar_color: "av-c6", avatar_url: null, activityDays: Array.from({ length: 35 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo7", name: "Ewa Malinowska", avatar_color: "av-c7", avatar_url: null, activityDays: Array.from({ length: 48 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo8", name: "Robert Kamiński", avatar_color: "av-c8", avatar_url: null, activityDays: Array.from({ length: 42 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo9", name: "Agnieszka Wojciechowska", avatar_color: "av-c9", avatar_url: null, activityDays: Array.from({ length: 38 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo10", name: "Andrzej Dombrowski", avatar_color: "av-c10", avatar_url: null, activityDays: Array.from({ length: 52 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo11", name: "Joanna Zielińska", avatar_color: "av-c1", avatar_url: null, activityDays: Array.from({ length: 47 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo12", name: "Marcin Szczepański", avatar_color: "av-c2", avatar_url: null, activityDays: Array.from({ length: 41 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo13", name: "Natalia Grabowska", avatar_color: "av-c3", avatar_url: null, activityDays: Array.from({ length: 39 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo14", name: "Łukasz Pawłowski", avatar_color: "av-c4", avatar_url: null, activityDays: Array.from({ length: 44 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
          { id: "demo15", name: "Monika Michalska", avatar_color: "av-c5", avatar_url: null, activityDays: Array.from({ length: 46 }, (_, i) => `2024-04-${String(i % 30 + 1).padStart(2, "0")}`) },
        ];

        const demoTests: Test[] = [
          {
            id: "t1",
            title: "Funkcje kwadratowe",
            subject: "Matematyka",
            klasa: "2",
            scope: "rozszerzenie",
            school_name: "LO Warszawa",
            teacher: "mgr Kowalski",
            description: "Delta, miejsca zerowe",
            images: [],
            questions: [],
            author: "Anna Kowalska",
            author_id: "demo1",
            author_name: "Anna Kowalska",
            user_id: "demo1",
            ts: Date.now(),
            created_at: new Date().toISOString(),
            likes: ["1", "2", "3", "4", "5", "6"],
            uses: 340,
            solutions: [], sname: "", desc: "",
          },
          {
            id: "t2",
            title: "Genetyka",
            subject: "Biologia",
            klasa: "3",
            scope: "rozszerzenie",
            school_name: "LO Kraków",
            teacher: "dr Nowak",
            description: "Mendel i mutacje",
            images: [],
            questions: [],
            author: "Katarzyna Nowak",
            author_id: "demo3",
            author_name: "Katarzyna Nowak",
            user_id: "demo3",
            ts: Date.now(),
            created_at: new Date().toISOString(),
            likes: ["1", "2", "3"],
            uses: 180,
            solutions: [], sname: "", desc: "",
          },
          {
            id: "t3",
            title: "Mechanika",
            subject: "Fizyka",
            klasa: "1",
            scope: "podstawa",
            school_name: "Technikum",
            teacher: "mgr Lewandowski",
            description: "Dynamika Newtona",
            images: [],
            questions: [],
            author: "Piotr Lewandowski",
            author_id: "demo4",
            author_name: "Piotr Lewandowski",
            user_id: "demo4",
            ts: Date.now(),
            created_at: new Date().toISOString(),
            likes: ["1", "2", "3", "4"],
            uses: 220,
            solutions: [], sname: "", desc: "",
          },
          {
            id: "t4",
            title: "Romantyzm",
            subject: "Język polski",
            klasa: "3",
            scope: "rozszerzenie",
            school_name: "LO Poznań",
            teacher: "mgr Zielińska",
            description: "Epoka romantyzmu",
            images: [],
            questions: [],
            author: "Joanna Zielińska",
            author_id: "demo11",
            author_name: "Joanna Zielińska",
            user_id: "demo11",
            ts: Date.now(),
            created_at: new Date().toISOString(),
            likes: ["1", "2", "3", "4", "5"],
            uses: 270,
            solutions: [], sname: "", desc: "",
          },
          {
            id: "t5",
            title: "Alkohole i fenole",
            subject: "Chemia",
            klasa: "3",
            scope: "rozszerzenie",
            school_name: "LO Gdańsk",
            teacher: "dr Wójcik",
            description: "Reakcje chemiczne",
            images: [],
            questions: [],
            author: "Maria Szymankowska",
            author_id: "demo5",
            author_name: "Maria Szymankowska",
            user_id: "demo5",
            ts: Date.now(),
            created_at: new Date().toISOString(),
            likes: ["1", "2", "3", "4", "5", "6", "7"],
            uses: 390,
            solutions: [], sname: "", desc: "",
          },
        ];

        setDbUsers(demoUsers);
        setAllTests(demoTests);
        setLoading(false);
        return;
      }

      const [tests, usersRes, profilesRes, activityRes] = await Promise.all([
        fetchTests(),
        supabase.from("users").select("id, name"),
        supabase.from("user_profiles").select("user_id, avatar_color, avatar_url"),
        supabase.from("activity_days").select("user_id, date"),
      ]);

      setAllTests(tests);

      const users = (usersRes.data || []).map((u: any) => {
        const profile = (profilesRes.data || []).find((p: any) => p.user_id === u.id);
        const days = (activityRes.data || [])
          .filter((d: any) => d.user_id === u.id)
          .map((d: any) => d.date);

        return {
          id: u.id,
          name: u.name,
          avatar_color: profile?.avatar_color || "av-c1",
          avatar_url: profile?.avatar_url || null,
          activityDays: days,
        };
      });

      setDbUsers(users);
      setLoading(false);
    };

    load();
  }, [guestMode]);

  const getUserMetrics = (user: DBUser) => {
    const mt = allTests.filter(t => t.author_id === user.id);
    const likes = mt.reduce((a, t) => a + (t.likes || []).length, 0);
    const uses = mt.reduce((a, t) => a + (t.uses || 0), 0);
    const points = ptsFromTests(allTests, user.id, user.activityDays, 0);

    return { mt, likes, uses, points };
  };

  const sorted = [...dbUsers].sort((a, b) => {
    const ma = getUserMetrics(a);
    const mb = getUserMetrics(b);

    if (sort === "points") return mb.points - ma.points;
    if (sort === "tests") return mb.mt.length - ma.mt.length;
    if (sort === "likes") return mb.likes - ma.likes;

    return mb.uses - ma.uses;
  });

  const sym = (i: number) =>
    i === 0 ? "🥇" :
    i === 1 ? "🥈" :
    i === 2 ? "🥉" :
    `#${i + 1}`;

  const cls = (i: number) =>
    i === 0 ? "gold" :
    i === 1 ? "silver" :
    i === 2 ? "bronze" :
    "";

  const vlbl: Record<SortKey, string> = {
    points: "pkt",
    tests: "testów",
    likes: "polubień",
    uses: "rozwiązań",
  };

  const sortBtns: { key: SortKey; label: string }[] = [
    { key: "points", label: "⭐ Punkty" },
    { key: "tests", label: "📝 Testy" },
    { key: "likes", label: "❤️ Polubienia" },
    { key: "uses", label: "▶️ Rozwiązania" },
  ];

  const myUser = dbUsers.find(u => u.id === userId);

  const myEarned = myUser
    ? getEarnedFromTests(allTests, userId, myUser.activityDays, 0)
    : [];

  if (loading) {
    return (
      <div className="tt-content" style={{ padding: "24px 28px", color: "var(--gray)" }}>
        Ładowanie rankingu...
      </div>
    );
  }

  return (
    <div className="tt-content" style={{ padding: "24px 28px" }}>
      <div className="ph">
        <div>
          <div className="ph-title">🏆 Ranking twórców</div>
          <div className="ph-sub">Najlepsi według punktów społeczności</div>
        </div>
      </div>

      <div className="sort-chips">
        {sortBtns.map(b => (
          <button
            key={b.key}
            className={`sc ${sort === b.key ? "on" : ""}`}
            onClick={() => setSort(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">🏆</div>
          <div className="empty-ttl">Brak użytkowników</div>
          <div className="empty-sub">Zarejestruj się i zacznij dodawać testy!</div>
        </div>
      ) : (
        sorted.map((u, i) => {
          const m = getUserMetrics(u);
          const earned = getEarnedFromTests(allTests, u.id, u.activityDays, 0);
          const isMe = u.id === userId;

          const val =
            sort === "points"
              ? m.points
              : sort === "tests"
              ? m.mt.length
              : sort === "likes"
              ? m.likes
              : m.uses;

          const streak = calcStreak(u.activityDays || []);

          return (
            <div key={u.id} className={`lb-row ${isMe ? "me" : ""}`}>
              <div className={`lb-rank ${cls(i)}`}>{sym(i)}</div>

              <div
                className={`lb-av ${u.avatar_color}`}
                style={{ overflow: "hidden", cursor: "pointer" }}
                onClick={() => setViewingUserId(u.id)}
                title="Zobacz profil"
              >
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  avInitials(u.name)
                )}
              </div>

              <div
                className="lb-info"
                style={{ cursor: "pointer" }}
                onClick={() => setViewingUserId(u.id)}
              >
                <div className="lb-name">
                  {u.name}
                  {isMe && (
                    <span style={{ fontSize: ".67rem", color: "#60a5fa" }}>
                      {" "} (Ty)
                    </span>
                  )}
                  {" "}
                  <span style={{ fontSize: ".85rem" }}>
                    {earned.slice(0, 3).map(b => b.icon).join("")}
                  </span>
                </div>

                <div className="lb-sub">
                  📝{m.mt.length} · ❤️{m.likes} · ▶️{m.uses} · {streak.cur}🔥
                </div>
              </div>

              <div className="lb-val">
                <div className="lb-score">{val}</div>
                <div className="lb-slabel">{vlbl[sort]}</div>
              </div>
            </div>
          );
        })
      )}

      <div style={{ marginTop: 26 }}>
        <div
          style={{
            fontSize: ".7rem",
            fontWeight: 800,
            color: "var(--gray)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 14,
          }}
        >
          🏅 Twoje odznaki
        </div>

        <div className="badge-grid">
          {BADGES.map(b => {
            const isEarned = myEarned.find(x => x.id === b.id);

            return (
              <div
                key={b.id}
                className={`badge ${isEarned ? "earned" : "locked"}`}
                title={b.desc}
              >
                <div className="badge-ico">{b.icon}</div>
                <div className="badge-nm">{b.name}</div>
                <div className="badge-ds">{b.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {viewingUserId && (
        <UserProfileModal
          userId={viewingUserId}
          onClose={() => setViewingUserId(null)}
        />
      )}
    </div>
  );
};

export default RankingTab;