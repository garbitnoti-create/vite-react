// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

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
];

const CATEGORIES = ["Vêtements", "Chaussures", "Sacs", "Accessoires", "Sport", "Autre"];
const fmt = (n: number) => Number(n || 0).toFixed(2).replace(".", ",") + " €";
const fmtDate = () => new Date().toLocaleDateString("fr-FR");
const moisActuel = () => { const d = new Date(); return `${d.getMonth()}-${d.getFullYear()}`; };
const moisLabel = () => new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const IS_ADMIN = params.get("admin") === "true";
const VENDEUR_PARAM = params.get("v")?.toLowerCase() || null;

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
        style={{ ...S.input, padding: "14px 40px 14px 16px", appearance: "none", cursor: "pointer" }}>
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

async function fbSave(key: string, data: any) {
  await setDoc(doc(db, "vinted", key), { data: JSON.stringify(data) });
}

export default function VinterApp() {
  const [vendeurs, setVendeurs] = useState(VENDEURS_INIT);
  const [stock, setStock] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubV = onSnapshot(doc(db, "vinted", "vendeurs"), (d) => d.exists() && setVendeurs(JSON.parse(d.data().data)));
    const unsubS = onSnapshot(doc(db, "vinted", "stock"), (d) => d.exists() && setStock(JSON.parse(d.data().data)));
    const unsubVt = onSnapshot(doc(db, "vinted", "ventes"), (d) => d.exists() && setVentes(JSON.parse(d.data().data)));
    const unsubP = onSnapshot(doc(db, "vinted", "paiements"), (d) => d.exists() && setPaiements(JSON.parse(d.data().data)));
    setLoading(false);
    return () => { unsubV(); unsubS(); unsubVt(); unsubP(); };
  }, []);

  if (loading) return null;

  if (IS_ADMIN) {
    return <AppAdmin vendeurs={vendeurs} setVendeurs={setVendeurs} stock={stock} setStock={setStock} ventes={ventes} setVentes={setVentes} paiements={paiements} setPaiements={setPaiements} save={fbSave} />;
  }

  const vExiste = vendeurs.find(v => v.nom.toLowerCase() === VENDEUR_PARAM);
  if (!vExiste) return <PageInconnue />;

  const onAddVenteVendeur = async (vente, articleId) => {
    const newVentes = [vente, ...ventes];
    const newStock = stock.map((s: any) => s.id === articleId ? { ...s, quantite: s.quantite - 1 } : s);
    await Promise.all([fbSave("ventes", newVentes), fbSave("stock", newStock)]);
  };

  return <AppVendeur nomVendeur={vExiste.nom} vendeurs={vendeurs} stock={stock} ventes={ventes} paiements={paiements} onAddVente={onAddVenteVendeur} />;
}

// ─── PAGE NON RECONNUE ─────────────────────────────────────────────────────────
function PageInconnue() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", padding: "24px" }}>
      <div style={{ fontSize: "52px" }}>🔒</div>
      <div style={{ fontWeight: "800", color: "#1a1a2e", fontSize: "20px", textAlign: "center" }}>Accès non autorisé</div>
      <div style={{ fontSize: "14px", color: "#94a3b8", textAlign: "center" }}>Demande ton lien personnel à l'administrateur.</div>
    </div>
  );
}

