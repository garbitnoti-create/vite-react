import { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

const firebaseConfig = {
  apiKey: "AIzaSyB34CnRd89JFmzJ5fwZvNFRdPDWKZmNkzA",
  authDomain: "vinter-cd8a9.firebaseapp.com",
  projectId: "vinter-cd8a9",
  storageBucket: "vinter-cd8a9.firebasestorage.app",
  messagingSenderId: "821143680988",
  appId: "1:821143680988:web:24f591ed6315f82e07c119",
  measurementId: "G-XE8EFPKW23"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const VENDEURS_INIT = [
  { nom: "Gateau", commission: 20 },
  { nom: "Gaga", commission: 20 },
  { nom: "Momo", commission: 20 },
  { nom: "Adoum", commission: 20 },
  { nom: "Cos", commission: 20 },
  { nom: "Cata", commission: 20 },
  { nom: "Piepie", commission: 20 },
  { nom: "adm JR", commission: 20 },
];

const CATEGORIES = ["Vêtements", "Chaussures", "Sacs", "Accessoires", "Sport", "Autre"];
const PRIORITES = ["Normale", "Haute", "Urgente"];
const fmt = (n: number) => Number(n || 0).toFixed(2).replace(".", ",") + " €";
const fmtDate = () => new Date().toLocaleDateString("fr-FR");
const moisActuel = () => { const d = new Date(); return `${d.getMonth()}-${d.getFullYear()}`; };
const moisLabel = () => new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

// ── Helpers semaine ──────────────────────────────────────────────────────────
// Retourne la clé "semaine" d'une date au format "dd/mm/yyyy"
const getSemaineKey = (dateStr: string): string => {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts.map(Number);
  const date = new Date(y, m - 1, d);
  // Lundi de la semaine
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const lundi = new Date(date);
  lundi.setDate(date.getDate() + diff);
  return `${lundi.getDate()}/${lundi.getMonth() + 1}/${lundi.getFullYear()}`;
};

const semaineActuelleKey = (): string => getSemaineKey(fmtDate());

const getMoisLabel = (moisKey: string) => {
  const [m, y] = moisKey.split("-").map(Number);
  const d = new Date(y, m, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
};

const params = new URLSearchParams(window.location.search);
const IS_ADMIN = params.get("admin") === "true";
const VENDEUR_PARAM = params.get("v")?.toLowerCase() || null;
const VENTE_PERSO_KEY = "__MOI__";

type Lot = {
  id: number;
  quantite: number;
  prixAchat: number;
  enAttente: boolean;
  dateAjout: string;
};

type ValidationStatut = "pending" | "accepted" | "refused" | undefined;

const S: any = {
  card: { backgroundColor: "#fff", borderRadius: "16px", padding: "16px", marginBottom: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #f1f5f9" },
  overlay: { position: "fixed" as const, inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 50, display: "flex", alignItems: "flex-end" },
  modal: { backgroundColor: "#f8fafc", width: "100%", borderTopLeftRadius: "24px", borderTopRightRadius: "24px", padding: "24px", maxHeight: "92vh", overflowY: "auto" as const },
  input: { width: "100%", backgroundColor: "#fff", color: "#1a1a2e", border: "2px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", fontSize: "15px", fontWeight: "500", outline: "none", boxSizing: "border-box" as const },
  btn: (bg: string, disabled: boolean) => ({ width: "100%", backgroundColor: disabled ? "#cbd5e1" : bg, color: "#fff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "16px", fontWeight: "800", cursor: disabled ? "not-allowed" : "pointer" }),
  label: { fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "6px" },
};

function Select({ value, onChange, options, placeholder }: any) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e: any) => onChange(e.target.value)}
        style={{ ...S.input, padding: "14px 40px 14px 16px", appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o: any) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748b", fontSize: "12px" }}>▼</div>
    </div>
  );
}

function TInput({ value, onChange, placeholder, type = "text" }: any) {
  return <input type={type} step={type === "number" ? "0.01" : undefined} value={value}
    onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} style={S.input} />;
}

function Field({ label, children }: any) {
  return <div><div style={S.label}>{label}</div>{children}</div>;
}

function MiniStat({ label, value, color }: any) {
  return (
    <div style={{ backgroundColor: "#f8fafc", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
      <div style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase" as const, fontWeight: "700" }}>{label}</div>
      <div style={{ fontSize: "13px", fontWeight: "800", color: color || "#1a1a2e", marginTop: "4px" }}>{value}</div>
    </div>
  );
}

function ArticlePhoto({ url, size = 48 }: { url?: string; size?: number }) {
  if (!url) return (
    <div style={{ width: size, height: size, borderRadius: "10px", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, flexShrink: 0 }}>
      📦
    </div>
  );
  return (
    <img src={url} alt="article" style={{ width: size, height: size, borderRadius: "10px", objectFit: "cover", flexShrink: 0, border: "1px solid #e2e8f0" }}
      onError={(e: any) => { e.target.style.display = "none"; }} />
  );
}

async function fbSave(key: string, data: any) {
  await setDoc(doc(db, "vinted", key), { data: JSON.stringify(data) });
}

function getPrixActuel(article: any): number {
  if (!article.lots || article.lots.length === 0) return article.prixAchat || 0;
  const lotDispo = article.lots.find((l: Lot) => !l.enAttente && l.quantite > 0);
  if (lotDispo) return lotDispo.prixAchat;
  const lotSuivant = article.lots.find((l: Lot) => !l.enAttente);
  if (lotSuivant) return lotSuivant.prixAchat;
  return article.lots[0]?.prixAchat || article.prixAchat || 0;
}

function getQuantiteDispo(article: any): number {
  if (!article.lots) return article.quantite || 0;
  return article.lots.filter((l: Lot) => !l.enAttente).reduce((s: number, l: Lot) => s + l.quantite, 0);
}

function getQuantiteAttente(article: any): number {
  if (!article.lots) return 0;
  return article.lots.filter((l: Lot) => l.enAttente).reduce((s: number, l: Lot) => s + l.quantite, 0);
}

function decrementeStock(article: any): any {
  if (!article.lots || article.lots.length === 0) {
    return { ...article, quantite: Math.max(0, (article.quantite || 0) - 1) };
  }
  let restADecrémenter = 1;
  const newLots = article.lots.map((l: Lot) => {
    if (restADecrémenter <= 0 || l.enAttente) return l;
    const deduct = Math.min(restADecrémenter, l.quantite);
    restADecrémenter -= deduct;
    return { ...l, quantite: l.quantite - deduct };
  });
  return { ...article, lots: newLots, quantite: getQuantiteDispo({ lots: newLots }) };
}

function incrementeStock(article: any): any {
  if (!article.lots || article.lots.length === 0) {
    return { ...article, quantite: (article.quantite || 0) + 1 };
  }
  const idx = article.lots.reduce((last: number, l: Lot, i: number) => (!l.enAttente ? i : last), -1);
  if (idx === -1) {
    const newLot: Lot = { id: Date.now(), quantite: 1, prixAchat: getPrixActuel(article), enAttente: false, dateAjout: fmtDate() };
    return { ...article, lots: [...article.lots, newLot], quantite: getQuantiteDispo(article) + 1 };
  }
  const newLots = article.lots.map((l: Lot, i: number) => i === idx ? { ...l, quantite: l.quantite + 1 } : l);
  return { ...article, lots: newLots, quantite: getQuantiteDispo({ lots: newLots }) };
}

function migrateArticle(article: any): any {
  if (article.lots) return article;
  const lot: Lot = {
    id: article.id,
    quantite: article.quantite || 0,
    prixAchat: article.prixAchat || 0,
    enAttente: false,
    dateAjout: article.dateAjout || fmtDate(),
  };
  return { ...article, lots: [lot] };
}

// ── Notification helper ──────────────────────────────────────────────────────
async function sendNotificationTache(nomVendeur: string, titreTache: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification(`📋 Nouvelle tâche pour ${nomVendeur}`, {
      body: titreTache,
      icon: "https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4cb.png",
    });
  }
}

function PageInconnue() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", padding: "24px" }}>
      <div style={{ fontSize: "52px" }}>🔒</div>
      <div style={{ fontWeight: "800", color: "#1a1a2e", fontSize: "20px", textAlign: "center" }}>Accès non autorisé</div>
      <div style={{ fontSize: "14px", color: "#94a3b8", textAlign: "center" }}>Demande ton lien personnel à l'administrateur.</div>
    </div>
  );
}

function BadgeValidation({ statut }: { statut: ValidationStatut }) {
  if (!statut) return null;
  const configs: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: "#fff7ed", color: "#ea580c", label: "⏳ En attente de validation" },
    refused:  { bg: "#fef2f2", color: "#ef4444", label: "❌ Validation refusée" },
    accepted: { bg: "#f0fdf4", color: "#16a34a", label: "✅ Validée" },
  };
  const cfg = configs[statut];
  if (!cfg) return null;
  return (
    <div style={{ marginTop: "8px", backgroundColor: cfg.bg, borderRadius: "8px", padding: "6px 10px", fontSize: "11px", fontWeight: "700", color: cfg.color }}>
      {cfg.label}
    </div>
  );
}

function BadgeAttente({ quantite }: { quantite: number }) {
  if (quantite <= 0) return null;
  return (
    <div style={{ backgroundColor: "#fff7ed", borderRadius: "8px", padding: "4px 8px", fontSize: "11px", fontWeight: "700", color: "#ea580c", display: "inline-flex", alignItems: "center", gap: "4px" }}>
      🚚 {quantite} en attente de livraison
    </div>
  );
}

