import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import { supabase } from "@/lib/supabase";
import { MoreVertical, GripVertical, Trash2, AlertTriangle } from "lucide-react";
import { SYMS } from "@/lib/testsStore";
import { LoadingInline } from "@/components/ui/loading-state";

type Page = {
  id: string;
  title: string;
  content: string;
  modified: string;
  created: string;
  section_id: string;
};

type Section = {
  id: string;
  name: string;
  pages: Page[];
  notebook_id: string;
  sort_order: number;
};

type Notebook = {
  id: string;
  name: string;
  color: string;
  subject: string;
  sort_order: number;
  sections: Section[];
};

export type CalEvent = {
  id: string;
  name: string;
  type: string;
  subject: string;
  date: string;
  time: string;
  note: string;
  source?: string;
  sourceTitle?: string;
  autoAdded?: boolean;
};

type NotesTabProps = {
  onEventsExtracted?: (events: CalEvent[]) => void;
  userId: string;
  guestMode?: boolean;
  initialPageId?: string | null;
  onInitialPageConsumed?: () => void;
};

type ViewMode = "browse" | "page";

function now() {
  const d = new Date();
  return d.toLocaleDateString("pl-PL") + " " + d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}
function todayStr() { return new Date().toISOString().split("T")[0]; }

const COLORS = [
  "#3b82f6", "#6366f1", "#a78bfa", "#8b5cf6",
  "#34d399", "#10b981", "#22d3ee", "#06b6d4",
  "#f59e0b", "#f97316", "#ef4444", "#f87171",
  "#ec4899", "#d946ef", "#84cc16", "#14b8a6",
  "#6b7280", "#78716c", "#0ea5e9", "#e11d48",
];