// ─── APP VENDEUR ───────────────────────────────────────────────────────────────
function AppVendeur({ nomVendeur, vendeurs, stock, ventes, paiements, onAddVente }: any) {
  const [tab, setTab] = useState("ventes");
  const [showVente, setShowVente] = useState(false);
  const [venteForm, setVenteForm] = useState({ stockId: "", prixVente: "", note: "" });
  const [toast, setToast] = useState<any>(null);

  const showToast = (msg: string, color = "#22c55e") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  const stockDispo = stock.filter((s: any) => s.quantite > 0);
  const mesVentes = ventes.filter((v: any) => v.vendeur.toLowerCase() === nomVendeur.toLowerCase());
  
  const monSolde = (() => {
    const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
    if (!vendeur) return 0;
    const totalDu = mesVentes.reduce((s: number, v: any) => s + v.commissionMontant, 0);
    const totalPaye = paiements.filter((p: any) => p.vendeur.toLowerCase() === nomVendeur.toLowerCase()).reduce((s: number, p: any) => s + p.montant, 0);
    return totalDu - totalPaye;
  })();

  const addVente = async () => {
    if (!venteForm.stockId || !venteForm.prixVente) return;
    const article = stock.find((s: any) => s.id === +venteForm.stockId);
    const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
    if (!article || !vendeur) return;
    const prixVente = +venteForm.prixVente;
    const benefBrut = prixVente - article.prixAchat;
    const commissionMontant = benefBrut * (vendeur.commission / 100);
    const partEntreprise = benefBrut - commissionMontant;
    const vente = { id: Date.now(), date: fmtDate(), mois: moisActuel(), vendeur: vendeur.nom, commission: vendeur.commission, article: article.nom, prixAchat: article.prixAchat, prixVente, benefBrut, commissionMontant, partEntreprise, note: venteForm.note, isDir: false };
    await onAddVente(vente, article.id);
    setVenteForm({ stockId: "", prixVente: "", note: "" });
    setShowVente(false);
    showToast(`Vente enregistrée ! Ta part : ${fmt(commissionMontant)} ✓`);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "480px", margin: "0 auto" }}>
      {toast && <div style={{ position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.color, color: "#fff", padding: "12px 24px", borderRadius: "100px", fontSize: "14px", fontWeight: "700", zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{toast.msg}</div>}
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: "#e94560", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.12em" }}>Vinted Business</div>
          <div style={{ fontSize: "22px", fontWeight: "800", marginTop: "2px" }}>Bonjour {nomVendeur} 👋</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700" }}>💰 Mon solde</div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: monSolde > 0 ? "#e94560" : "#4ecdc4", marginTop: "4px" }}>{fmt(monSolde)}</div>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700" }}>📦 Mes ventes</div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#f7b731", marginTop: "4px" }}>{mesVentes.length}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "4px" }}>
          {[["ventes", "🛍️ Mes ventes"], ["classement", "🏆 Classement"], ["stock", "📦 Stock"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "10px 4px", borderRadius: "10px", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer", backgroundColor: tab === key ? "#e94560" : "transparent", color: tab === key ? "#fff" : "rgba(255,255,255,0.45)" }}>{label}</button>
          ))}
        </div>
        <div style={{ height: "16px" }} />
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        {tab === "ventes" && mesVentes.map((v: any) => (
          <div key={v.id} style={S.card}>
            <div style={{ fontWeight: "700", fontSize: "16px", color: "#1a1a2e" }}>{v.article}</div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{v.date}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
              <MiniStat label="Vendu" value={fmt(v.prixVente)} color="#4ecdc4" />
              <MiniStat label="Ma commission" value={fmt(v.commissionMontant)} color="#e94560" />
            </div>
          </div>
        ))}
      </div>

      {tab === "ventes" && (
        <button onClick={() => setShowVente(true)} style={{ position: "fixed", bottom: "32px", right: "20px", width: "58px", height: "58px", borderRadius: "50%", backgroundColor: "#e94560", border: "none", fontSize: "30px", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(233,69,96,0.5)", fontWeight: "700", zIndex: 40 }}>+</button>
      )}

      {showVente && (
        <div style={S.overlay} onClick={() => setShowVente(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "18px", fontWeight: "800", marginBottom: "20px" }}>🛍️ Nouvelle vente</div>
            <Field label="Article vendu">
              <Select value={venteForm.stockId} onChange={(v: string) => setVenteForm({ ...venteForm, stockId: v })} placeholder="Choisir un article..." options={stockDispo.map((s: any) => ({ value: String(s.id), label: `${s.nom} (×${s.quantite})` }))} />
            </Field>
            <Field label="Prix de vente (€)"><TInput type="number" value={venteForm.prixVente} onChange={(v: string) => setVenteForm({ ...venteForm, prixVente: v })} /></Field>
            <button onClick={addVente} style={{...S.btn("#e94560", false), marginTop: "20px"}}>Enregistrer ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ADMIN ─────────────────────────────────────────────────────────────────
function AppAdmin({ vendeurs, setVendeurs, stock, setStock, ventes, setVentes, paiements, setPaiements, save }: any) {
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState<any>(null);
  const [showVente, setShowVente] = useState<any>(null); // null | 'DIR' | 'EMP'
  const [showStock, setShowStock] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editStock, setEditStock] = useState<any>(null);
  const [showPaiement, setShowPaiement] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [venteForm, setVenteForm] = useState({ vendeur: vendeurs?.nom || "", stockId: "", prixVente: "", note: "" });
  const [stockForm, setStockForm] = useState({ nom: "", categorie: "Vêtements", prixAchat: "", quantite: "1" });
  const [paiementForm, setPaiementForm] = useState({ montant: "", note: "" });

  const showToast = (msg: string, color = "#22c55e") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };
  const saveSync = async (key: string, data: any) => { setSyncing(true); await save(key, data); setTimeout(() => setSyncing(false), 800); };

  const stats = useMemo(() => ({
    ca: ventes.reduce((s: number, v: any) => s + v.prixVente, 0),
    benef: ventes.reduce((s: number, v: any) => s + v.partEntreprise, 0),
    nbVentes: ventes.length,
  }), [ventes]);

  const addVente = async (type: 'DIR' | 'EMP') => {
    if (!venteForm.stockId || !venteForm.prixVente) return;
    const article = stock.find((s: any) => s.id === +venteForm.stockId);
    if (!article) return;

    let vNom = "Direction";
    let comm = 0;
    let commPct = 0;

    if (type === 'EMP') {
      const vObj = vendeurs.find((v: any) => v.nom === venteForm.vendeur);
      vNom = vObj.nom;
      commPct = vObj.commission;
      comm = ( +venteForm.prixVente - article.prixAchat ) * (commPct / 100);
    }

    const vente = { 
      id: Date.now(), date: fmtDate(), mois: moisActuel(), 
      vendeur: vNom, commission: commPct, article: article.nom, 
      prixAchat: article.prixAchat, prixVente: +venteForm.prixVente, 
      benefBrut: +venteForm.prixVente - article.prixAchat, 
      commissionMontant: comm, partEntreprise: (+venteForm.prixVente - article.prixAchat) - comm, 
      note: venteForm.note, isDir: type === 'DIR' 
    };

    const newVentes = [vente, ...ventes];
    const newStock = stock.map((s: any) => s.id === article.id ? { ...s, quantite: s.quantite - 1 } : s);
    setVentes(newVentes); setStock(newStock);
    await Promise.all([saveSync("ventes", newVentes), saveSync("stock", newStock)]);
    setShowVente(null);
    showToast("Vente enregistrée ✓");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "480px", margin: "0 auto" }}>
      {toast && <div style={{ position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.color, color: "#fff", padding: "12px 24px", borderRadius: "100px", fontSize: "14px", fontWeight: "700", zIndex: 100, whiteSpace: "nowrap" }}>{toast.msg}</div>}
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
          <div><div style={{ color: "#e94560", fontSize: "10px", fontWeight: "800" }}>Vinted Admin 👑</div><div style={{ fontSize: "22px", fontWeight: "800" }}>Mes Comptes</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
           <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", fontWeight: "700" }}>🏢 BÉNÉFICE</div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#e94560" }}>{fmt(stats.benef)}</div>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", fontWeight: "700" }}>🏷️ CA TOTAL</div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#4ecdc4" }}>{fmt(stats.ca)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "4px" }}>
          {[["dashboard", "📊"], ["ventes", "🛍️"], ["stock", "📦"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "10px 4px", borderRadius: "10px", border: "none", fontSize: "16px", backgroundColor: tab === key ? "#e94560" : "transparent", color: tab === key ? "#fff" : "#fff" }}>{label}</button>
          ))}
        </div>
        <div style={{ height: "16px" }} />
      </div>

      <div style={{ padding: "16px 16px 120px" }}>
        {tab === "ventes" && ventes.map((v: any) => (
          <div key={v.id} style={{ ...S.card, borderLeft: v.isDir ? "4px solid #1a1a2e" : "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: "700" }}>{v.article}</div>
              <div style={{ fontSize: "11px", fontWeight: "800", color: v.isDir ? "#1a1a2e" : "#e94560" }}>{v.isDir ? "👑 DIR" : v.vendeur}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
              <MiniStat label="Vendu" value={fmt(v.prixVente)} color="#4ecdc4" />
              <MiniStat label="Gain" value={fmt(v.partEntreprise)} color="#e94560" />
            </div>
          </div>
        ))}
      </div>

      {/* DOUBLE BOUTON FIXE EN BAS */}
      <div style={{ position: "fixed", bottom: "24px", left: "16px", right: "16px", display: "flex", gap: "10px", zIndex: 45 }}>
        <button onClick={() => setShowVente('DIR')} style={{ ...S.btn("#1a1a2e", false), flex: 1, boxShadow: "0 6px 20px rgba(0,0,0,0.2)" }}>👑 Associé</button>
        <button onClick={() => setShowVente('EMP')} style={{ ...S.btn("#e94560", false), flex: 1, boxShadow: "0 6px 20px rgba(233,69,96,0.3)" }}>🛍️ Employé</button>
      </div>

      {showVente && (
        <div style={S.overlay} onClick={() => setShowVente(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "800", fontSize: "18px", marginBottom: "20px" }}>{showVente === 'DIR' ? "Vente Associé (Com 0%)" : "Vente Employé"}</div>
            {showVente === 'EMP' && (
              <Field label="Vendeur">
                <Select value={venteForm.vendeur} onChange={(v: string) => setVenteForm({ ...venteForm, vendeur: v })} options={vendeurs.map(v => v.nom)} />
              </Field>
            )}
            <div style={{marginTop: "12px"}}>
              <Field label="Article">
                <Select value={venteForm.stockId} onChange={(v: string) => setVenteForm({ ...venteForm, stockId: v })} options={stock.filter(s=>s.quantite>0).map(s=>({value:s.id, label:s.nom}))} />
              </Field>
            </div>
            <div style={{marginTop: "12px"}}>
              <Field label="Prix final"><TInput type="number" value={venteForm.prixVente} onChange={(v: string) => setVenteForm({ ...venteForm, prixVente: v })} /></Field>
            </div>
            <button onClick={() => addVente(showVente)} style={{...S.btn(showVente === 'DIR' ? "#1a1a2e" : "#e94560", false), marginTop: "20px"}}>Confirmer</button>
          </div>
        </div>
      )}
    </div>
  );
}