// ── Sous-onglets période (Semaine / Mois / Total) ────────────────────────────
function PeriodeTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "14px", backgroundColor: "#f1f5f9", borderRadius: "12px", padding: "4px" }}>
      {[["semaine", "📅 Semaine"], ["mois", "🗓️ Mois"], ["total", "🏆 Total"]].map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          style={{ flex: 1, padding: "8px 4px", borderRadius: "8px", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer",
            backgroundColor: value === key ? "#1a1a2e" : "transparent",
            color: value === key ? "#fff" : "#64748b" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Classement vendeurs (utilisé dans admin + vendeur) ───────────────────────
function ClassementVendeurs({ vendeurs, ventes, nomVendeurCourant }: { vendeurs: any[]; ventes: any[]; nomVendeurCourant?: string }) {
  const [periode, setPeriode] = useState("semaine");

  const filteredVentes = useMemo(() => {
    if (periode === "semaine") return ventes.filter((v: any) => getSemaineKey(v.date) === semaineActuelleKey());
    if (periode === "mois") return ventes.filter((v: any) => v.mois === moisActuel());
    return ventes;
  }, [ventes, periode]);

  const classement = useMemo(() => {
    return vendeurs.map((v: any) => {
      const vv = filteredVentes.filter((x: any) => x.vendeur === v.nom);
      return { nom: v.nom, nb: vv.length, ca: vv.reduce((s: number, x: any) => s + x.prixVente, 0) };
    }).sort((a: any, b: any) => b.nb - a.nb || b.ca - a.ca);
  }, [filteredVentes, vendeurs]);

  const labelPeriode = periode === "semaine" ? "cette semaine" : periode === "mois" ? "ce mois" : "tous les temps";

  return (
    <div>
      <div style={{ fontSize: "13px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>🏆 Classement des vendeurs</div>
      <PeriodeTabs value={periode} onChange={setPeriode} />
      <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "10px", textAlign: "center" }}>Classement {labelPeriode}</div>
      {classement.every((v: any) => v.nb === 0)
        ? <div style={{ textAlign: "center", color: "#94a3b8", padding: "30px 0", fontSize: "13px" }}>Aucune vente {labelPeriode}</div>
        : classement.map((v: any, i: number) => (
          <div key={v.nom} style={{ ...S.card, border: nomVendeurCourant && v.nom.toLowerCase() === nomVendeurCourant.toLowerCase() ? "2px solid #e94560" : "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: i === 0 ? "#f7b731" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px", color: i < 3 ? "#fff" : "#64748b", flexShrink: 0 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700", color: "#1a1a2e", fontSize: "15px" }}>
                  {v.nom} {nomVendeurCourant && v.nom.toLowerCase() === nomVendeurCourant.toLowerCase() ? "👈 toi" : ""}
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{v.nb} vente(s)</div>
              </div>
              <div style={{ fontWeight: "800", color: "#4ecdc4", fontSize: "15px" }}>{fmt(v.ca)}</div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── APP VENDEUR ───────────────────────────────────────────────────────────────
function AppVendeur({ nomVendeur, vendeurs, stock, ventes, paiements, taches, onAddVente, onRequestValidation, onRequestTacheValidation }: any) {
  const [tab, setTab] = useState("ventes");
  const [showVente, setShowVente] = useState(false);
  const [venteForm, setVenteForm] = useState({ stockId: "", prixVente: "", note: "" });
  const [toast, setToast] = useState<any>(null);

  const showToast = (msg: string, color = "#22c55e") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  const stockDispo = stock.map(migrateArticle).filter((s: any) => getQuantiteDispo(s) > 0);

  const mesVentes = ventes.filter((v: any) =>
    v.vendeur.toLowerCase() === nomVendeur.toLowerCase() && v.validationStatut !== "accepted"
  );

  const mesTaches = taches.filter((t: any) =>
    t.assigneA.toLowerCase() === nomVendeur.toLowerCase() && t.validationStatut !== "accepted"
  );
  const monSolde = (() => {
    const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
    if (!vendeur) return 0;
    const totalDu = ventes.filter((v: any) => v.vendeur.toLowerCase() === nomVendeur.toLowerCase()).reduce((s: number, v: any) => s + v.commissionMontant, 0);
    const totalPaye = paiements.filter((p: any) => p.vendeur.toLowerCase() === nomVendeur.toLowerCase()).reduce((s: number, p: any) => s + p.montant, 0);
    return totalDu - totalPaye;
  })();

  const articleSelectionne = stock.map(migrateArticle).find((s: any) => s.id === +venteForm.stockId);

  const addVente = async () => {
    if (!venteForm.stockId || !venteForm.prixVente) return;
    const article = stock.map(migrateArticle).find((s: any) => s.id === +venteForm.stockId);
    const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
    if (!article || !vendeur) return;
    const prixVente = +venteForm.prixVente;
    const prixAchat = getPrixActuel(article);
    const benefBrut = prixVente - prixAchat;
    const commissionMontant = benefBrut * (vendeur.commission / 100);
    const partEntreprise = benefBrut - commissionMontant;
    const vente = { id: Date.now(), date: fmtDate(), mois: moisActuel(), vendeur: vendeur.nom, commission: vendeur.commission, article: article.nom, prixAchat, prixVente, benefBrut, commissionMontant, partEntreprise, note: venteForm.note, validationStatut: undefined };
    await onAddVente(vente, article.id);
    setVenteForm({ stockId: "", prixVente: "", note: "" });
    setShowVente(false);
    showToast(`Vente enregistrée ! Ta part : ${fmt(commissionMontant)} ✓`);
  };

  const handleRequestValidation = async (venteId: number) => {
    await onRequestValidation(venteId);
    showToast("Demande de validation envoyée ✓", "#f7b731");
  };

  const handleRequestTacheValidation = async (tacheId: number) => {
    await onRequestTacheValidation(tacheId);
    showToast("Demande de validation envoyée ✓", "#f7b731");
  };

  const nomAffiche = nomVendeur.charAt(0).toUpperCase() + nomVendeur.slice(1);
  const nbTachesEnCours = mesTaches.filter((t: any) => t.statut !== "Fait" && t.validationStatut !== "pending").length;

  const PRIORITE_COLOR: any = { "Haute": "#f7b731", "Urgente": "#e94560", "Normale": "#4ecdc4" };
  const STATUT_COLOR: any = { "À faire": "#94a3b8", "En cours": "#a29bfe", "Fait": "#22c55e" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "480px", margin: "0 auto" }}>
      {toast && <div style={{ position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.color, color: "#fff", padding: "12px 24px", borderRadius: "100px", fontSize: "14px", fontWeight: "700", zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{toast.msg}</div>}

      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: "#e94560", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.12em" }}>Vinted Business</div>
          <div style={{ fontSize: "22px", fontWeight: "800", marginTop: "2px" }}>Bonjour {nomAffiche} 👋</div>
        </div>
        <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", marginBottom: "10px" }}>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700", marginBottom: "4px" }}>💰 Total gagné</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#f7b731" }}>{fmt(ventes.filter((v: any) => v.vendeur.toLowerCase() === nomVendeur.toLowerCase()).reduce((s: number, v: any) => s + v.commissionMontant, 0))}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700" }}>✅ Déjà payé</div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#4ecdc4", marginTop: "4px" }}>{fmt(paiements.filter((p: any) => p.vendeur.toLowerCase() === nomVendeur.toLowerCase() && p.montant > 0).reduce((s: number, p: any) => s + p.montant, 0))}</div>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700" }}>🔴 Reste à payer</div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: monSolde > 0 ? "#e94560" : "#4ecdc4", marginTop: "4px" }}>{fmt(monSolde)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "4px" }}>
          {[["ventes", "🛍️ Mes ventes"], ["taches", nbTachesEnCours > 0 ? `🗒️ Tâches (${nbTachesEnCours})` : "🗒️ Tâches"], ["classement", "🏆 Top"], ["stock", "📦 Stock"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "10px 4px", borderRadius: "10px", border: "none", fontSize: "10px", fontWeight: "700", cursor: "pointer", backgroundColor: tab === key ? "#e94560" : "transparent", color: tab === key ? "#fff" : "rgba(255,255,255,0.45)" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ height: "16px" }} />
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        {tab === "ventes" && (
          mesVentes.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}><div style={{ fontSize: "52px" }}>🛍️</div><div style={{ fontWeight: "700", marginTop: "12px" }}>Aucune vente</div><div style={{ fontSize: "13px", marginTop: "4px" }}>Appuie sur + pour en ajouter une</div></div>
            : mesVentes.map((v: any) => (
              <div key={v.id} style={S.card}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <ArticlePhoto url={v.photoUrl} size={52} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "700", fontSize: "16px", color: "#1a1a2e" }}>{v.article}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{v.date}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
                  <MiniStat label="Vendu" value={fmt(v.prixVente)} color="#4ecdc4" />
                  <MiniStat label="Ma commission" value={fmt(v.commissionMontant)} color="#e94560" />
                </div>
                {v.note && <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>📝 {v.note}</div>}
                <BadgeValidation statut={v.validationStatut} />
                {v.validationStatut !== "pending" && (
                  <button
                    onClick={() => handleRequestValidation(v.id)}
                    style={{ marginTop: "10px", width: "100%", backgroundColor: v.validationStatut === "refused" ? "#fff7ed" : "#f0fdf4", color: v.validationStatut === "refused" ? "#ea580c" : "#16a34a", border: `1.5px solid ${v.validationStatut === "refused" ? "#fed7aa" : "#bbf7d0"}`, borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                    {v.validationStatut === "refused" ? "🔄 Re-soumettre la validation" : "✅ Valider la vente"}
                  </button>
                )}
              </div>
            ))
        )}

        {tab === "taches" && (
          mesTaches.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}><div style={{ fontSize: "52px" }}>🗒️</div><div style={{ fontWeight: "700", marginTop: "12px" }}>Aucune tâche</div><div style={{ fontSize: "13px", marginTop: "4px" }}>Pas de tâche assignée pour l'instant</div></div>
            : mesTaches.map((t: any) => (
              <div key={t.id} style={{ ...S.card, opacity: t.statut === "Fait" ? 0.55 : 1, borderLeft: `4px solid ${PRIORITE_COLOR[t.priorite] || "#94a3b8"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e", textDecoration: t.statut === "Fait" ? "line-through" : "none" }}>{t.titre}</div>
                    {t.description && <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{t.description}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", marginLeft: "10px" }}>
                    <span style={{ backgroundColor: PRIORITE_COLOR[t.priorite] + "22", color: PRIORITE_COLOR[t.priorite], fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", whiteSpace: "nowrap" }}>{t.priorite}</span>
                    <span style={{ backgroundColor: STATUT_COLOR[t.statut] + "22", color: STATUT_COLOR[t.statut], fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", whiteSpace: "nowrap" }}>{t.statut}</span>
                  </div>
                </div>
                {t.echeance && <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>📅 Échéance : {t.echeance}</div>}
                <BadgeValidation statut={t.validationStatut} />
                {t.validationStatut !== "pending" && (
                  <button
                    onClick={() => handleRequestTacheValidation(t.id)}
                    style={{ marginTop: "10px", width: "100%", backgroundColor: t.validationStatut === "refused" ? "#fff7ed" : "#f0fdf4", color: t.validationStatut === "refused" ? "#ea580c" : "#16a34a", border: `1.5px solid ${t.validationStatut === "refused" ? "#fed7aa" : "#bbf7d0"}`, borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                    {t.validationStatut === "refused" ? "🔄 Re-soumettre la validation" : "✅ Valider la tâche"}
                  </button>
                )}
              </div>
            ))
        )}

        {/* ── CLASSEMENT VENDEUR : maintenant avec sous-onglets période ── */}
        {tab === "classement" && (
          <ClassementVendeurs vendeurs={vendeurs} ventes={ventes} nomVendeurCourant={nomVendeur} />
        )}

        {tab === "stock" && (
          stock.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}><div style={{ fontSize: "52px" }}>📦</div><div style={{ fontWeight: "700", marginTop: "12px" }}>Stock vide</div></div>
            : stock.map(migrateArticle).map((s: any) => {
                const dispo = getQuantiteDispo(s);
                const attente = getQuantiteAttente(s);
                return (
                  <div key={s.id} style={{ ...S.card, opacity: dispo === 0 && attente === 0 ? 0.4 : 1 }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <ArticlePhoto url={s.photoUrl} size={56} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e" }}>{s.nom}</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{s.categorie}</div>
                        {attente > 0 && <div style={{ marginTop: "4px" }}><BadgeAttente quantite={attente} /></div>}
                      </div>
                      <div style={{ fontSize: "26px", fontWeight: "800", color: dispo === 0 ? "#ef4444" : "#22c55e" }}>×{dispo}</div>
                    </div>
                  </div>
                );
              })
        )}
      </div>

      {tab === "ventes" && (
        <button onClick={() => setShowVente(true)} style={{ position: "fixed", bottom: "32px", right: "20px", width: "58px", height: "58px", borderRadius: "50%", backgroundColor: "#e94560", border: "none", fontSize: "30px", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(233,69,96,0.5)", fontWeight: "700", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
      )}

      {showVente && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowVente(false)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>🛍️ Nouvelle vente</div>
              <button onClick={() => setShowVente(false)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Article vendu">
                {stockDispo.length === 0
                  ? <div style={{ backgroundColor: "#fef2f2", color: "#ef4444", padding: "14px", borderRadius: "12px", fontSize: "13px", fontWeight: "600", textAlign: "center" }}>⚠️ Stock vide</div>
                  : <Select value={venteForm.stockId} onChange={(v: string) => setVenteForm({ ...venteForm, stockId: v })} placeholder="Choisir un article..."
                      options={stockDispo.map((s: any) => ({ value: String(s.id), label: `${s.nom} (×${getQuantiteDispo(s)})` }))} />
                }
              </Field>
              {articleSelectionne && articleSelectionne.photoUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#f8fafc", borderRadius: "12px", padding: "10px" }}>
                  <ArticlePhoto url={articleSelectionne.photoUrl} size={64} />
                  <div>
                    <div style={{ fontWeight: "700", color: "#1a1a2e" }}>{articleSelectionne.nom}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{articleSelectionne.categorie}</div>
                  </div>
                </div>
              )}
              <Field label="Prix de vente (€)">
                <TInput type="number" value={venteForm.prixVente} onChange={(v: string) => setVenteForm({ ...venteForm, prixVente: v })} placeholder="Ex: 50" />
              </Field>
              {venteForm.stockId && venteForm.prixVente && (() => {
                const article = stock.map(migrateArticle).find((s: any) => s.id === +venteForm.stockId);
                const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
                if (!article || !vendeur) return null;
                const prixAchat = getPrixActuel(article);
                const benef = +venteForm.prixVente - prixAchat;
                const comm = benef * vendeur.commission / 100;
                return (
                  <div style={{ backgroundColor: "#f0fdf4", borderRadius: "14px", padding: "14px", border: "2px solid #bbf7d0", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", fontWeight: "800", color: "#16a34a", marginBottom: "8px", textTransform: "uppercase" }}>Ta commission</div>
                    <div style={{ fontSize: "28px", fontWeight: "800", color: "#e94560" }}>{fmt(comm)}</div>
                  </div>
                );
              })()}
              <Field label="Note (optionnel)">
                <TInput value={venteForm.note} onChange={(v: string) => setVenteForm({ ...venteForm, note: v })} placeholder="Ex: client satisfait" />
              </Field>
              <button onClick={addVente} disabled={!venteForm.stockId || !venteForm.prixVente} style={S.btn("#e94560", !venteForm.stockId || !venteForm.prixVente)}>Enregistrer ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulaire ajout vendeur (utilisé dans les settings) ────────────────────
function NouveauVendeurForm({ vendeurs, setVendeurs, showToast }: any) {
  const [nom, setNom] = useState("");
  const [comm, setComm] = useState("20");
  return (
    <div style={{ backgroundColor: "#f8fafc", border: "2px dashed #e2e8f0", borderRadius: "14px", padding: "14px", marginBottom: "16px" }}>
      <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" as const, marginBottom: "10px" }}>➕ Ajouter un vendeur</div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input type="text" value={nom} onChange={(e: any) => setNom(e.target.value)} placeholder="Nom du vendeur"
          style={{ ...S.input, flex: 1, padding: "10px 14px", fontSize: "14px" }} />
        <input type="number" value={comm} onChange={(e: any) => setComm(e.target.value)} min="0" max="100" placeholder="20"
          style={{ ...S.input, width: "60px", padding: "10px", textAlign: "center" as const, fontSize: "14px" }} />
        <span style={{ color: "#64748b", fontWeight: "700", fontSize: "15px" }}>%</span>
        <button onClick={() => {
          const n = nom.trim();
          if (!n) return;
          if (vendeurs.find((v: any) => v.nom.toLowerCase() === n.toLowerCase())) {
            showToast("Ce vendeur existe déjà !", "#ef4444"); return;
          }
          setVendeurs((prev: any) => [...prev, { nom: n, commission: +comm || 20 }]);
          setNom(""); setComm("20");
          showToast(`${n} ajouté ✓`);
        }} style={{ backgroundColor: "#1a1a2e", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 14px", fontWeight: "700", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" as const }}>
          ✓ Ajouter
        </button>
      </div>
    </div>
  );
}

// ─── APP ADMIN ─────────────────────────────────────────────────────────────────
function AppAdmin({ vendeurs, setVendeurs, stock, setStock, ventes, setVentes, paiements, setPaiements, taches, setTaches, save }: any) {
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState<any>(null);
  const [showVente, setShowVente] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editStock, setEditStock] = useState<any>(null);
  const [showPaiement, setShowPaiement] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [venteForm, setVenteForm] = useState({ vendeur: VENTE_PERSO_KEY, stockId: "", prixVente: "", note: "" });

  // ── Sous-onglet période dans l'onglet vendeurs ──
  const [vendeurPeriode, setVendeurPeriode] = useState("semaine");

  const [stockForm, setStockForm] = useState({ nom: "", categorie: "Vêtements", prixAchat: "", quantite: "1", photoUrl: "" });
  const [lotForm, setLotForm] = useState({ quantite: "1", prixAchat: "" });
  const [paiementForm, setPaiementForm] = useState({ montant: "", note: "" });
  const [showAjustement, setShowAjustement] = useState<any>(null);
  const [ajustementForm, setAjustementForm] = useState({ montant: "", note: "", type: "prime" });
  const [showTache, setShowTache] = useState(false);
  const [tacheForm, setTacheForm] = useState({ titre: "", description: "", assigneA: "", priorite: "Normale", echeance: "" });

  const showToast = (msg: string, color = "#22c55e") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };
  const saveSync = async (key: string, data: any) => { setSyncing(true); await save(key, data); setTimeout(() => setSyncing(false), 800); };

  const stockMigre = useMemo(() => stock.map(migrateArticle), [stock]);
  const stockDispo = stockMigre.filter((s: any) => getQuantiteDispo(s) > 0);
  const ventesMonth = useMemo(() => ventes.filter((v: any) => v.mois === moisActuel()), [ventes]);
  const ventesPending = useMemo(() => ventes.filter((v: any) => v.validationStatut === "pending"), [ventes]);

  const nbLotsEnAttente = useMemo(() => stockMigre.reduce((total: number, s: any) => {
    return total + (s.lots || []).filter((l: Lot) => l.enAttente).length;
  }, 0), [stockMigre]);

  // ── Ventes filtrées selon la période choisie dans l'onglet vendeurs ──
  const ventesParPeriodeVendeurs = useMemo(() => {
    if (vendeurPeriode === "semaine") return ventes.filter((v: any) => getSemaineKey(v.date) === semaineActuelleKey());
    if (vendeurPeriode === "mois") return ventes.filter((v: any) => v.mois === moisActuel());
    return ventes;
  }, [ventes, vendeurPeriode]);

  const stats = useMemo(() => ({
    ca: ventes.reduce((s: number, v: any) => s + v.prixVente, 0),
    caMonth: ventesMonth.reduce((s: number, v: any) => s + v.prixVente, 0),
    benef: ventes.reduce((s: number, v: any) => s + v.partEntreprise, 0),
    benefMonth: ventesMonth.reduce((s: number, v: any) => s + v.partEntreprise, 0),
    commissions: ventes.reduce((s: number, v: any) => s + v.commissionMontant, 0),
    commissionsMonth: ventesMonth.reduce((s: number, v: any) => s + v.commissionMontant, 0),
    nbVentes: ventes.length, nbVentesMonth: ventesMonth.length,
  }), [ventes, ventesMonth]);

  const dataCAMois = useMemo(() => {
    const map: Record<string, { ca: number; benef: number }> = {};
    ventes.forEach((v: any) => {
      if (!map[v.mois]) map[v.mois] = { ca: 0, benef: 0 };
      map[v.mois].ca += v.prixVente;
      map[v.mois].benef += v.partEntreprise;
    });
    return Object.entries(map)
      .sort((a, b) => {
        const [ma, ya] = a[0].split("-").map(Number);
        const [mb, yb] = b[0].split("-").map(Number);
        return ya !== yb ? ya - yb : ma - mb;
      })
      .slice(-6)
      .map(([mois, vals]) => ({ mois: getMoisLabel(mois), ...vals }));
  }, [ventes]);

  const dataTopArticles = useMemo(() => {
    const map: Record<string, number> = {};
    ventes.forEach((v: any) => { map[v.article] = (map[v.article] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nom, nb]) => ({ nom: nom.length > 14 ? nom.slice(0, 14) + "…" : nom, nb }));
  }, [ventes]);

  // ── Stats vendeurs selon la période ──
  const statsVendeurs = useMemo(() => vendeurs.map((v: any) => {
    const vv = ventes.filter((x: any) => x.vendeur === v.nom);
    const vvM = ventesMonth.filter((x: any) => x.vendeur === v.nom);
    const totalDu = vv.reduce((s: number, x: any) => s + x.commissionMontant, 0);
    const totalPaye = paiements.filter((p: any) => p.vendeur === v.nom).reduce((s: number, p: any) => s + p.montant, 0);
    return { ...v, nb: vv.length, nbMonth: vvM.length, ca: vv.reduce((s: number, x: any) => s + x.prixVente, 0), commissionTotal: totalDu, commissionMonth: vvM.reduce((s: number, x: any) => s + x.commissionMontant, 0), totalPaye, solde: totalDu - totalPaye };
  }), [ventes, ventesMonth, paiements, vendeurs]);

  // ── Stats vendeurs filtrées par période (pour l'onglet vendeurs) ──
  const statsVendeursPeriode = useMemo(() => vendeurs.map((v: any) => {
    const vv = ventesParPeriodeVendeurs.filter((x: any) => x.vendeur === v.nom);
    const totalDu = ventes.filter((x: any) => x.vendeur === v.nom).reduce((s: number, x: any) => s + x.commissionMontant, 0);
    const totalPaye = paiements.filter((p: any) => p.vendeur === v.nom).reduce((s: number, p: any) => s + p.montant, 0);
    return {
      ...v,
      nb: vv.length,
      ca: vv.reduce((s: number, x: any) => s + x.prixVente, 0),
      commissionPeriode: vv.reduce((s: number, x: any) => s + x.commissionMontant, 0),
      commissionTotal: totalDu,
      totalPaye,
      solde: totalDu - totalPaye,
    };
  }), [ventesParPeriodeVendeurs, ventes, paiements, vendeurs]);

  // ── Classement vendeurs par période (pour l'onglet vendeurs admin) ──
  const classementPeriode = useMemo(() => {
    return [...statsVendeursPeriode].sort((a: any, b: any) => b.nb - a.nb || b.ca - a.ca);
  }, [statsVendeursPeriode]);

  const articleVenteSelectionne = stockMigre.find((s: any) => s.id === +venteForm.stockId);

  const handleValidation = async (venteId: number, decision: "accepted" | "refused") => {
    const newVentes = ventes.map((v: any) => v.id === venteId ? { ...v, validationStatut: decision } : v);
    setVentes(newVentes);
    await saveSync("ventes", newVentes);
    showToast(decision === "accepted" ? "Vente validée et archivée ✓" : "Validation refusée", decision === "accepted" ? "#22c55e" : "#ef4444");
  };

  const addStock = async () => {
    if (!stockForm.nom || !stockForm.prixAchat) return;
    const premierLot: Lot = {
      id: Date.now(),
      quantite: +stockForm.quantite,
      prixAchat: +stockForm.prixAchat,
      enAttente: true,
      dateAjout: fmtDate(),
    };
    const newArticle = {
      id: Date.now() + 1,
      nom: stockForm.nom,
      categorie: stockForm.categorie,
      prixAchat: +stockForm.prixAchat,
      quantite: 0,
      photoUrl: stockForm.photoUrl,
      mois: moisActuel(),
      lots: [premierLot],
    };
    const newStock = [...stock, newArticle];
    setStock(newStock); await saveSync("stock", newStock);
    setStockForm({ nom: "", categorie: "Vêtements", prixAchat: "", quantite: "1", photoUrl: "" });
    setShowStock(false);
    showToast("Article ajouté — en attente de livraison 🚚");
  };

  const saveEditStock = async () => {
    if (!editStock) return;
    const newStock = stockMigre.map((s: any) => s.id === editStock.id
      ? { ...editStock, prixAchat: +editStock.prixAchat, quantite: getQuantiteDispo(editStock) }
      : s
    );
    setStock(newStock); await saveSync("stock", newStock);
    setEditStock(null); showToast("Stock modifié ✓");
  };

  const livrerLot = async (articleId: number, lotId: number) => {
    const newStock = stockMigre.map((s: any) => {
      if (s.id !== articleId) return s;
      const newLots = s.lots.map((l: Lot) => l.id === lotId ? { ...l, enAttente: false } : l);
      return { ...s, lots: newLots, quantite: getQuantiteDispo({ lots: newLots }) };
    });
    setStock(newStock); await saveSync("stock", newStock);
    showToast("Stock disponible mis à jour ✓");
  };

  const deleteStock = async (id: number) => {
    const newStock = stock.filter((s: any) => s.id !== id);
    setStock(newStock); await saveSync("stock", newStock);
    setEditStock(null); showToast("Article supprimé", "#ef4444");
  };

  const addVente = async () => {
    if (!venteForm.stockId || !venteForm.prixVente) return;
    const article = stockMigre.find((s: any) => s.id === +venteForm.stockId);
    if (!article) return;
    const isVentePerso = venteForm.vendeur === VENTE_PERSO_KEY;
    const vendeur = isVentePerso ? null : vendeurs.find((v: any) => v.nom === venteForm.vendeur);
    if (!isVentePerso && !vendeur) return;
    const prixVente = +venteForm.prixVente;
    const prixAchat = getPrixActuel(article);
    const benefBrut = prixVente - prixAchat;
    const commissionMontant = isVentePerso ? 0 : benefBrut * (vendeur!.commission / 100);
    const partEntreprise = benefBrut - commissionMontant;
    const vente = {
      id: Date.now(), date: fmtDate(), mois: moisActuel(),
      vendeur: isVentePerso ? "Moi" : vendeur!.nom,
      commission: isVentePerso ? 0 : vendeur!.commission,
      ventePerso: isVentePerso,
      article: article.nom,
      photoUrl: article.photoUrl || "",
      prixAchat, prixVente, benefBrut, commissionMontant, partEntreprise, note: venteForm.note,
      validationStatut: undefined,
    };
    const newVentes = [vente, ...ventes];
    const newStock = stockMigre.map((s: any) => s.id === article.id ? decrementeStock(s) : s);
    setVentes(newVentes); setStock(newStock);
    await Promise.all([saveSync("ventes", newVentes), saveSync("stock", newStock)]);
    setVenteForm({ vendeur: VENTE_PERSO_KEY, stockId: "", prixVente: "", note: "" });
    setShowVente(false);
    showToast(isVentePerso ? `Vente perso ! Bénéfice : ${fmt(partEntreprise)} ✓` : `Bénéfice entreprise : ${fmt(partEntreprise)} ✓`);
  };

  const deleteVente = async (id: number) => {
    const v = ventes.find((x: any) => x.id === id);
    const newVentes = ventes.filter((x: any) => x.id !== id);
    const newStock = v ? stockMigre.map((s: any) => s.nom === v.article ? incrementeStock(s) : s) : stockMigre;
    setVentes(newVentes); setStock(newStock);
    await Promise.all([saveSync("ventes", newVentes), saveSync("stock", newStock)]);
    showToast("Vente supprimée", "#ef4444");
  };

  const addPaiement = async () => {
    if (!showPaiement || !paiementForm.montant) return;
    const p = { id: Date.now(), vendeur: showPaiement, montant: +paiementForm.montant, date: fmtDate(), note: paiementForm.note };
    const newP = [p, ...paiements];
    setPaiements(newP); await saveSync("paiements", newP);
    setPaiementForm({ montant: "", note: "" }); setShowPaiement(null);
    showToast(`Paiement de ${fmt(+paiementForm.montant)} enregistré ✓`);
  };

  const addAjustement = async () => {
    if (!showAjustement || !ajustementForm.montant) return;
    const montant = ajustementForm.type === "prime" ? +ajustementForm.montant : -Math.abs(+ajustementForm.montant);
    const p = { id: Date.now(), vendeur: showAjustement, montant: -montant, date: fmtDate(), note: ajustementForm.note || (ajustementForm.type === "prime" ? "Prime" : ajustementForm.type === "dette" ? "Dette initiale" : "Déduction"), type: ajustementForm.type };
    const newP = [p, ...paiements];
    setPaiements(newP); await saveSync("paiements", newP);
    setAjustementForm({ montant: "", note: "", type: "prime" }); setShowAjustement(null);
    showToast(`Ajustement enregistré ✓`);
  };

  // ── Ajout tâche avec notification ──
  const addTache = async () => {
    if (!tacheForm.titre || !tacheForm.assigneA) return;
    const t = { id: Date.now(), date: fmtDate(), statut: "À faire", ...tacheForm };
    const newTaches = [t, ...taches];
    setTaches(newTaches); await saveSync("taches", newTaches);
    setTacheForm({ titre: "", description: "", assigneA: "", priorite: "Normale", echeance: "" });
    setShowTache(false);
    showToast("Tâche ajoutée ✓");
    // Envoi notification
    await sendNotificationTache(tacheForm.assigneA, tacheForm.titre);
  };

  const cycleStatut = async (id: number) => {
    const CYCLE = ["À faire", "En cours", "Fait"];
    const newTaches = taches.map((t: any) => t.id === id ? { ...t, statut: CYCLE[(CYCLE.indexOf(t.statut) + 1) % CYCLE.length] } : t);
    setTaches(newTaches); await saveSync("taches", newTaches);
  };

  const deleteTache = async (id: number) => {
    const newTaches = taches.filter((t: any) => t.id !== id);
    setTaches(newTaches); await saveSync("taches", newTaches);
    showToast("Tâche supprimée", "#ef4444");
  };

  const saveVendeurs = async () => { await saveSync("vendeurs", vendeurs); setShowSettings(false); showToast("Commissions sauvegardées ✓"); };

  const PRIORITE_COLOR: any = { "Haute": "#f7b731", "Urgente": "#e94560", "Normale": "#4ecdc4" };
  const STATUT_COLOR: any = { "À faire": "#94a3b8", "En cours": "#a29bfe", "Fait": "#22c55e" };

  const CustomTooltipCA = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: "#1a1a2e", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#fff" }}>
          <div style={{ fontWeight: "700", marginBottom: "4px" }}>{label}</div>
          {payload.map((p: any) => (
            <div key={p.name} style={{ color: p.color }}>{p.name === "ca" ? "CA" : "Bénéfice"} : {fmt(p.value)}</div>
          ))}
        </div>
      );
    }
    return null;
  };

  const tachesPending = useMemo(() => taches.filter((t: any) => t.validationStatut === "pending"), [taches]);
  const tachesAffichees = taches.filter((t: any) => t.validationStatut !== "accepted");
  const nbTachesEnCours = tachesAffichees.filter((t: any) => t.statut !== "Fait").length + tachesPending.length;

  const handleTacheValidation = async (tacheId: number, decision: "accepted" | "refused") => {
    const newTaches = taches.map((t: any) => t.id === tacheId ? { ...t, validationStatut: decision } : t);
    setTaches(newTaches);
    await saveSync("taches", newTaches);
    showToast(decision === "accepted" ? "Tâche validée et archivée ✓" : "Validation refusée", decision === "accepted" ? "#22c55e" : "#ef4444");
  };

  const ventesAffichees = ventes.filter((v: any) => v.validationStatut !== "accepted");

  // ── Label de la période courante ──
  const labelPeriodeVendeurs = vendeurPeriode === "semaine"
    ? `semaine du ${semaineActuelleKey()}`
    : vendeurPeriode === "mois"
    ? moisLabel()
    : "tous les temps";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "480px", margin: "0 auto" }}>
      {toast && <div style={{ position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.color, color: "#fff", padding: "12px 24px", borderRadius: "100px", fontSize: "14px", fontWeight: "700", zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{toast.msg}</div>}

      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ color: "#e94560", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.12em" }}>Vinted Business · Admin 👑</div>
            <div style={{ fontSize: "22px", fontWeight: "800", marginTop: "2px" }}>Mes Comptes 💼</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {syncing && <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#4ecdc4" }} />}
            <button onClick={() => setShowSettings(true)} style={{ width: "42px", height: "42px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.12)", border: "none", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙️</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          {[["🏢 Bénéfice entreprise", fmt(stats.benef), "#e94560"], ["🏷️ CA total", fmt(stats.ca), "#4ecdc4"], ["📅 Bénéfice ce mois", fmt(stats.benefMonth), "#a29bfe"], ["📦 Ventes total", `${stats.nbVentes}`, "#f7b731"]].map(([l, v, c]: any) => (
            <div key={l} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700" }}>{l}</div>
              <div style={{ fontSize: "16px", fontWeight: "800", color: c, marginTop: "4px" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "4px" }}>
          {[
            ["dashboard", "📊"],
            ["ventes", ventesPending.length > 0 ? `🛍️${ventesPending.length}` : "🛍️"],
            ["stock", nbLotsEnAttente > 0 ? `📦${nbLotsEnAttente}` : "📦"],
            ["vendeurs", "👥"],
            ["taches", (nbTachesEnCours + tachesPending.length) > 0 ? `🗒️${nbTachesEnCours + tachesPending.length}` : "🗒️"]
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "10px 4px", borderRadius: "10px", border: "none", fontSize: "14px", cursor: "pointer", backgroundColor: tab === key ? "#e94560" : "transparent", color: tab === key ? "#fff" : "rgba(255,255,255,0.45)", position: "relative" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ height: "16px" }} />
      </div>

      <div style={{ padding: "16px 16px 100px" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>📅 Ce mois — {moisLabel()}</div>
            <div style={{ ...S.card, background: "linear-gradient(135deg, #1a1a2e 0%, #2d2d5e 100%)", color: "#fff" }}>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>Bénéfice entreprise ce mois</div>
              <div style={{ fontSize: "36px", fontWeight: "800", color: "#e94560" }}>{fmt(stats.benefMonth)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "16px" }}>
                {[["CA", fmt(stats.caMonth), "#4ecdc4"], ["Commissions", fmt(stats.commissionsMonth), "#f7b731"], ["Ventes", stats.nbVentesMonth, "#a29bfe"]].map(([l, v, c]: any) => (
                  <div key={l} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontWeight: "700" }}>{l}</div>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: c, marginTop: "4px" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {ventesPending.length > 0 && (
              <div style={{ backgroundColor: "#fff7ed", border: "2px solid #fed7aa", borderRadius: "14px", padding: "14px", marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontSize: "24px" }}>⏳</div>
                <div>
                  <div style={{ fontWeight: "800", color: "#ea580c", fontSize: "14px" }}>{ventesPending.length} validation(s) vente en attente</div>
                  <div style={{ fontSize: "12px", color: "#9a3412", marginTop: "2px" }}>Vérifie l'onglet Ventes 🛍️</div>
                </div>
              </div>
            )}
            {tachesPending.length > 0 && (
              <div style={{ backgroundColor: "#f5f3ff", border: "2px solid #ddd6fe", borderRadius: "14px", padding: "14px", marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontSize: "24px" }}>⏳</div>
                <div>
                  <div style={{ fontWeight: "800", color: "#7c3aed", fontSize: "14px" }}>{tachesPending.length} validation(s) tâche en attente</div>
                  <div style={{ fontSize: "12px", color: "#5b21b6", marginTop: "2px" }}>Vérifie l'onglet Tâches 🗒️</div>
                </div>
              </div>
            )}
            {nbLotsEnAttente > 0 && (
              <div style={{ backgroundColor: "#fff7ed", border: "2px solid #fed7aa", borderRadius: "14px", padding: "14px", marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontSize: "24px" }}>🚚</div>
                <div>
                  <div style={{ fontWeight: "800", color: "#ea580c", fontSize: "14px" }}>{nbLotsEnAttente} lot(s) en attente de livraison</div>
                  <div style={{ fontSize: "12px", color: "#9a3412", marginTop: "2px" }}>Vérifie l'onglet Stock 📦</div>
                </div>
              </div>
            )}

            {dataCAMois.length > 1 && (
              <div style={{ ...S.card, marginTop: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "800", color: "#1a1a2e", marginBottom: "16px" }}>📈 CA & Bénéfice par mois</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={dataCAMois} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip content={<CustomTooltipCA />} />
                    <Line type="monotone" dataKey="ca" stroke="#4ecdc4" strokeWidth={2.5} dot={{ r: 4, fill: "#4ecdc4" }} name="ca" />
                    <Line type="monotone" dataKey="benef" stroke="#e94560" strokeWidth={2.5} dot={{ r: 4, fill: "#e94560" }} name="benef" />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#64748b" }}><div style={{ width: 12, height: 3, backgroundColor: "#4ecdc4", borderRadius: 2 }} />CA</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#64748b" }}><div style={{ width: 12, height: 3, backgroundColor: "#e94560", borderRadius: 2 }} />Bénéfice</div>
                </div>
              </div>
            )}

            {dataTopArticles.length > 0 && (
              <div style={{ ...S.card, marginTop: "12px" }}>
                <div style={{ fontSize: "13px", fontWeight: "800", color: "#1a1a2e", marginBottom: "16px" }}>🏆 Top articles les plus vendus</div>
                <ResponsiveContainer width="100%" height={dataTopArticles.length * 38 + 20}>
                  <BarChart data={dataTopArticles} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="nom" tick={{ fontSize: 11, fill: "#64748b" }} width={90} />
                    <Tooltip formatter={(v: any) => [`${v} vente(s)`, ""]} contentStyle={{ borderRadius: "10px", fontSize: "12px" }} />
                    <Bar dataKey="nb" fill="#a29bfe" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ fontSize: "13px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px", marginTop: "20px" }}>👥 Soldes vendeurs</div>
            {statsVendeurs.filter((v: any) => v.solde > 0).map((v: any) => (
              <div key={v.nom} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: "700", color: "#1a1a2e", fontSize: "15px" }}>{v.nom}</div>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#e94560" }}>Doit {fmt(v.solde)}</div>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{v.nb} vente(s) · Commission : {fmt(v.commissionTotal)}</div>
              </div>
            ))}
            {statsVendeurs.filter((v: any) => v.solde > 0).length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>Tous les vendeurs sont soldés ✅</div>}

            <div style={{ fontSize: "13px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px", marginTop: "20px" }}>📈 Tous les temps</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {[["CA Total", fmt(stats.ca), "#4ecdc4"], ["Bénéfice", fmt(stats.benef), "#e94560"], ["Commissions dues", fmt(stats.commissions), "#f7b731"], ["Nb ventes", stats.nbVentes, "#a29bfe"]].map(([l, v, c]: any) => (
                <div key={l} style={S.card}>
                  <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>{l}</div>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: c, marginTop: "6px" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── VENTES ── */}
        {tab === "ventes" && (
          <div>
            {ventesPending.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
                  ⏳ Validations en attente ({ventesPending.length})
                </div>
                {ventesPending.map((v: any) => (
                  <div key={v.id} style={{ ...S.card, border: "2px solid #fed7aa", backgroundColor: "#fffbf5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1 }}>
                        <ArticlePhoto url={v.photoUrl} size={48} />
                        <div>
                          <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e" }}>{v.article}</div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{v.date} · {v.vendeur}</div>
                          <div style={{ fontSize: "12px", color: "#ea580c", fontWeight: "700", marginTop: "2px" }}>Demande de validation</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
                      <MiniStat label="Vendu" value={fmt(v.prixVente)} color="#4ecdc4" />
                      <MiniStat label="Entreprise" value={fmt(v.partEntreprise)} color="#e94560" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
                      <button onClick={() => handleValidation(v.id, "accepted")}
                        style={{ backgroundColor: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}>
                        ✅ Accepter
                      </button>
                      <button onClick={() => handleValidation(v.id, "refused")}
                        style={{ backgroundColor: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}>
                        ❌ Refuser
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "16px 0" }} />
              </div>
            )}

            {ventesAffichees.length === 0
              ? <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}><div style={{ fontSize: "52px" }}>🛍️</div><div style={{ fontWeight: "700", marginTop: "12px" }}>Aucune vente</div></div>
              : ventesAffichees.map((v: any) => (
                <div key={v.id} style={{ ...S.card, opacity: v.validationStatut === "pending" ? 0.6 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1 }}>
                      <ArticlePhoto url={v.photoUrl} size={48} />
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e" }}>{v.article}</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                          {v.date} ·{" "}
                          {v.ventePerso
                            ? <span style={{ color: "#a29bfe", fontWeight: "700" }}>👤 Moi (perso)</span>
                            : `${v.vendeur} (${v.commission}%)`
                          }
                        </div>
                      </div>
                    </div>
                    <button onClick={() => deleteVente(v.id)} style={{ background: "none", border: "none", color: "#cbd5e1", fontSize: "18px", cursor: "pointer" }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: v.ventePerso ? "1fr 1fr" : "1fr 1fr 1fr", gap: "8px", marginTop: "12px" }}>
                    <MiniStat label="Vendu" value={fmt(v.prixVente)} color="#4ecdc4" />
                    {!v.ventePerso && <MiniStat label="Commission" value={fmt(v.commissionMontant)} color="#f7b731" />}
                    <MiniStat label="Entreprise" value={fmt(v.partEntreprise)} color="#e94560" />
                  </div>
                  {v.note && <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>📝 {v.note}</div>}
                  <BadgeValidation statut={v.validationStatut} />
                  {v.validationStatut !== "pending" && (
                    <button
                      onClick={() => handleValidation(v.id, "accepted")}
                      style={{ marginTop: "10px", width: "100%", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                      ✅ Valider la vente
                    </button>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* ── STOCK ── */}
        {tab === "stock" && (
          <div>
            {stockMigre.some((s: any) => getQuantiteAttente(s) > 0) && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
                  🚚 En attente de livraison
                </div>
                {stockMigre.filter((s: any) => getQuantiteAttente(s) > 0).map((s: any) => (
                  <div key={s.id} style={{ ...S.card, border: "2px solid #fed7aa", backgroundColor: "#fffbf5" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
                      <ArticlePhoto url={s.photoUrl} size={48} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e" }}>{s.nom}</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{s.categorie}</div>
                      </div>
                    </div>
                    {(s.lots || []).filter((l: Lot) => l.enAttente).map((l: Lot) => (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff7ed", borderRadius: "10px", padding: "10px 12px", marginBottom: "6px" }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a1a2e" }}>×{l.quantite} — {fmt(l.prixAchat)} / unité</div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Ajouté le {l.dateAjout}</div>
                        </div>
                        <button
                          onClick={() => livrerLot(s.id, l.id)}
                          style={{ backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>
                          ✓ Reçu
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "16px 0" }} />
              </div>
            )}

            {stockMigre.length === 0
              ? <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}><div style={{ fontSize: "52px" }}>📦</div><div style={{ fontWeight: "700", marginTop: "12px" }}>Stock vide</div></div>
              : stockMigre.map((s: any) => {
                  const dispo = getQuantiteDispo(s);
                  const attente = getQuantiteAttente(s);
                  const prixCourant = getPrixActuel(s);
                  return (
                    <div key={s.id} style={{ ...S.card, opacity: dispo === 0 && attente === 0 ? 0.5 : 1 }}>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <ArticlePhoto url={s.photoUrl} size={60} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "700", fontSize: "16px", color: "#1a1a2e" }}>{s.nom}</div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{s.categorie} · Achat {fmt(prixCourant)}</div>
                          {attente > 0 && <div style={{ marginTop: "4px" }}><BadgeAttente quantite={attente} /></div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ fontSize: "28px", fontWeight: "800", color: dispo === 0 ? "#ef4444" : "#22c55e" }}>×{dispo}</div>
                          <button onClick={() => setEditStock(migrateArticle(s))} style={{ backgroundColor: "#f1f5f9", border: "none", borderRadius: "10px", padding: "8px 12px", fontSize: "14px", cursor: "pointer", color: "#64748b" }}>✏️</button>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}

        {/* ── VENDEURS (avec sous-onglets période + classement) ── */}
        {tab === "vendeurs" && (
          <div>
            {/* Sous-onglets période */}
            <PeriodeTabs value={vendeurPeriode} onChange={setVendeurPeriode} />

            {/* Résumé global de la période */}
            <div style={{ ...S.card, background: "linear-gradient(135deg, #1a1a2e 0%, #2d2d5e 100%)", color: "#fff", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: "700", marginBottom: "8px" }}>
                {labelPeriodeVendeurs}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {[
                  ["CA", fmt(statsVendeursPeriode.reduce((s: number, v: any) => s + v.ca, 0)), "#4ecdc4"],
                  ["Commissions", fmt(statsVendeursPeriode.reduce((s: number, v: any) => s + v.commissionPeriode, 0)), "#f7b731"],
                  ["Ventes", statsVendeursPeriode.reduce((s: number, v: any) => s + v.nb, 0), "#a29bfe"],
                ].map(([l, v, c]: any) => (
                  <div key={l} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontWeight: "700" }}>{l}</div>
                    <div style={{ fontSize: "15px", fontWeight: "800", color: c, marginTop: "4px" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Classement de la période */}
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
              🏆 Classement
            </div>
            {classementPeriode.every((v: any) => v.nb === 0)
              ? <div style={{ textAlign: "center", color: "#94a3b8", padding: "16px 0 24px", fontSize: "13px" }}>Aucune vente sur cette période</div>
              : classementPeriode.map((v: any, i: number) => (
                <div key={v.nom} style={{ ...S.card, marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: i === 0 ? "#f7b731" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "14px", color: i < 3 ? "#fff" : "#64748b", flexShrink: 0 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "700", color: "#1a1a2e", fontSize: "14px" }}>{v.nom}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>{v.nb} vente(s)</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "800", color: "#4ecdc4", fontSize: "14px" }}>{fmt(v.ca)}</div>
                      <div style={{ fontSize: "10px", color: "#f7b731", fontWeight: "700" }}>comm. {fmt(v.commissionPeriode)}</div>
                    </div>
                  </div>
                </div>
              ))
            }

            {/* Séparateur */}
            <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "20px 0" }} />

            {/* Fiches individuelles vendeurs (solde & paiement — toujours en total) */}
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
              👥 Détail par vendeur
            </div>
            {statsVendeurs.map((v: any) => (
              <div key={v.nom} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ fontWeight: "800", fontSize: "18px", color: "#1a1a2e" }}>{v.nom}</div>
                  <div style={{ backgroundColor: "#e94560", color: "#fff", fontSize: "12px", fontWeight: "700", padding: "4px 14px", borderRadius: "100px" }}>{v.commission}%</div>
                </div>
                {/* Stats de la période sélectionnée pour ce vendeur */}
                {(() => {
                  const vp = statsVendeursPeriode.find((x: any) => x.nom === v.nom);
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                      <MiniStat label={`Ventes (${vendeurPeriode === "semaine" ? "sem." : vendeurPeriode === "mois" ? "mois" : "total"})`} value={vp?.nb ?? 0} />
                      <MiniStat label="CA période" value={fmt(vp?.ca ?? 0)} color="#4ecdc4" />
                      <MiniStat label="Comm. période" value={fmt(vp?.commissionPeriode ?? 0)} color="#f7b731" />
                    </div>
                  );
                })()}
                <div style={{ backgroundColor: v.solde > 0 ? "#fef2f2" : "#f0fdf4", borderRadius: "12px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: v.solde > 0 ? "#ef4444" : "#16a34a", textTransform: "uppercase" }}>Solde à payer</div>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: v.solde > 0 ? "#ef4444" : "#16a34a" }}>{fmt(v.solde)}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Déjà payé : {fmt(v.totalPaye)}</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {v.solde > 0 && <button onClick={() => { setShowPaiement(v.nom); setPaiementForm({ montant: v.solde.toFixed(2), note: "" }); }} style={{ backgroundColor: "#e94560", color: "#fff", border: "none", borderRadius: "12px", padding: "10px 16px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>💸 Payer</button>}
                    <button onClick={() => { setShowAjustement(v.nom); setAjustementForm({ montant: "", note: "", type: "prime" }); }} style={{ backgroundColor: "#a29bfe", color: "#fff", border: "none", borderRadius: "12px", padding: "10px 16px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>✏️</button>
                  </div>
                </div>
                {paiements.filter((p: any) => p.vendeur === v.nom).length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>Historique</div>
                    {paiements.filter((p: any) => p.vendeur === v.nom).slice(0, 3).map((p: any) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                        <span>{p.date} {p.note ? `· ${p.note}` : ""}</span>
                        <span style={{ fontWeight: "700", color: "#16a34a" }}>-{fmt(p.montant)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── TÂCHES ADMIN ── */}
        {tab === "taches" && (
          <div>
            {tachesPending.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
                  ⏳ Validations en attente ({tachesPending.length})
                </div>
                {tachesPending.map((t: any) => (
                  <div key={t.id} style={{ ...S.card, border: "2px solid #fed7aa", backgroundColor: "#fffbf5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e" }}>{t.titre}</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{t.assigneA} · {t.date}</div>
                        <div style={{ fontSize: "12px", color: "#ea580c", fontWeight: "700", marginTop: "2px" }}>Demande de validation</div>
                        {t.description && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{t.description}</div>}
                      </div>
                      <span style={{ backgroundColor: PRIORITE_COLOR[t.priorite] + "22", color: PRIORITE_COLOR[t.priorite], fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", whiteSpace: "nowrap", marginLeft: "10px" }}>{t.priorite}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
                      <button onClick={() => handleTacheValidation(t.id, "accepted")}
                        style={{ backgroundColor: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}>
                        ✅ Accepter
                      </button>
                      <button onClick={() => handleTacheValidation(t.id, "refused")}
                        style={{ backgroundColor: "#fef2f2", color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}>
                        ❌ Refuser
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "16px 0" }} />
              </div>
            )}

            {vendeurs.map((v: any) => {
              const vTaches = tachesAffichees.filter((t: any) => t.assigneA === v.nom);
              if (vTaches.length === 0) return null;
              return (
                <div key={v.nom} style={{ marginBottom: "24px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
                    👤 {v.nom} · {vTaches.filter((t: any) => t.statut !== "Fait").length} en cours
                  </div>
                  {vTaches.map((t: any) => (
                    <div key={t.id} style={{ ...S.card, opacity: t.statut === "Fait" ? 0.55 : 1, borderLeft: `4px solid ${PRIORITE_COLOR[t.priorite] || "#94a3b8"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e", textDecoration: t.statut === "Fait" ? "line-through" : "none" }}>{t.titre}</div>
                          {t.description && <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{t.description}</div>}
                          {t.echeance && <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>📅 {t.echeance}</div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", marginLeft: "10px" }}>
                          <span style={{ backgroundColor: PRIORITE_COLOR[t.priorite] + "22", color: PRIORITE_COLOR[t.priorite], fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", whiteSpace: "nowrap" }}>{t.priorite}</span>
                          <button onClick={() => cycleStatut(t.id)} style={{ backgroundColor: STATUT_COLOR[t.statut] + "22", color: STATUT_COLOR[t.statut], fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                            {t.statut} →
                          </button>
                          <button onClick={() => deleteTache(t.id)} style={{ background: "none", border: "none", color: "#cbd5e1", fontSize: "16px", cursor: "pointer", padding: 0 }}>✕</button>
                        </div>
                      </div>
                      <BadgeValidation statut={t.validationStatut} />
                      {t.validationStatut !== "pending" && (
                        <button
                          onClick={() => handleTacheValidation(t.id, "accepted")}
                          style={{ marginTop: "10px", width: "100%", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                          ✅ Valider la tâche
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {tachesAffichees.length === 0 && tachesPending.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: "52px" }}>🗒️</div>
                <div style={{ fontWeight: "700", marginTop: "12px" }}>Aucune tâche</div>
                <div style={{ fontSize: "13px", marginTop: "4px" }}>Appuie sur + pour en créer une</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FABs */}
      <div style={{ position: "fixed", bottom: "32px", right: "20px", zIndex: 40 }}>
        {tab === "stock" && <button onClick={() => setShowStock(true)} style={{ width: "58px", height: "58px", borderRadius: "50%", backgroundColor: "#4ecdc4", border: "none", fontSize: "30px", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(78,205,196,0.5)", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
        {tab === "ventes" && <button onClick={() => setShowVente(true)} style={{ width: "58px", height: "58px", borderRadius: "50%", backgroundColor: "#e94560", border: "none", fontSize: "30px", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(233,69,96,0.5)", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
        {tab === "taches" && <button onClick={() => setShowTache(true)} style={{ width: "58px", height: "58px", borderRadius: "50%", backgroundColor: "#a29bfe", border: "none", fontSize: "30px", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(162,155,254,0.5)", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
      </div>

      {/* ── MODAL NOUVELLE VENTE ── */}
      {showVente && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowVente(false)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>🛍️ Nouvelle vente</div>
              <button onClick={() => setShowVente(false)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Vendu par">
                <Select value={venteForm.vendeur} onChange={(v: string) => setVenteForm({ ...venteForm, vendeur: v })}
                  options={[{ value: VENTE_PERSO_KEY, label: "👤 Moi (vente perso — 0% commission)" }, ...vendeurs.map((v: any) => ({ value: v.nom, label: `${v.nom} (${v.commission}%)` }))]} />
              </Field>
              {venteForm.vendeur === VENTE_PERSO_KEY && (
                <div style={{ backgroundColor: "#f5f3ff", borderRadius: "12px", padding: "10px 14px", border: "2px solid #ddd6fe", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>👤</span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#7c3aed" }}>Vente perso · 100% bénéfice entreprise</span>
                </div>
              )}
              <Field label="Article vendu">
                {stockDispo.length === 0
                  ? <div style={{ backgroundColor: "#fef2f2", color: "#ef4444", padding: "14px", borderRadius: "12px", fontSize: "13px", fontWeight: "600", textAlign: "center" }}>⚠️ Stock vide</div>
                  : <Select value={venteForm.stockId} onChange={(v: string) => setVenteForm({ ...venteForm, stockId: v })} placeholder="Choisir un article..."
                      options={stockDispo.map((s: any) => ({ value: String(s.id), label: `${s.nom} — achat ${fmt(getPrixActuel(s))} (×${getQuantiteDispo(s)})` }))} />
                }
              </Field>
              {articleVenteSelectionne && articleVenteSelectionne.photoUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#f8fafc", borderRadius: "12px", padding: "10px" }}>
                  <ArticlePhoto url={articleVenteSelectionne.photoUrl} size={64} />
                  <div>
                    <div style={{ fontWeight: "700", color: "#1a1a2e" }}>{articleVenteSelectionne.nom}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{articleVenteSelectionne.categorie}</div>
                  </div>
                </div>
              )}
              <Field label="Prix de vente (€)"><TInput type="number" value={venteForm.prixVente} onChange={(v: string) => setVenteForm({ ...venteForm, prixVente: v })} placeholder="Ex: 50" /></Field>
              {venteForm.stockId && venteForm.prixVente && (() => {
                const article = stockMigre.find((s: any) => s.id === +venteForm.stockId);
                if (!article) return null;
                const prixAchat = getPrixActuel(article);
                const benef = +venteForm.prixVente - prixAchat;
                const isPerso = venteForm.vendeur === VENTE_PERSO_KEY;
                const vendeur = isPerso ? null : vendeurs.find((v: any) => v.nom === venteForm.vendeur);
                const comm = isPerso ? 0 : benef * (vendeur?.commission ?? 0) / 100;
                return (
                  <div style={{ backgroundColor: "#f0fdf4", borderRadius: "14px", padding: "14px", border: "2px solid #bbf7d0" }}>
                    <div style={{ fontSize: "10px", fontWeight: "800", color: "#16a34a", marginBottom: "10px", textTransform: "uppercase" }}>Aperçu</div>
                    <div style={{ display: "grid", gridTemplateColumns: isPerso ? "1fr 1fr" : "1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
                      <MiniStat label="Bénéfice brut" value={fmt(benef)} />
                      {!isPerso && <MiniStat label="Commission" value={fmt(comm)} color="#f7b731" />}
                      <MiniStat label="Entreprise" value={fmt(benef - comm)} color="#e94560" />
                    </div>
                  </div>
                );
              })()}
              <Field label="Note (optionnel)"><TInput value={venteForm.note} onChange={(v: string) => setVenteForm({ ...venteForm, note: v })} placeholder="Ex: payé par virement" /></Field>
              <button onClick={addVente} disabled={!venteForm.stockId || !venteForm.prixVente} style={S.btn("#e94560", !venteForm.stockId || !venteForm.prixVente)}>Enregistrer ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AJOUT STOCK ── */}
      {showStock && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowStock(false)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>📦 Nouvel article</div>
              <button onClick={() => setShowStock(false)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ backgroundColor: "#fff7ed", border: "2px solid #fed7aa", borderRadius: "12px", padding: "10px 14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>🚚</span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#ea580c" }}>Sera ajouté en attente de livraison</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Nom de l'article"><TInput value={stockForm.nom} onChange={(v: string) => setStockForm({ ...stockForm, nom: v })} placeholder="Ex: Sac Lacoste noir" /></Field>
              <Field label="Catégorie"><Select value={stockForm.categorie} onChange={(v: string) => setStockForm({ ...stockForm, categorie: v })} options={CATEGORIES} /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Prix d'achat (€)"><TInput type="number" value={stockForm.prixAchat} onChange={(v: string) => setStockForm({ ...stockForm, prixAchat: v })} placeholder="Ex: 12,56" /></Field>
                <Field label="Quantité"><TInput type="number" value={stockForm.quantite} onChange={(v: string) => setStockForm({ ...stockForm, quantite: v })} placeholder="Ex: 20" /></Field>
              </div>
              <Field label="🖼️ URL Photo (optionnel)">
                <TInput value={stockForm.photoUrl} onChange={(v: string) => setStockForm({ ...stockForm, photoUrl: v })} placeholder="https://..." />
              </Field>
              {stockForm.photoUrl && (
                <div style={{ borderRadius: "12px", overflow: "hidden", border: "2px solid #e2e8f0" }}>
                  <img src={stockForm.photoUrl} alt="preview" style={{ width: "100%", maxHeight: "180px", objectFit: "cover", display: "block" }}
                    onError={(e: any) => { e.target.style.display = "none"; }} />
                </div>
              )}
              <button onClick={addStock} disabled={!stockForm.nom || !stockForm.prixAchat} style={S.btn("#4ecdc4", !stockForm.nom || !stockForm.prixAchat)}>Ajouter en attente ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDIT STOCK ── */}
      {editStock && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setEditStock(null)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>✏️ Modifier l'article</div>
              <button onClick={() => setEditStock(null)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Nom"><TInput value={editStock.nom} onChange={(v: string) => setEditStock({ ...editStock, nom: v })} placeholder="Nom" /></Field>
              <Field label="Catégorie"><Select value={editStock.categorie} onChange={(v: string) => setEditStock({ ...editStock, categorie: v })} options={CATEGORIES} /></Field>
              <Field label="🖼️ URL Photo (optionnel)">
                <TInput value={editStock.photoUrl || ""} onChange={(v: string) => setEditStock({ ...editStock, photoUrl: v })} placeholder="https://..." />
              </Field>
              {editStock.photoUrl && (
                <div style={{ borderRadius: "12px", overflow: "hidden", border: "2px solid #e2e8f0" }}>
                  <img src={editStock.photoUrl} alt="preview" style={{ width: "100%", maxHeight: "180px", objectFit: "cover", display: "block" }}
                    onError={(e: any) => { e.target.style.display = "none"; }} />
                </div>
              )}
              <div style={{ backgroundColor: "#f0fdf4", border: "2px solid #bbf7d0", borderRadius: "14px", padding: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a", marginBottom: "10px", textTransform: "uppercase" }}>➕ Ajouter du stock</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <Field label="Quantité à ajouter">
                    <TInput type="number" value={lotForm.quantite} onChange={(v: string) => setLotForm({ ...lotForm, quantite: v })} placeholder="Ex: 10" />
                  </Field>
                  <Field label="Prix d'achat (€)">
                    <TInput type="number" value={lotForm.prixAchat} onChange={(v: string) => setLotForm({ ...lotForm, prixAchat: v })} placeholder={fmt(getPrixActuel(editStock))} />
                  </Field>
                </div>
                {lotForm.prixAchat && +lotForm.prixAchat !== getPrixActuel(editStock) && (
                  <div style={{ backgroundColor: "#fff7ed", borderRadius: "10px", padding: "8px 12px", fontSize: "12px", color: "#ea580c", fontWeight: "700", marginBottom: "10px" }}>
                    ⚠️ Prix différent du stock actuel ({fmt(getPrixActuel(editStock))})<br />
                    <span style={{ fontWeight: "400", color: "#9a3412" }}>Le nouveau prix s'appliquera quand l'ancien stock sera épuisé.</span>
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!lotForm.quantite || !lotForm.prixAchat) return;
                    const newLot: Lot = { id: Date.now(), quantite: +lotForm.quantite, prixAchat: +lotForm.prixAchat, enAttente: true, dateAjout: fmtDate() };
                    const articleMaj = { ...editStock, lots: [...(editStock.lots || []), newLot] };
                    const newStock = stockMigre.map((s: any) => s.id === editStock.id ? articleMaj : s);
                    setStock(newStock); await saveSync("stock", newStock);
                    setEditStock(articleMaj);
                    setLotForm({ quantite: "1", prixAchat: "" });
                    showToast("Lot ajouté en attente de livraison 🚚");
                  }}
                  disabled={!lotForm.quantite || !lotForm.prixAchat}
                  style={{ ...S.btn("#22c55e", !lotForm.quantite || !lotForm.prixAchat), padding: "12px" }}>
                  🚚 Ajouter en attente de livraison
                </button>
              </div>

              {editStock.lots && editStock.lots.length > 0 && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Lots</div>
                  {editStock.lots.map((l: Lot) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: l.enAttente ? "#fff7ed" : "#f0fdf4", borderRadius: "10px", padding: "10px 12px", marginBottom: "6px" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: "#1a1a2e" }}>×{l.quantite} — {fmt(l.prixAchat)}</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>{l.enAttente ? "🚚 En attente" : "✅ Disponible"} · {l.dateAjout}</div>
                      </div>
                      {l.enAttente && (
                        <button
                          onClick={async () => {
                            const newLots = editStock.lots.map((x: Lot) => x.id === l.id ? { ...x, enAttente: false } : x);
                            const articleMaj = { ...editStock, lots: newLots, quantite: getQuantiteDispo({ lots: newLots }) };
                            const newStock = stockMigre.map((s: any) => s.id === editStock.id ? articleMaj : s);
                            setStock(newStock); await saveSync("stock", newStock);
                            setEditStock(articleMaj);
                            showToast("Lot livré ✓");
                          }}
                          style={{ backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                          ✓ Reçu
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={saveEditStock} style={S.btn("#4ecdc4", false)}>Sauvegarder ✓</button>
              <button onClick={() => deleteStock(editStock.id)} style={S.btn("#ef4444", false)}>🗑️ Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PAIEMENT ── */}
      {showPaiement && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowPaiement(null)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>💸 Payer {showPaiement}</div>
              <button onClick={() => setShowPaiement(null)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {(() => { const v = statsVendeurs.find((x: any) => x.nom === showPaiement); return v && (<div style={{ backgroundColor: "#fef2f2", borderRadius: "14px", padding: "14px", textAlign: "center" }}><div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>Solde total dû</div><div style={{ fontSize: "28px", fontWeight: "800", color: "#ef4444", marginTop: "4px" }}>{fmt(v.solde)}</div></div>); })()}
              <Field label="Montant payé (€)"><TInput type="number" value={paiementForm.montant} onChange={(v: string) => setPaiementForm({ ...paiementForm, montant: v })} placeholder="Ex: 50" /></Field>
              <Field label="Note (optionnel)"><TInput value={paiementForm.note} onChange={(v: string) => setPaiementForm({ ...paiementForm, note: v })} placeholder="Ex: virement Lydia" /></Field>
              <button onClick={addPaiement} disabled={!paiementForm.montant} style={S.btn("#22c55e", !paiementForm.montant)}>Confirmer ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AJUSTEMENT ── */}
      {showAjustement && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowAjustement(null)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>✏️ Ajuster — {showAjustement}</div>
              <button onClick={() => setShowAjustement(null)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Type d'ajustement">
                <Select value={ajustementForm.type} onChange={(v: string) => setAjustementForm({ ...ajustementForm, type: v })}
                  options={[{ value: "prime", label: "➕ Prime (augmente ce qu'on lui doit)" }, { value: "dette", label: "📋 Dette initiale (il nous devait déjà)" }, { value: "deduction", label: "➖ Déduction (on lui enlève)" }]} />
              </Field>
              <Field label="Montant (€)"><TInput type="number" value={ajustementForm.montant} onChange={(v: string) => setAjustementForm({ ...ajustementForm, montant: v })} placeholder="Ex: 15" /></Field>
              <Field label="Note (optionnel)"><TInput value={ajustementForm.note} onChange={(v: string) => setAjustementForm({ ...ajustementForm, note: v })} placeholder="Ex: prime de bienvenue" /></Field>
              {ajustementForm.montant && (
                <div style={{ backgroundColor: "#f0f4ff", borderRadius: "14px", padding: "14px", textAlign: "center", border: "2px solid #c7d2fe" }}>
                  <div style={{ fontSize: "11px", color: "#6366f1", fontWeight: "700", textTransform: "uppercase", marginBottom: "6px" }}>Impact sur le solde</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: ajustementForm.type === "deduction" ? "#16a34a" : "#e94560" }}>
                    {ajustementForm.type === "deduction" ? "-" : "+"}{fmt(+ajustementForm.montant)}
                  </div>
                </div>
              )}
              <button onClick={addAjustement} disabled={!ajustementForm.montant} style={S.btn("#a29bfe", !ajustementForm.montant)}>Confirmer l'ajustement ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NOUVELLE TÂCHE ── */}
      {showTache && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowTache(false)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>🗒️ Nouvelle tâche</div>
              <button onClick={() => setShowTache(false)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            {/* Bandeau info notification */}
            <div style={{ backgroundColor: "#f5f3ff", border: "2px solid #ddd6fe", borderRadius: "12px", padding: "10px 14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🔔</span>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#7c3aed" }}>Une notification sera envoyée au vendeur</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Titre de la tâche">
                <TInput value={tacheForm.titre} onChange={(v: string) => setTacheForm({ ...tacheForm, titre: v })} placeholder="Ex: Mettre à jour le stock" />
              </Field>
              <Field label="Description (optionnel)">
                <TInput value={tacheForm.description} onChange={(v: string) => setTacheForm({ ...tacheForm, description: v })} placeholder="Ex: Vérifier les articles en rupture" />
              </Field>
              <Field label="Assigner à">
                <Select value={tacheForm.assigneA} onChange={(v: string) => setTacheForm({ ...tacheForm, assigneA: v })} placeholder="Choisir un vendeur..."
                  options={vendeurs.map((v: any) => ({ value: v.nom, label: v.nom }))} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Priorité">
                  <Select value={tacheForm.priorite} onChange={(v: string) => setTacheForm({ ...tacheForm, priorite: v })} options={PRIORITES} />
                </Field>
                <Field label="Échéance (optionnel)">
                  <TInput type="date" value={tacheForm.echeance} onChange={(v: string) => setTacheForm({ ...tacheForm, echeance: v })} placeholder="" />
                </Field>
              </div>
              <button onClick={addTache} disabled={!tacheForm.titre || !tacheForm.assigneA} style={S.btn("#a29bfe", !tacheForm.titre || !tacheForm.assigneA)}>Créer la tâche ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SETTINGS ── */}
      {showSettings && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowSettings(false)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>⚙️ Vendeurs & Commissions</div>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: "12px", backgroundColor: "#f0fdf4", borderRadius: "12px", padding: "12px", fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>🔄 Synchronisé en temps réel</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              {vendeurs.map((v: any, i: number) => (
                <div key={v.nom} style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#fff", borderRadius: "12px", padding: "12px 16px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "700", color: "#1a1a2e", flex: 1, fontSize: "15px" }}>{v.nom}</div>
                  <input type="number" min="0" max="100" value={v.commission}
                    onChange={(e: any) => setVendeurs((prev: any) => prev.map((x: any, j: number) => j === i ? { ...x, commission: +e.target.value } : x))}
                    style={{ width: "64px", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "8px 10px", fontSize: "16px", fontWeight: "700", color: "#1a1a2e", backgroundColor: "#fff", textAlign: "center", outline: "none" }} />
                  <span style={{ color: "#64748b", fontWeight: "700", fontSize: "15px" }}>%</span>
                  <button onClick={() => setVendeurs((prev: any) => prev.filter((_: any, j: number) => j !== i))}
                    style={{ background: "none", border: "none", color: "#cbd5e1", fontSize: "18px", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
            <NouveauVendeurForm vendeurs={vendeurs} setVendeurs={setVendeurs} showToast={showToast} />
            <button onClick={saveVendeurs} style={S.btn("#1a1a2e", false)}>Sauvegarder ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPALE ────────────────────────────────────────────────────────────
export default function App() {
  const [vendeurs, setVendeurs] = useState(VENDEURS_INIT);
  const [stock, setStock] = useState<any[]>([]);
  const [ventes, setVentes] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [taches, setTaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, "vinted", "ventes"), (snap) => { if (snap.exists()) setVentes(JSON.parse(snap.data().data)); setLoading(false); }),
      onSnapshot(doc(db, "vinted", "stock"), (snap) => { if (snap.exists()) setStock(JSON.parse(snap.data().data)); }),
      onSnapshot(doc(db, "vinted", "vendeurs"), (snap) => { if (snap.exists()) setVendeurs(JSON.parse(snap.data().data)); else setLoading(false); }),
      onSnapshot(doc(db, "vinted", "paiements"), (snap) => { if (snap.exists()) setPaiements(JSON.parse(snap.data().data)); }),
      onSnapshot(doc(db, "vinted", "taches"), (snap) => { if (snap.exists()) setTaches(JSON.parse(snap.data().data)); }),
    ];
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => { unsubs.forEach(u => u()); clearTimeout(timer); };
  }, []);

  const save = async (key: string, data: any) => { await fbSave(key, data); };

  const handleAddVente = async (vente: any, articleId: number) => {
    const newVentes = [vente, ...ventes];
    const newStock = stock.map(migrateArticle).map((s: any) => s.id === articleId ? decrementeStock(s) : s);
    setVentes(newVentes); setStock(newStock);
    await Promise.all([save("ventes", newVentes), save("stock", newStock)]);
  };

  const handleRequestValidation = async (venteId: number) => {
    const newVentes = ventes.map((v: any) => v.id === venteId ? { ...v, validationStatut: "pending" } : v);
    setVentes(newVentes);
    await save("ventes", newVentes);
  };

  const handleRequestTacheValidation = async (tacheId: number) => {
    const newTaches = taches.map((t: any) => t.id === tacheId ? { ...t, validationStatut: "pending" } : t);
    setTaches(newTaches);
    await save("taches", newTaches);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "48px" }}>👗</div>
      <div style={{ fontWeight: "700", color: "#1a1a2e", fontSize: "18px" }}>Chargement...</div>
    </div>
  );

  if (IS_ADMIN) return <AppAdmin vendeurs={vendeurs} setVendeurs={setVendeurs} stock={stock} setStock={setStock} ventes={ventes} setVentes={setVentes} paiements={paiements} setPaiements={setPaiements} taches={taches} setTaches={setTaches} save={save} />;
  if (VENDEUR_PARAM) {
    const vendeurTrouve = vendeurs.find((v: any) => v.nom.toLowerCase() === VENDEUR_PARAM);
    if (!vendeurTrouve) return <PageInconnue />;
    return <AppVendeur nomVendeur={vendeurTrouve.nom} vendeurs={vendeurs} stock={stock} ventes={ventes} paiements={paiements} taches={taches} onAddVente={handleAddVente} onRequestValidation={handleRequestValidation} onRequestTacheValidation={handleRequestTacheValidation} />;
  }
  return <PageInconnue />;
}