const NotesTab = ({ onEventsExtracted, userId, guestMode, initialPageId, onInitialPageConsumed }: NotesTabProps) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNbId, setActiveNbId] = useState<string | null>(null);
  const [activeSecId, setActiveSecId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [showNbModal, setShowNbModal] = useState(false);
  const [nbName, setNbName] = useState("");
  const [nbColor, setNbColor] = useState("#3b82f6");
  const [nbContextMenu, setNbContextMenu] = useState<string | null>(null);
  const [secContextMenu, setSecContextMenu] = useState<string | null>(null);
  const [editingNbId, setEditingNbId] = useState<string | null>(null);
  const [editNbName, setEditNbName] = useState("");
  const [editNbColor, setEditNbColor] = useState("#3b82f6");
  const [symOpen, setSymOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimeout = useRef<any>(null);
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<string>("");

  useEffect(() => {
    const detect = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      let node: Node | null = sel.anchorNode;
      if (!node || !editor.contains(node)) { setCurrentBlock(""); return; }
      let el: HTMLElement | null = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
      const blockTags = new Set(["H1","H2","H3","H4","H5","H6","P","PRE","DIV","LI","BLOCKQUOTE"]);
      while (el && el !== editor && !blockTags.has(el.tagName)) {
        el = el.parentElement;
      }
      if (!el || el === editor) { setCurrentBlock(""); return; }
      const tag = el.tagName.toLowerCase();
      setCurrentBlock(["h1","h2","h3","h4","h5","h6","p","pre"].includes(tag) ? tag : "");
    };
    document.addEventListener("selectionchange", detect);
    return () => document.removeEventListener("selectionchange", detect);
  }, []);

  const formatCreatedDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dateStr = d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const hasTime = iso.includes("T") || iso.includes(":");
    if (!hasTime) return dateStr;
    const timeStr = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    return `${dateStr}     ${timeStr}`;
  };

  // Drag state for notebook reorder
  const [dragNbId, setDragNbId] = useState<string | null>(null);
  const [dragOverNbId, setDragOverNbId] = useState<string | null>(null);
  const [dragSecId, setDragSecId] = useState<string | null>(null);
  const [dragOverSecId, setDragOverSecId] = useState<string | null>(null);

  const loadNotebooks = useCallback(async () => {
    if (guestMode) {
      // Rich biology content for the default-open notebook
      const bioCellContent = `<h2>Budowa komórki eukariotycznej</h2><p>Komórka eukariotyczna jest podstawową jednostką życia organizmów wielokomórkowych. Zawiera jądro komórkowe otoczone błoną jądrową oraz liczne organelle pełniące wyspecjalizowane funkcje.</p><h3>Najważniejsze organelle</h3><ul><li><strong>Jądro komórkowe</strong> – zawiera DNA, kontroluje wszystkie procesy życiowe komórki.</li><li><strong>Mitochondria</strong> – „elektrownie" komórki, produkują ATP w procesie oddychania komórkowego.</li><li><strong>Retikulum endoplazmatyczne</strong> – szorstkie (synteza białek) i gładkie (synteza lipidów).</li><li><strong>Aparat Golgiego</strong> – modyfikacja i transport białek.</li><li><strong>Lizosomy</strong> – trawienie wewnątrzkomórkowe.</li><li><strong>Chloroplasty</strong> (tylko rośliny) – fotosynteza.</li></ul><h3>Błona komórkowa</h3><p>Błona komórkowa ma budowę dwuwarstwową, składa się z fosfolipidów oraz białek transportowych. Pełni funkcję selektywnej bariery – kontroluje co wchodzi i wychodzi z komórki.</p><p><em>Pamiętaj:</em> komórki roślinne dodatkowo posiadają ścianę komórkową zbudowaną z celulozy oraz duże wakuole.</p>`;

      const demoNotebooks: Notebook[] = [
        {
          id: "demo-nb1", name: "Biologia", color: "#34d399", subject: "Biologia", sort_order: 1,
          sections: [
            {
              id: "demo-sec1-1", name: "Komórka", notebook_id: "demo-nb1", sort_order: 1,
              pages: [
                { id: "demo-p1-1", title: "Budowa komórki", content: bioCellContent, modified: "2024-04-15 14:22", created: "2024-04-10", section_id: "demo-sec1-1" },
                { id: "demo-p1-2", title: "Mitochondria i oddychanie", content: "<p>Mitochondria produkują ATP w procesie oddychania komórkowego. Zawierają własne DNA mitochondrialne dziedziczone wyłącznie od matki.</p>", modified: "2024-04-14 18:05", created: "2024-04-11", section_id: "demo-sec1-1" },
                { id: "demo-p1-3", title: "Podziały komórkowe", content: "<p>Mitoza – podział na dwie identyczne komórki potomne. Mejoza – podział redukcyjny prowadzący do gamet.</p>", modified: "2024-04-13 09:40", created: "2024-04-09", section_id: "demo-sec1-1" },
                { id: "demo-p1-4", title: "Transport błonowy", content: "<p>Dyfuzja prosta, ułatwiona, transport aktywny, endo- i egzocytoza.</p>", modified: "2024-04-12 11:00", created: "2024-04-08", section_id: "demo-sec1-1" },
              ],
            },
            {
              id: "demo-sec1-2", name: "Genetyka", notebook_id: "demo-nb1", sort_order: 2,
              pages: [
                { id: "demo-p1-5", title: "DNA i RNA", content: "<p>Struktura podwójnej helisy DNA (Watson, Crick, 1953). Zasady komplementarne: A-T, G-C.</p>", modified: "2024-04-12 16:10", created: "2024-04-07", section_id: "demo-sec1-2" },
                { id: "demo-p1-6", title: "Prawa Mendla", content: "<p>I prawo: czystości gamet. II prawo: niezależnego dziedziczenia cech.</p>", modified: "2024-04-11 10:30", created: "2024-04-06", section_id: "demo-sec1-2" },
                { id: "demo-p1-7", title: "Krzyżówki genetyczne", content: "<p>Krzyżówka jednogenowa, dwugenowa, sprzężona z płcią.</p>", modified: "2024-04-10 13:25", created: "2024-04-05", section_id: "demo-sec1-2" },
                { id: "demo-p1-8", title: "Mutacje", content: "<p>Punktowe (substytucja, insercja, delecja) oraz chromosomowe.</p>", modified: "2024-04-09 19:00", created: "2024-04-04", section_id: "demo-sec1-2" },
              ],
            },
            {
              id: "demo-sec1-3", name: "Ekologia", notebook_id: "demo-nb1", sort_order: 3,
              pages: [
                { id: "demo-p1-9", title: "Ekosystem", content: "<p>Biocenoza + biotop. Producenci, konsumenci, reducenci.</p>", modified: "2024-04-08 12:15", created: "2024-04-03", section_id: "demo-sec1-3" },
                { id: "demo-p1-10", title: "Łańcuchy pokarmowe", content: "<p>Przepływ energii i obieg materii w przyrodzie.</p>", modified: "2024-04-07 08:50", created: "2024-04-02", section_id: "demo-sec1-3" },
                { id: "demo-p1-11", title: "Cykl węgla i azotu", content: "<p>Obieg pierwiastków biogennych w biosferze.</p>", modified: "2024-04-06 17:20", created: "2024-04-01", section_id: "demo-sec1-3" },
              ],
            },
            {
              id: "demo-sec1-4", name: "Anatomia człowieka", notebook_id: "demo-nb1", sort_order: 4,
              pages: [
                { id: "demo-p1-12", title: "Układ krwionośny", content: "<p>Serce, naczynia krwionośne, krwiobieg duży i mały.</p>", modified: "2024-04-05 14:40", created: "2024-03-30", section_id: "demo-sec1-4" },
                { id: "demo-p1-13", title: "Układ nerwowy", content: "<p>OUN i obwodowy. Neuron, synapsa, łuk odruchowy.</p>", modified: "2024-04-04 11:15", created: "2024-03-29", section_id: "demo-sec1-4" },
                { id: "demo-p1-14", title: "Układ pokarmowy", content: "<p>Trawienie, wchłanianie, gruczoły trawienne.</p>", modified: "2024-04-03 09:00", created: "2024-03-28", section_id: "demo-sec1-4" },
              ],
            },
            {
              id: "demo-sec1-5", name: "Botanika", notebook_id: "demo-nb1", sort_order: 5,
              pages: [
                { id: "demo-p1-15", title: "Fotosynteza", content: "<p>6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂. Faza jasna i ciemna (cykl Calvina).</p>", modified: "2024-04-02 16:00", created: "2024-03-27", section_id: "demo-sec1-5" },
                { id: "demo-p1-16", title: "Tkanki roślinne", content: "<p>Twórcza, okrywająca, miękiszowa, wzmacniająca, przewodząca.</p>", modified: "2024-04-01 13:30", created: "2024-03-26", section_id: "demo-sec1-5" },
              ],
            },
          ],
        },
        {
          id: "demo-nb2", name: "Matematyka", color: "#3b82f6", subject: "Matematyka", sort_order: 2,
          sections: [
            { id: "demo-sec2-1", name: "Algebra", notebook_id: "demo-nb2", sort_order: 1, pages: [
              { id: "demo-p2-1", title: "Równania kwadratowe", content: "", modified: "2024-04-14", created: "2024-04-07", section_id: "demo-sec2-1" },
              { id: "demo-p2-2", title: "Funkcje liniowe", content: "", modified: "2024-04-13", created: "2024-04-06", section_id: "demo-sec2-1" },
              { id: "demo-p2-3", title: "Wzory skróconego mnożenia", content: "", modified: "2024-04-12", created: "2024-04-05", section_id: "demo-sec2-1" },
            ]},
            { id: "demo-sec2-2", name: "Geometria", notebook_id: "demo-nb2", sort_order: 2, pages: [
              { id: "demo-p2-4", title: "Twierdzenie Pitagorasa", content: "", modified: "2024-04-11", created: "2024-04-04", section_id: "demo-sec2-2" },
              { id: "demo-p2-5", title: "Pole i obwód", content: "", modified: "2024-04-10", created: "2024-04-03", section_id: "demo-sec2-2" },
            ]},
          ],
        },
        {
          id: "demo-nb3", name: "Język angielski", color: "#f59e0b", subject: "Angielski", sort_order: 3,
          sections: [
            { id: "demo-sec3-1", name: "Gramatyka", notebook_id: "demo-nb3", sort_order: 1, pages: [
              { id: "demo-p3-1", title: "Present Simple vs Continuous", content: "", modified: "2024-04-15", created: "2024-04-04", section_id: "demo-sec3-1" },
              { id: "demo-p3-2", title: "Past Perfect", content: "", modified: "2024-04-14", created: "2024-04-03", section_id: "demo-sec3-1" },
              { id: "demo-p3-3", title: "Conditionals", content: "", modified: "2024-04-13", created: "2024-04-02", section_id: "demo-sec3-1" },
            ]},
            { id: "demo-sec3-2", name: "Słownictwo", notebook_id: "demo-nb3", sort_order: 2, pages: [
              { id: "demo-p3-4", title: "Idiomy", content: "", modified: "2024-04-12", created: "2024-04-01", section_id: "demo-sec3-2" },
            ]},
          ],
        },
        {
          id: "demo-nb4", name: "Język polski", color: "#f87171", subject: "Polski", sort_order: 4,
          sections: [
            { id: "demo-sec4-1", name: "Lektury", notebook_id: "demo-nb4", sort_order: 1, pages: [
              { id: "demo-p4-1", title: "Pan Tadeusz", content: "", modified: "2024-04-10", created: "2024-04-01", section_id: "demo-sec4-1" },
              { id: "demo-p4-2", title: "Lalka – streszczenie", content: "", modified: "2024-04-09", created: "2024-03-30", section_id: "demo-sec4-1" },
              { id: "demo-p4-3", title: "Dziady cz. III", content: "", modified: "2024-04-08", created: "2024-03-29", section_id: "demo-sec4-1" },
            ]},
            { id: "demo-sec4-2", name: "Ortografia", notebook_id: "demo-nb4", sort_order: 2, pages: [
              { id: "demo-p4-4", title: "Pisownia ż / rz", content: "", modified: "2024-04-07", created: "2024-03-28", section_id: "demo-sec4-2" },
            ]},
          ],
        },
        {
          id: "demo-nb5", name: "Historia", color: "#a78bfa", subject: "Historia", sort_order: 5,
          sections: [
            { id: "demo-sec5-1", name: "II wojna światowa", notebook_id: "demo-nb5", sort_order: 1, pages: [
              { id: "demo-p5-1", title: "Wybuch wojny – wrzesień 1939", content: "", modified: "2024-04-09", created: "2024-03-25", section_id: "demo-sec5-1" },
              { id: "demo-p5-2", title: "Powstanie warszawskie", content: "", modified: "2024-04-08", created: "2024-03-24", section_id: "demo-sec5-1" },
            ]},
            { id: "demo-sec5-2", name: "PRL", notebook_id: "demo-nb5", sort_order: 2, pages: [
              { id: "demo-p5-3", title: "Stan wojenny", content: "", modified: "2024-04-07", created: "2024-03-23", section_id: "demo-sec5-2" },
              { id: "demo-p5-4", title: "Solidarność", content: "", modified: "2024-04-06", created: "2024-03-22", section_id: "demo-sec5-2" },
            ]},
          ],
        },
        {
          id: "demo-nb6", name: "Chemia", color: "#22d3ee", subject: "Chemia", sort_order: 6,
          sections: [
            { id: "demo-sec6-1", name: "Chemia organiczna", notebook_id: "demo-nb6", sort_order: 1, pages: [
              { id: "demo-p6-1", title: "Alkany", content: "", modified: "2024-04-08", created: "2024-03-20", section_id: "demo-sec6-1" },
              { id: "demo-p6-2", title: "Alkohole", content: "", modified: "2024-04-07", created: "2024-03-19", section_id: "demo-sec6-1" },
              { id: "demo-p6-3", title: "Kwasy karboksylowe", content: "", modified: "2024-04-06", created: "2024-03-18", section_id: "demo-sec6-1" },
            ]},
          ],
        },
        {
          id: "demo-nb7", name: "Fizyka", color: "#fb923c", subject: "Fizyka", sort_order: 7,
          sections: [
            { id: "demo-sec7-1", name: "Mechanika", notebook_id: "demo-nb7", sort_order: 1, pages: [
              { id: "demo-p7-1", title: "Zasady dynamiki Newtona", content: "", modified: "2024-04-05", created: "2024-03-15", section_id: "demo-sec7-1" },
              { id: "demo-p7-2", title: "Energia kinetyczna", content: "", modified: "2024-04-04", created: "2024-03-14", section_id: "demo-sec7-1" },
            ]},
            { id: "demo-sec7-2", name: "Elektryczność", notebook_id: "demo-nb7", sort_order: 2, pages: [
              { id: "demo-p7-3", title: "Prawo Ohma", content: "", modified: "2024-04-03", created: "2024-03-13", section_id: "demo-sec7-2" },
            ]},
          ],
        },
        {
          id: "demo-nb8", name: "Geografia", color: "#e879f9", subject: "Geografia", sort_order: 8,
          sections: [
            { id: "demo-sec8-1", name: "Geografia fizyczna", notebook_id: "demo-nb8", sort_order: 1, pages: [
              { id: "demo-p8-1", title: "Klimaty świata", content: "", modified: "2024-04-04", created: "2024-03-12", section_id: "demo-sec8-1" },
              { id: "demo-p8-2", title: "Tektonika płyt", content: "", modified: "2024-04-03", created: "2024-03-11", section_id: "demo-sec8-1" },
            ]},
            { id: "demo-sec8-2", name: "Geografia społeczna", notebook_id: "demo-nb8", sort_order: 2, pages: [
              { id: "demo-p8-3", title: "Demografia Polski", content: "", modified: "2024-04-02", created: "2024-03-10", section_id: "demo-sec8-2" },
            ]},
          ],
        },
      ];
      setNotebooks(demoNotebooks);
      // Auto-open Biologia → Komórka → Budowa komórki
      setActiveNbId("demo-nb1");
      setActiveSecId("demo-sec1-1");
      setLoading(false);
      return;
    }

    const { data: nbs } = await supabase
      .from("notebooks")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order")
      .order("created_at");

    if (!nbs || nbs.length === 0) {
      await supabase.rpc("create_default_notebooks", { p_user_id: userId });
      const { data: nbs2 } = await supabase
        .from("notebooks")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order")
        .order("created_at");
      if (!nbs2) { setLoading(false); return; }
      await loadSectionsAndPages(nbs2);
    } else {
      await loadSectionsAndPages(nbs);
    }
    setLoading(false);
  }, [userId, guestMode]);

  const loadSectionsAndPages = async (nbs: any[]) => {
    const nbIds = nbs.map(n => n.id);
    const { data: secs } = await supabase
      .from("notebook_sections")
      .select("*")
      .in("notebook_id", nbIds)
      .order("sort_order");

    const secIds = (secs || []).map(s => s.id);
    const { data: pages } = secIds.length > 0
      ? await supabase.from("notebook_pages").select("*").in("section_id", secIds).order("sort_order")
      : { data: [] };

    const result: Notebook[] = nbs.map(nb => ({
      id: nb.id,
      name: nb.name,
      color: nb.color,
      subject: nb.subject,
      sort_order: nb.sort_order ?? 0,
      sections: (secs || [])
        .filter(s => s.notebook_id === nb.id)
        .map(s => ({
          id: s.id,
          name: s.name,
          notebook_id: s.notebook_id,
          sort_order: s.sort_order ?? 0,
          pages: (pages || [])
            .filter(p => p.section_id === s.id)
            .map(p => ({
              id: p.id,
              title: p.title,
              content: p.content,
              modified: new Date(p.modified_at).toLocaleDateString("pl-PL") + " " + new Date(p.modified_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }),
              created: p.created_at || new Date().toISOString(),
              section_id: p.section_id,
            })),
        })),
    }));
    setNotebooks(result);
  };

  useEffect(() => { loadNotebooks(); }, [loadNotebooks]);

  // Open initial page if provided (e.g. from "Recent notes" on Overview)
  useEffect(() => {
    if (!initialPageId || notebooks.length === 0) return;
    for (const nb of notebooks) {
      for (const sec of nb.sections) {
        if (sec.pages.find(p => p.id === initialPageId)) {
          setActiveNbId(nb.id);
          setActiveSecId(sec.id);
          setActivePageId(initialPageId);
          setViewMode("page");
          onInitialPageConsumed?.();
          return;
        }
      }
    }
  }, [initialPageId, notebooks, onInitialPageConsumed]);

  const activeNb = notebooks.find(n => n.id === activeNbId) || null;
  const activeSec = activeNb?.sections.find(s => s.id === activeSecId) || null;
  const activePage = (() => {
    if (!activeNb || !activePageId) return null;
    for (const sec of activeNb.sections) {
      const p = sec.pages.find(x => x.id === activePageId);
      if (p) return p;
    }
    return null;
  })();

  const selectNb = (id: string) => {
    setActiveNbId(id);
    const nb = notebooks.find(n => n.id === id);
    if (nb && nb.sections.length > 0) {
      setActiveSecId(nb.sections[0].id);
    } else {
      setActiveSecId(null);
    }
    setActivePageId(null);
    setViewMode("browse");
  };

  const selectSection = (secId: string) => {
    setActiveSecId(secId);
    setActivePageId(null);
    setViewMode("browse");
  };

  const selectPage = async (pageId: string) => {
    await flushSavePage();
    setActivePageId(pageId);
    if (activeNb) {
      for (const sec of activeNb.sections) {
        if (sec.pages.find(p => p.id === pageId)) {
          setActiveSecId(sec.id);
          break;
        }
      }
    }
    setViewMode("page");
  };

  const goBackToBrowse = async () => {
    // Flush any pending edits to DB before leaving the page view
    await flushSavePage();
    // Before going back, check if current page has no title and no content — if so, delete it
    if (activePage && editorRef.current && titleRef.current) {
      const title = titleRef.current.value.trim();
      const content = editorRef.current.innerText.trim();
      if (!title && !content) {
        supabase.from("notebook_pages").delete().eq("id", activePage.id).then(() => {
          if (activeNb) {
            for (const sec of activeNb.sections) {
              const i = sec.pages.findIndex(p => p.id === activePage.id);
              if (i > -1) { sec.pages.splice(i, 1); break; }
            }
          }
          setNotebooks([...notebooks]);
        });
        toast.info("Pusta notatka usunięta.");
      } else {
        // Refresh list so the new title/content show in browse view
        setNotebooks([...notebooks]);
      }
    }
    setActivePageId(null);
    setViewMode("browse");
  };

  // Only re-initialize the editor when the actual page changes — NOT when
  // its title/content change, otherwise innerHTML gets reset mid-typing and
  // the user's just-typed characters (and cursor) are wiped.
  const resolveNoteImageSrcs = async (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll("img"));
    const paths = new Set<string>();
    for (const img of imgs) {
      let p = img.getAttribute("data-note-path");
      if (!p) {
        const src = img.getAttribute("src") || "";
        const m = src.match(/\/storage\/v1\/object\/(?:public|sign)\/note-images\/([^?#]+)/);
        if (m) {
          p = decodeURIComponent(m[1]);
          img.setAttribute("data-note-path", p);
        }
      }
      if (p) paths.add(p);
    }
    if (paths.size === 0) return;
    const pathList = Array.from(paths);
    const { data, error } = await supabase.storage.from("note-images").createSignedUrls(pathList, 60 * 60 * 8);
    if (error || !data) return;
    const map = new Map<string, string>();
    data.forEach((d, i) => { if (d.signedUrl) map.set(pathList[i], d.signedUrl); });
    for (const img of imgs) {
      const p = img.getAttribute("data-note-path");
      if (p && map.has(p)) img.setAttribute("src", map.get(p)!);
    }
  };

  useEffect(() => {
    if (viewMode !== "page" || !activePage) return;
    if (titleRef.current) titleRef.current.value = activePage.title;
    if (editorRef.current) {
      editorRef.current.innerHTML = DOMPurify.sanitize(activePage.content || "", { ADD_ATTR: ["data-note-path"] });
      void resolveNoteImageSrcs(editorRef.current);
    }
  }, [viewMode, activePage?.id]);

  // Image selection overlay: corner handles (proportional resize) + center move handle
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let selected: HTMLElement | null = null;
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;pointer-events:none;z-index:9999;display:none;border:2px solid #3b82f6;border-radius:8px;box-sizing:border-box;";
    overlay.innerHTML = `
      ${["tl","tr","bl","br"].map(p => `<div data-handle="${p}" style="position:absolute;width:18px;height:18px;background:#fff;border:2px solid #3b82f6;border-radius:50%;pointer-events:auto;cursor:${p==="tl"||p==="br"?"nwse":"nesw"}-resize;${p[0]==="t"?"top:-10px":"bottom:-10px"};${p[1]==="l"?"left:-10px":"right:-10px"};"></div>`).join("")}
      <div data-handle="move" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;background:#fff;border:2px solid #3b82f6;border-radius:50%;pointer-events:auto;cursor:move;display:flex;align-items:center;justify-content:center;font-size:22px;color:#3b82f6;user-select:none;">✥</div>
    `;
    document.body.appendChild(overlay);

    const positionOverlay = () => {
      if (!selected) { overlay.style.display = "none"; return; }
      const r = selected.getBoundingClientRect();
      overlay.style.display = "block";
      overlay.style.left = r.left + "px";
      overlay.style.top = r.top + "px";
      overlay.style.width = r.width + "px";
      overlay.style.height = r.height + "px";
    };

    const select = (el: HTMLElement | null) => { selected = el; positionOverlay(); };

    const onEditorClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest?.(".note-img-wrap") as HTMLElement | null;
      if (t) { select(t); }
    };
    const onDocPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (overlay.contains(t)) return;
      if (t?.closest?.(".note-img-wrap") === selected && selected) return;
      select(null);
    };
    const onScrollOrResize = () => positionOverlay();

    // Resize handles — proportional
    let resizing: { handle: string; startX: number; startW: number; aspect: number } | null = null;
    const onHandlePointerDown = (e: PointerEvent) => {
      const h = (e.target as HTMLElement).dataset?.handle;
      if (!h || !selected) return;
      e.preventDefault(); e.stopPropagation();
      if (h === "move") {
        // Use native drag (set on wrapper) for in-editor repositioning
        return;
      }
      const img = selected.querySelector("img") as HTMLImageElement | null;
      const rect = selected.getBoundingClientRect();
      const aspect = img && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : rect.width / Math.max(1, rect.height);
      resizing = { handle: h, startX: e.clientX, startW: rect.width, aspect };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };
    const onHandlePointerMove = (e: PointerEvent) => {
      if (!resizing || !selected) return;
      const dir = (resizing.handle === "br" || resizing.handle === "tr") ? 1 : -1;
      const newW = Math.max(60, Math.min(editor.clientWidth, resizing.startW + dir * (e.clientX - resizing.startX)));
      selected.style.width = newW + "px";
      // height auto via img; aspect preserved naturally
      positionOverlay();
    };
    const onHandlePointerUp = () => {
      if (resizing) { resizing = null; saveCurrentPage(); }
    };

    // Move: drag the selected wrapper to a new caret position inside the editor
    let moving = false;
    let moveCaretMarker: HTMLElement | null = null;
    const getCaretRange = (x: number, y: number): Range | null => {
      // @ts-ignore
      if (document.caretRangeFromPoint) return (document as any).caretRangeFromPoint(x, y);
      // @ts-ignore
      if (document.caretPositionFromPoint) {
        // @ts-ignore
        const p = document.caretPositionFromPoint(x, y);
        if (!p) return null;
        const r = document.createRange();
        r.setStart(p.offsetNode, p.offset);
        r.collapse(true);
        return r;
      }
      return null;
    };
    const onOverlayMovePointerDown = (e: PointerEvent) => {
      const h = (e.target as HTMLElement).dataset?.handle;
      if (h !== "move" || !selected) return;
      e.preventDefault(); e.stopPropagation();
      moving = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      overlay.style.opacity = "0.5";
      if (!moveCaretMarker) {
        moveCaretMarker = document.createElement("div");
        moveCaretMarker.style.cssText = "position:fixed;width:2px;background:#3b82f6;pointer-events:none;z-index:9998;display:none;";
        document.body.appendChild(moveCaretMarker);
      }
    };
    const onOverlayMovePointerMove = (e: PointerEvent) => {
      if (!moving) return;
      const r = getCaretRange(e.clientX, e.clientY);
      if (r && moveCaretMarker && editor.contains(r.startContainer)) {
        const rect = r.getBoundingClientRect();
        moveCaretMarker.style.display = "block";
        moveCaretMarker.style.left = rect.left + "px";
        moveCaretMarker.style.top = rect.top + "px";
        moveCaretMarker.style.height = (rect.height || 18) + "px";
      }
    };
    const onOverlayMovePointerUp = (e: PointerEvent) => {
      if (!moving || !selected) return;
      moving = false;
      overlay.style.opacity = "1";
      if (moveCaretMarker) moveCaretMarker.style.display = "none";
      const r = getCaretRange(e.clientX, e.clientY);
      if (r && editor.contains(r.startContainer)) {
        try { r.insertNode(selected); } catch {}
        positionOverlay();
        saveCurrentPage();
      }
    };
    overlay.addEventListener("pointerdown", onOverlayMovePointerDown);
    overlay.addEventListener("pointermove", onOverlayMovePointerMove);
    overlay.addEventListener("pointerup", onOverlayMovePointerUp);

    overlay.addEventListener("pointerdown", onHandlePointerDown);
    overlay.addEventListener("pointermove", onHandlePointerMove);
    overlay.addEventListener("pointerup", onHandlePointerUp);
    editor.addEventListener("click", onEditorClick);
    document.addEventListener("pointerdown", onDocPointerDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      overlay.remove();
      moveCaretMarker?.remove();
      editor.removeEventListener("click", onEditorClick);
      document.removeEventListener("pointerdown", onDocPointerDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [viewMode, activePage?.id]);

  const flushSavePage = async () => {
    clearTimeout(saveTimeout.current);
    if (!activePage || !editorRef.current || !titleRef.current) return;
    const newTitle = titleRef.current.value || "Bez tytułu";
    const newContent = DOMPurify.sanitize(editorRef.current.innerHTML, { ADD_ATTR: ["data-note-path"] });
    activePage.title = newTitle;
    activePage.content = newContent;
    activePage.modified = now();
    const { error } = await supabase.from("notebook_pages").update({
      title: newTitle,
      content: newContent,
      modified_at: new Date().toISOString(),
    }).eq("id", activePage.id);
    if (error) {
      console.error("notebook_pages update error:", error);
      toast.error("Nie udało się zapisać notatki — spróbuj ponownie");
    }
  };

  const saveCurrentPage = () => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      if (!activePage || !editorRef.current || !titleRef.current) return;
      const newTitle = titleRef.current.value || "Bez tytułu";
      const newContent = DOMPurify.sanitize(editorRef.current.innerHTML, { ADD_ATTR: ["data-note-path"] });

      activePage.title = newTitle;
      activePage.content = newContent;
      activePage.modified = now();

      const { error } = await supabase.from("notebook_pages").update({
        title: newTitle,
        content: newContent,
        modified_at: new Date().toISOString(),
      }).eq("id", activePage.id);
      if (error) {
        console.error("notebook_pages update error:", error);
        toast.error("Nie udało się zapisać notatki — spróbuj ponownie");
        return;
      }

      // NOTE: Auto-extract of calendar events via n8n webhook is intentionally disabled here.
      // The notes webhook must be triggered ONLY when saving a recorded lesson via the
      // "Słuchaj lekcji" widget — never during manual note editing.

    }, 800);
  };

  const createNotebook = async () => {
    if (!nbName.trim()) { toast.warning("Podaj nazwę notesu!"); return; }
    const maxSort = notebooks.reduce((max, n) => Math.max(max, n.sort_order), 0);
    const { data: nb, error } = await supabase.from("notebooks").insert({
      user_id: userId, name: nbName.trim(), color: nbColor, subject: "", sort_order: maxSort + 1,
    }).select().single();
    if (error || !nb) { toast.error("Błąd tworzenia notesu"); return; }

    const { data: sec, error: secError } = await supabase.from("notebook_sections").insert({
      notebook_id: nb.id,
      name: "Nowa sekcja",
      sort_order: 0,
    }).select().single();
    if (secError || !sec) {
      await supabase.from("notebooks").delete().eq("id", nb.id);
      toast.error("Nie udało się utworzyć domyślnej sekcji");
      return;
    }

    const newNb: Notebook = {
      id: nb.id, name: nb.name, color: nb.color, subject: "", sort_order: nb.sort_order ?? maxSort + 1,
      sections: [{ id: sec.id, name: sec.name, notebook_id: nb.id, sort_order: sec.sort_order ?? 0, pages: [] }],
    };
    setNotebooks(prev => [...prev, newNb]);
    setShowNbModal(false);
    setNbName("");
    setNbColor("#3b82f6");
    setActiveNbId(nb.id);
    setActiveSecId(sec.id);
    setActivePageId(null);
    setViewMode("browse");
    toast.success(`Notes „${nb.name}" utworzony!`);
  };

  const addSection = async () => {
    if (!activeNb) { toast.warning("Wybierz notes."); return; }
    const name = prompt("Nazwa sekcji:");
    if (!name) return;
    const nextSort = activeNb.sections.reduce((max, sec) => Math.max(max, sec.sort_order), -1) + 1;
    const { data: sec, error } = await supabase.from("notebook_sections").insert({
      notebook_id: activeNb.id, name, sort_order: nextSort,
    }).select().single();
    if (error || !sec) return;
    activeNb.sections.push({ id: sec.id, name: sec.name, notebook_id: activeNb.id, sort_order: sec.sort_order ?? nextSort, pages: [] });
    setActiveSecId(sec.id);
    setNotebooks([...notebooks]);
  };

  const deleteSection = async (secId: string) => {
    if (!confirm("Usunąć sekcję i jej strony?")) return;
    await supabase.from("notebook_pages").delete().eq("section_id", secId);
    await supabase.from("notebook_sections").delete().eq("id", secId);
    if (!activeNb) return;
    activeNb.sections = activeNb.sections.filter(s => s.id !== secId);
    if (activeSecId === secId) { setActiveSecId(null); setActivePageId(null); setViewMode("browse"); }
    setNotebooks([...notebooks]);
  };

  const addPage = async (secId: string) => {
    if (!activeNb) return;
    const sec = activeNb.sections.find(s => s.id === secId);
    if (!sec) return;
    const { data: page, error } = await supabase.from("notebook_pages").insert({
      section_id: secId, title: "", content: "",
    }).select().single();
    if (error || !page) return;
    const newPage: Page = {
      id: page.id, title: "", content: "",
      modified: now(), created: todayStr(), section_id: secId,
    };
    sec.pages.push(newPage);
    setActiveSecId(secId);
    setNotebooks([...notebooks]);
    selectPage(newPage.id);
  };

  const [isPendingDeletePage, setIsPendingDeletePage] = useState(false);
  const pendingDeletePageTimerRef = useRef<number | null>(null);

  const deleteCurrentPage = async () => {
    if (!activePageId) return;
    await supabase.from("notebook_pages").delete().eq("id", activePageId);
    if (!activeNb) return;
    for (const sec of activeNb.sections) {
      const i = sec.pages.findIndex(p => p.id === activePageId);
      if (i > -1) { sec.pages.splice(i, 1); break; }
    }
    setActivePageId(null);
    setViewMode("browse");
    setNotebooks([...notebooks]);
  };

  const handleDeletePageClick = () => {
    if (!activePageId) return;
    if (isPendingDeletePage) {
      if (pendingDeletePageTimerRef.current) {
        window.clearTimeout(pendingDeletePageTimerRef.current);
        pendingDeletePageTimerRef.current = null;
      }
      setIsPendingDeletePage(false);
      deleteCurrentPage();
      return;
    }
    setIsPendingDeletePage(true);
    pendingDeletePageTimerRef.current = window.setTimeout(() => {
      setIsPendingDeletePage(false);
      pendingDeletePageTimerRef.current = null;
    }, 3000);
  };

  const addNoteFromRecording = async (title: string, content: string, targetNbId?: string, targetSecId?: string) => {
    // Snapshot fallback from localStorage in case neither arg nor live state matches
    let snapNb = targetNbId;
    let snapSec = targetSecId;
    if (!snapNb || !snapSec) {
      try {
        const raw = localStorage.getItem("notesTab_selection");
        if (raw) {
          const s = JSON.parse(raw);
          snapNb = snapNb || s?.nbId;
          snapSec = snapSec || s?.secId;
        }
      } catch {}
    }
    let nb = notebooks.find(n => n.id === (snapNb || activeNbId)) || notebooks[0];
    if (!nb) return;
    let sec = (snapSec ? nb.sections.find(s => s.id === snapSec) : null)
      || nb.sections.find(s => s.id === activeSecId)
      || nb.sections[0];
    if (!sec) {
      const { data: createdSection, error } = await supabase.from("notebook_sections").insert({
        notebook_id: nb.id,
        name: "Nowa sekcja",
        sort_order: 0,
      }).select().single();
      if (error || !createdSection) return;
      sec = { id: createdSection.id, name: createdSection.name, notebook_id: nb.id, sort_order: createdSection.sort_order ?? 0, pages: [] };
      nb.sections.push(sec);
    }

    const { data: page, error } = await supabase.from("notebook_pages").insert({
      section_id: sec.id, title, content,
    }).select().single();
    if (error || !page) return;

    const newPage: Page = {
      id: page.id, title, content, modified: now(), created: todayStr(), section_id: sec.id,
    };
    sec.pages.push(newPage);
    setActiveNbId(nb.id);
    setActiveSecId(sec.id);
    setNotebooks([...notebooks]);
    selectPage(newPage.id);
    toast.success(`✓ Notatki zapisane: ${nb.name} › ${sec.name}`);
  };

  // Persist selection so RecordingWidget can target the right notebook/section
  // even after this tab unmounts (user navigated to another tab while waiting for n8n).
  useEffect(() => {
    try {
      if (activeNbId && activeSecId) {
        localStorage.setItem("notesTab_selection", JSON.stringify({
          nbId: activeNbId,
          secId: activeSecId,
          nbName: activeNb?.name || "",
          secName: activeSec?.name || "",
        }));
      }
    } catch {}
  }, [activeNbId, activeSecId, activeNb?.name, activeSec?.name]);

  useEffect(() => {
    (window as any).__notesTab_addNote = addNoteFromRecording;
    (window as any).__notesTab_hasSelection = () => {
      if (activeNbId && activeSecId) return true;
      try {
        const raw = localStorage.getItem("notesTab_selection");
        if (!raw) return false;
        const sel = JSON.parse(raw);
        return !!(sel?.nbId && sel?.secId);
      } catch { return false; }
    };
    (window as any).__notesTab_getSelection = () => {
      if (activeNbId && activeSecId) {
        return { nbId: activeNbId, secId: activeSecId, nbName: activeNb?.name || "", secName: activeSec?.name || "" };
      }
      try {
        const raw = localStorage.getItem("notesTab_selection");
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    };
    return () => {
      delete (window as any).__notesTab_addNote;
      delete (window as any).__notesTab_hasSelection;
      delete (window as any).__notesTab_getSelection;
    };
  }, [notebooks, activeNbId, activeSecId, activeNb?.name, activeSec?.name]);

  // When a note is inserted directly via Supabase (because NotesTab was unmounted),
  // refresh notebooks so the new page becomes visible immediately upon return.
  useEffect(() => {
    const handler = () => { loadNotebooks(); };
    window.addEventListener("notesTab_externalNoteAdded", handler);
    return () => window.removeEventListener("notesTab_externalNoteAdded", handler);
  }, [loadNotebooks]);

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    saveCurrentPage();
  };

  const insertTable = () => {
    const html = '<table style="border-collapse:collapse;width:100%;margin:8px 0"><tr><td style="border:1px solid rgba(255,255,255,0.15);padding:8px">​</td><td style="border:1px solid rgba(255,255,255,0.15);padding:8px">​</td><td style="border:1px solid rgba(255,255,255,0.15);padding:8px">​</td></tr><tr><td style="border:1px solid rgba(255,255,255,0.15);padding:8px">​</td><td style="border:1px solid rgba(255,255,255,0.15);padding:8px">​</td><td style="border:1px solid rgba(255,255,255,0.15);padding:8px">​</td></tr></table><p>​</p>';
    document.execCommand("insertHTML", false, html);
    saveCurrentPage();
  };

  const insertSym = (s: string) => {
    editorRef.current?.focus();
    document.execCommand("insertText", false, s);
    saveCurrentPage();
  };

  const uploadPastedImage = async (file: File) => {
    if (!userId) { toast.error("Musisz być zalogowany aby dodać zdjęcie"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Zdjęcie jest za duże (max 10MB)"); return; }
    const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("note-images").upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) { console.error("note-images upload failed:", error); toast.error("Nie udało się przesłać zdjęcia"); return; }
    const { data: signed } = await supabase.storage.from("note-images").createSignedUrl(path, 60 * 60 * 8);
    const url = signed?.signedUrl || "";
    editorRef.current?.focus();
    const safePath = path.replace(/"/g, "&quot;");
    // Wrap in a resizable span so the user can drag the bottom-right corner to resize.
    const html = `<span class="note-img-wrap" contenteditable="false" style="display:inline-block;position:relative;max-width:100%;width:320px;margin:8px 0;border-radius:8px;vertical-align:top;"><img src="${url}" data-note-path="${safePath}" alt="" style="width:100%;height:auto;display:block;border-radius:8px;pointer-events:none;" /></span>&nbsp;`;
    document.execCommand("insertHTML", false, html);
    // Persist immediately so a quick tab refresh doesn't lose the image
    // (saveCurrentPage is debounced 800ms).
    await flushSavePage();
  };

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pickImage = () => imageInputRef.current?.click();
  const onImagePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadPastedImage(file);
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const cd = e.clipboardData;
    if (!cd) return;
    // Handle image paste (from clipboard or files)
    const items = Array.from(cd.items || []);
    const imageItem = items.find(it => it.kind === "file" && it.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        void uploadPastedImage(file);
        return;
      }
    }
    if (cd.files && cd.files.length > 0) {
      const file = Array.from(cd.files).find(f => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        void uploadPastedImage(file);
        return;
      }
    }
    // Plain text only — strip all formatting
    e.preventDefault();
    const text = cd.getData("text/plain");
    if (text) {
      document.execCommand("insertText", false, text);
    }
  };

  // === Notebook management ===
  const deleteNotebook = async (nbId: string) => {
    if (!confirm("Usunąć notes i wszystkie jego sekcje i strony?")) return;
    const nb = notebooks.find(n => n.id === nbId);
    if (nb) {
      for (const sec of nb.sections) {
        await supabase.from("notebook_pages").delete().eq("section_id", sec.id);
      }
      const secIds = nb.sections.map(s => s.id);
      if (secIds.length > 0) await supabase.from("notebook_sections").delete().in("id", secIds);
    }
    await supabase.from("notebooks").delete().eq("id", nbId);
    if (activeNbId === nbId) { setActiveNbId(null); setActiveSecId(null); setActivePageId(null); setViewMode("browse"); }
    setNotebooks(prev => prev.filter(n => n.id !== nbId));
    setNbContextMenu(null);
    toast.success("Notes usunięty");
  };

  const openEditNotebook = (nbId: string) => {
    const nb = notebooks.find(n => n.id === nbId);
    if (!nb) return;
    setEditingNbId(nbId);
    setEditNbName(nb.name);
    setEditNbColor(nb.color);
    setNbContextMenu(null);
  };

  const saveEditNotebook = async () => {
    if (!editingNbId || !editNbName.trim()) return;
    await supabase.from("notebooks").update({ name: editNbName.trim(), color: editNbColor }).eq("id", editingNbId);
    setNotebooks(prev => prev.map(n => n.id === editingNbId ? { ...n, name: editNbName.trim(), color: editNbColor } : n));
    setEditingNbId(null);
    toast.success("Notes zaktualizowany");
  };

  const renameSection = async (secId: string) => {
    const sec = activeNb?.sections.find(s => s.id === secId);
    if (!sec) return;
    const name = prompt("Nowa nazwa sekcji:", sec.name);
    if (!name || name === sec.name) return;
    await supabase.from("notebook_sections").update({ name }).eq("id", secId);
    sec.name = name;
    setNotebooks([...notebooks]);
    setSecContextMenu(null);
    toast.success("Sekcja przemianowana");
  };

  const moveSectionToNotebook = async (secId: string) => {
    const otherNbs = notebooks.filter(n => n.id !== activeNbId);
    if (otherNbs.length === 0) { toast.warning("Brak innych notesów do przeniesienia."); return; }
    const choice = prompt("Przenieś do notesu:\n" + otherNbs.map((n, i) => `${i + 1}. ${n.name}`).join("\n") + "\n\nWpisz numer:");
    const idx = parseInt(choice || "") - 1;
    if (isNaN(idx) || idx < 0 || idx >= otherNbs.length) return;
    const targetNb = otherNbs[idx];
    await supabase.from("notebook_sections").update({ notebook_id: targetNb.id }).eq("id", secId);
    if (activeNb) {
      const sec = activeNb.sections.find(s => s.id === secId);
      if (sec) {
        activeNb.sections = activeNb.sections.filter(s => s.id !== secId);
        sec.notebook_id = targetNb.id;
        sec.sort_order = targetNb.sections.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1;
        targetNb.sections.push(sec);
      }
    }
    if (activeSecId === secId) { setActiveSecId(null); setActivePageId(null); }
    setNotebooks([...notebooks]);
    setSecContextMenu(null);
    toast.success(`Sekcja przeniesiona do „${targetNb.name}"`);
  };

  const reorderNotebooks = async (sourceNbId: string, targetNbId: string) => {
    const fromIdx = notebooks.findIndex(n => n.id === sourceNbId);
    const toIdx = notebooks.findIndex(n => n.id === targetNbId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    const reordered = [...notebooks];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const updated = reordered.map((nb, index) => ({ ...nb, sort_order: index }));
    setNotebooks(updated);

    await Promise.all(
      updated.map((nb) => supabase.from("notebooks").update({ sort_order: nb.sort_order }).eq("id", nb.id)),
    );
  };

  const reorderSections = async (sourceSecId: string, targetSecId: string) => {
    if (!activeNb) return;

    const fromIdx = activeNb.sections.findIndex(s => s.id === sourceSecId);
    const toIdx = activeNb.sections.findIndex(s => s.id === targetSecId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    const reordered = [...activeNb.sections];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const updatedSections = reordered.map((sec, index) => ({ ...sec, sort_order: index }));
    setNotebooks(prev => prev.map(nb => nb.id === activeNb.id ? { ...nb, sections: updatedSections } : nb));

    await Promise.all(
      updatedSections.map((sec) => supabase.from("notebook_sections").update({ sort_order: sec.sort_order }).eq("id", sec.id)),
    );
  };

  // === Drag & Drop reorder notebooks ===
  const handleDragStart = (e: React.DragEvent, nbId: string) => {
    setDragNbId(nbId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", nbId);
  };

  const handleDragOver = (e: React.DragEvent, nbId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragNbId !== nbId) setDragOverNbId(nbId);
  };

  const handleDragLeave = () => {
    setDragOverNbId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetNbId: string) => {
    e.preventDefault();
    setDragOverNbId(null);
    if (!dragNbId || dragNbId === targetNbId) { setDragNbId(null); return; }
    await reorderNotebooks(dragNbId, targetNbId);
    setDragNbId(null);
  };

  const handleDragEnd = () => {
    setDragNbId(null);
    setDragOverNbId(null);
  };

  // === Touch drag reorder for mobile ===
  const touchStartRef = useRef<{ id: string; y: number } | null>(null);

  const handleTouchStart = (id: string, e: React.TouchEvent) => {
    touchStartRef.current = { id, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (targetId: string) => {
    if (!touchStartRef.current || touchStartRef.current.id === targetId) {
      touchStartRef.current = null;
      return;
    }
    reorderNotebooks(touchStartRef.current.id, targetId);
    touchStartRef.current = null;
  };

  const handleSectionDragStart = (e: React.DragEvent, secId: string) => {
    setDragSecId(secId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", secId);
  };

  const handleSectionDragOver = (e: React.DragEvent, secId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragSecId !== secId) setDragOverSecId(secId);
  };

  const handleSectionDrop = async (e: React.DragEvent, targetSecId: string) => {
    e.preventDefault();
    setDragOverSecId(null);
    if (!dragSecId || dragSecId === targetSecId) { setDragSecId(null); return; }
    await reorderSections(dragSecId, targetSecId);
    setDragSecId(null);
  };

  const handleSectionDragEnd = () => {
    setDragSecId(null);
    setDragOverSecId(null);
  };

  if (loading) return <LoadingInline label="Ładowanie notatek…" minHeight={300} />;

  // === PAGE VIEW ===
  if (viewMode === "page" && activePage && activeSec && activeNb) {
    return (
      <div style={{ display: "flex", flex: 1, minHeight: 0, height: "100%", overflow: "hidden" }}>
        {/* Pages sidebar */}
        {!pagesCollapsed && (
          <div className="notes-pages-sidebar">
            <div className="nps-header">
              <button className="nps-back" onClick={goBackToBrowse} title="Wróć do notesów">
                ← Wróć
              </button>
              <div className="nps-breadcrumb">
                <span style={{ color: activeNb.color }}>{activeNb.name}</span>
                <span style={{ opacity: .4 }}>›</span>
                <span>{activeSec.name}</span>
              </div>
              <button
                className="nps-collapse-btn"
                onClick={() => setPagesCollapsed(true)}
                title="Zwiń panel stron"
                aria-label="Zwiń panel stron"
              >‹</button>
            </div>
            <div className="nps-pages-list">
              {activeSec.pages.map(p => (
                <div
                  key={p.id}
                  className={`nps-page-item ${activePageId === p.id ? "active" : ""}`}
                  onClick={() => selectPage(p.id)}
                >
                  <div className="nps-page-title">{p.title || "Bez tytułu"}</div>
                </div>
              ))}
            </div>
            <button className="notes-bottom-btn" onClick={() => addPage(activeSec.id)}>
              ＋ Strona
            </button>
          </div>
        )}

        {/* Editor */}
        <div className="note-editor">
          <div className="editor-format-bar">
            <button
              className="notes-mobile-back editor-mobile-back"
              onClick={goBackToBrowse}
              aria-label="Wróć do stron"
            >‹</button>
            {pagesCollapsed && (
              <button
                className="et-btn nps-expand-btn"
                onClick={() => setPagesCollapsed(false)}
                title="Pokaż panel stron"
                aria-label="Pokaż panel stron"
              >☰ Strony</button>
            )}
            <select
              className="ef-select"
              onChange={(e) => {
                if (e.target.value) execCmd("formatBlock", e.target.value);
                e.target.value = "";
              }}
              defaultValue=""
            >
              <option value="" disabled>Nagłówek</option>
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
              <option value="h5">H5</option>
              <option value="h6">H6</option>
              <option value="p">Paragraf</option>
              <option value="pre">Preformatowany</option>
            </select>
            <div className="et-sep" />
            <button className="et-btn" onClick={() => execCmd("bold")} title="Pogrubienie"><b>B</b></button>
            <button className="et-btn" onClick={() => execCmd("italic")} title="Kursywa"><i>I</i></button>
            <button className="et-btn" onClick={() => execCmd("underline")} title="Podkreślenie"><u>U</u></button>
            <div className="et-sep" />
            <button className="et-btn" onClick={() => execCmd("insertUnorderedList")} title="Lista">• Lista</button>
            <button className="et-btn" onClick={() => execCmd("insertOrderedList")} title="Lista numerowana">1. Lista</button>
            <div className="et-sep" />
            <button className="et-btn" onClick={insertTable} title="Wstaw tabelę">▦ Tabela</button>
            <div className="et-sep" />
            <button className="et-btn" onClick={pickImage} title="Wstaw zdjęcie">🖼 Zdjęcie</button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onImagePicked}
            />
            <div className="et-sep" />
            <button className={`et-btn ${symOpen ? "active" : ""}`} onClick={() => setSymOpen(p => !p)} title="Symbole matematyczne">🔣</button>
            <div className="et-sep" />
            <button
              className="et-btn"
              style={{
                color: "#f87171",
                marginLeft: "auto",
                ...(isPendingDeletePage
                  ? { background: "rgba(248,113,113,0.18)", borderColor: "rgba(248,113,113,0.55)", color: "#fca5a5", animation: "mdDeletePulse 1.2s ease-in-out infinite" }
                  : {}),
              }}
              onClick={handleDeletePageClick}
              title={isPendingDeletePage ? "Kliknij ponownie, aby potwierdzić" : "Usuń stronę"}
            >
              {isPendingDeletePage ? (
                <AlertTriangle size={15} strokeWidth={2.4} />
              ) : (
                <Trash2 size={15} strokeWidth={2.2} />
              )}
            </button>
          </div>
          {symOpen && (
            <div className="sym-bar" style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", maxHeight: 200, overflowY: "auto" }}>
              {SYMS.map(gr => (
                <div key={gr.g}>
                  <span className="sym-group-label">{gr.g}</span>
                  <div className="sym-group-row">
                    {gr.s.map((s, i) => (
                      <button key={i} className="sym-btn" onClick={() => insertSym(s)} title={s}>{s}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="editor-title-block">
            <input
              ref={titleRef}
              className="et-title-underlined"
              defaultValue={activePage.title}
              placeholder=""
              onInput={saveCurrentPage}
            />
            <div className="et-title-created">{formatCreatedDate(activePage.created)}</div>
          </div>
          <div className="editor-area">
            <div
              ref={editorRef}
              className="editor-content rich-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Zacznij pisać notatkę..."
              onInput={saveCurrentPage}
              onFocus={() => {
                if (typeof window !== "undefined" && window.innerWidth >= 900) {
                  setPagesCollapsed(true);
                }
              }}
              onPaste={handleEditorPaste}
            />
          </div>
        </div>
      </div>
    );
  }

  // === BROWSE VIEW: 3-column OneNote-like layout ===
  // On mobile we drill down: notebooks → sections → pages (one column at a time)
  const mobileLevel: "notebooks" | "sections" | "pages" =
    activeSecId ? "pages" : activeNbId ? "sections" : "notebooks";
  return (
    <div
      className="notes-browse-root"
      data-mobile-level={mobileLevel}
      style={{ display: "flex", flex: 1, minHeight: 0, height: "100%", overflow: "hidden" }}
      onClick={() => { setNbContextMenu(null); setSecContextMenu(null); }}
    >
      {/* Column 1: Notebooks */}
      <div className="nb-sidebar">
        <div className="nbs-header">
          <div className="nbs-title">Notesy</div>
        </div>
        <div className="nbs-list">
          {notebooks.length === 0 ? (
            <div style={{ fontSize: ".8rem", color: "#8899b4", padding: "10px 12px" }}>Brak notesów. Kliknij ＋</div>
          ) : notebooks.map(nb => (
            <div
              key={nb.id}
              className={`nb-item ${activeNbId === nb.id ? "active" : ""} ${dragOverNbId === nb.id ? "drag-over" : ""}`}
              onClick={() => selectNb(nb.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, nb.id)}
              onDragOver={(e) => handleDragOver(e, nb.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, nb.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(nb.id, e)}
              onTouchEnd={() => handleTouchEnd(nb.id)}
              style={{ position: "relative", opacity: dragNbId === nb.id ? 0.5 : 1 }}
            >
              <GripVertical size={12} className="nb-grip" style={{ color: "#8899b4", opacity: 0.3, flexShrink: 0, cursor: "grab" }} />
              <div className="nb-dot" style={{ background: nb.color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nb-name">{nb.name}</div>
              </div>
              <div className="nb-count">{nb.sections.reduce((a, s) => a + s.pages.length, 0)}</div>
              <button
                className="nb-ctx-btn"
                onClick={(e) => { e.stopPropagation(); setNbContextMenu(nbContextMenu === nb.id ? null : nb.id); setSecContextMenu(null); }}
                style={{ background: "none", border: "none", color: "#8899b4", cursor: "pointer", padding: "2px 4px", borderRadius: 4, opacity: 0, transition: "opacity 0.15s", marginLeft: 4, flexShrink: 0 }}
              >
                <MoreVertical size={14} />
              </button>
              {nbContextMenu === nb.id && (
                <div className="nb-context-menu" onClick={e => e.stopPropagation()} style={{
                  position: "absolute", right: 4, top: "100%", zIndex: 50,
                  background: "rgba(14,24,48,0.97)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "4px 0", minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}>
                  <button className="nb-ctx-item" onClick={() => openEditNotebook(nb.id)}>✏️ Edytuj</button>
                  <button className="nb-ctx-item" style={{ color: "#f87171" }} onClick={() => deleteNotebook(nb.id)}>🗑 Usuń</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button className="notes-bottom-btn" onClick={() => setShowNbModal(true)}>＋ Notes</button>
      </div>

      {/* Column 2: Sections within selected notebook */}
      <div className="sec-column">
        {activeNb ? (
          <>
            <div className="sec-col-header">
              <button
                className="notes-mobile-back"
                onClick={(e) => { e.stopPropagation(); setActiveNbId(null); setActiveSecId(null); }}
                aria-label="Wróć do notesów"
              >‹</button>
              <div className="sec-col-nb-name" style={{ color: activeNb.color }}>{activeNb.name}</div>
            </div>
            <div className="sec-col-list">
              {activeNb.sections.length === 0 ? (
                <div style={{ fontSize: ".8rem", color: "#8899b4", padding: "10px 12px" }}>Brak sekcji.</div>
              ) : activeNb.sections.map(sec => (
                <div
                  key={sec.id}
                  className={`sec-col-item ${activeSecId === sec.id ? "active" : ""} ${dragOverSecId === sec.id ? "drag-over" : ""}`}
                  onClick={() => selectSection(sec.id)}
                  style={{ position: "relative" }}
                  draggable
                  onDragStart={(e) => handleSectionDragStart(e, sec.id)}
                  onDragOver={(e) => handleSectionDragOver(e, sec.id)}
                  onDragLeave={() => setDragOverSecId(null)}
                  onDrop={(e) => handleSectionDrop(e, sec.id)}
                  onDragEnd={handleSectionDragEnd}
                >
                  <GripVertical size={12} className="sec-grip" />
                  <div style={{
                    width: 4, height: "100%", position: "absolute", left: 0, top: 0,
                    background: activeSecId === sec.id ? activeNb.color : "transparent",
                    borderRadius: "0 3px 3px 0",
                  }} />
                  <div className="sec-col-name">{sec.name}</div>
                  <div className="sec-col-count">{sec.pages.length}</div>
                  <button
                    className="sec-ctx-btn-col"
                    onClick={(e) => { e.stopPropagation(); setSecContextMenu(secContextMenu === sec.id ? null : sec.id); setNbContextMenu(null); }}
                  >
                    <MoreVertical size={12} />
                  </button>
                  {secContextMenu === sec.id && (
                    <div className="nb-context-menu" onClick={e => e.stopPropagation()} style={{
                      position: "absolute", right: 4, top: "100%", zIndex: 50,
                      background: "rgba(14,24,48,0.97)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: "4px 0", minWidth: 170, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    }}>
                      <button className="nb-ctx-item" onClick={() => renameSection(sec.id)}>✏️ Zmień nazwę</button>
                      <button className="nb-ctx-item" style={{ color: "#f87171" }} onClick={() => { setSecContextMenu(null); deleteSection(sec.id); }}>🗑 Usuń</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="notes-bottom-btn" onClick={addSection}>＋ Sekcja</button>
          </>
        ) : (
          <div className="no-note-selected" style={{ padding: 20 }}>
            <div style={{ fontSize: ".82rem", color: "#8899b4" }}>Wybierz notes</div>
          </div>
        )}
      </div>

      {/* Column 3: Pages within selected section */}
      <div className="pages-column">
        {activeSec ? (
          <>
            <div className="pages-col-header">
              <button
                className="notes-mobile-back"
                onClick={(e) => { e.stopPropagation(); setActiveSecId(null); }}
                aria-label="Wróć do sekcji"
              >‹</button>
              <span>{activeSec.name}</span>
              <span style={{ fontSize: ".72rem", color: "#8899b4", marginLeft: 8 }}>
                {activeSec.pages.length} {activeSec.pages.length === 1 ? "strona" : "stron"}
              </span>
            </div>
            <div className="pages-col-list">
              {activeSec.pages.length === 0 ? (
                <div className="pages-empty-state" style={{ fontSize: ".82rem", color: "#8899b4", padding: "20px 14px", textAlign: "center" }} onClick={() => addPage(activeSec.id)}>
                  Sekcja jest pusta — dodaj stronę.
                </div>
              ) : activeSec.pages.map(p => (
                <div
                  key={p.id}
                  className={`pages-col-item ${activePageId === p.id ? "active" : ""}`}
                  onClick={() => selectPage(p.id)}
                >
                  <div className="pages-col-item-title">{p.title || "Bez tytułu"}</div>
                  <div className="pages-col-item-preview">
                    {(() => {
                      const tmp = document.createElement("div");
                      tmp.innerHTML = p.content;
                      const txt = (tmp.textContent || "").trim();
                      if (!txt) return "Pusta strona";
                      const firstLine = txt.split(/\r?\n/)[0].trim();
                      return firstLine || "Pusta strona";
                    })()}
                  </div>
                </div>
              ))}
            </div>
            <button className="notes-bottom-btn" onClick={() => addPage(activeSec.id)}>＋ Strona</button>
          </>
        ) : activeNb ? (
          <div className="no-note-selected" style={{ padding: 20 }}>
            <div style={{ fontSize: ".82rem", color: "#8899b4" }}>Wybierz sekcję</div>
          </div>
        ) : (
          <div className="no-note-selected" style={{ padding: 20 }}>
            <div className="big-icon">📓</div>
            <div style={{ fontWeight: 700, fontSize: ".95rem" }}>Wybierz notes z panelu po lewej</div>
          </div>
        )}
      </div>

      {/* New Notebook Modal */}
      {showNbModal && (
        <div className="md-modal-overlay" onClick={() => setShowNbModal(false)}>
          <div className="md-modal" onClick={e => e.stopPropagation()}>
            <button className="md-modal-close" onClick={() => setShowNbModal(false)}>✕</button>
            <div className="md-modal-title">Nowy notes</div>
            <div className="md-form-group">
              <label>Nazwa notesu</label>
              <input value={nbName} onChange={e => setNbName(e.target.value)} placeholder="np. Matematyka kl. 3" />
            </div>
            <div className="md-form-group">
              <label>Kolor</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 280 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setNbColor(c)} style={{ width: 28, height: 28, borderRadius: 7, background: c, cursor: "pointer", border: nbColor === c ? "2px solid rgba(255,255,255,0.6)" : "2px solid transparent" }} />
                ))}
              </div>
            </div>
            <div className="md-modal-footer">
              <button className="md-btn" onClick={() => setShowNbModal(false)}>Anuluj</button>
              <button className="md-btn md-btn-prim" onClick={createNotebook}>Utwórz</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notebook Modal */}
      {editingNbId && (
        <div className="md-modal-overlay" onClick={() => setEditingNbId(null)}>
          <div className="md-modal" onClick={e => e.stopPropagation()}>
            <button className="md-modal-close" onClick={() => setEditingNbId(null)}>✕</button>
            <div className="md-modal-title">Edytuj notes</div>
            <div className="md-form-group">
              <label>Nazwa notesu</label>
              <input value={editNbName} onChange={e => setEditNbName(e.target.value)} />
            </div>
            <div className="md-form-group">
              <label>Kolor</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 280 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setEditNbColor(c)} style={{ width: 28, height: 28, borderRadius: 7, background: c, cursor: "pointer", border: editNbColor === c ? "2px solid rgba(255,255,255,0.6)" : "2px solid transparent" }} />
                ))}
              </div>
            </div>
            <div className="md-modal-footer">
              <button className="md-btn" onClick={() => setEditingNbId(null)}>Anuluj</button>
              <button className="md-btn md-btn-prim" onClick={saveEditNotebook}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesTab;
