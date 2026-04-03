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

const params = new URLSearchParams(window.location.search);
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

// --- TES COMPOSANTS UI D'ORIGINE ---
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

async function fbSave(key: string, data: any) {
  await setDoc(doc(db, "vinted", key), { data: JSON.stringify(data) });
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

// ─── APP PRINCIPALE ────────────────────────────────────────────────────────────
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

  if (IS_ADMIN) return <AppAdmin vendeurs={vendeurs} setVendeurs={setVendeurs} stock={stock} setStock={setStock} ventes={ventes} setVentes={setVentes} paiements={paiements} setPaiements={setPaiements} save={fbSave} />;
  
  const vExiste = vendeurs.find(v => v.nom.toLowerCase() === VENDEUR_PARAM);
  if (!vExiste) return <PageInconnue />;

  const onAddVente = async (v, sid) => {
    const nVt = [v, ...ventes];
    const nSt = stock.map(s => s.id === sid ? { ...s, quantite: s.quantite - 1 } : s);
    await Promise.all([fbSave("ventes", nVt), fbSave("stock", nSt)]);
  };

  return <AppVendeur nomVendeur={vExiste.nom} vendeurs={vendeurs} stock={stock} ventes={ventes} paiements={paiements} onAddVente={onAddVente} />;
}

// ─── APP VENDEUR (COPIE EXACTE) ────────────────────────────────────────────────
function AppVendeur({ nomVendeur, vendeurs, stock, ventes, paiements, onAddVente }: any) {
  const [tab, setTab] = useState("ventes");
  const [showVente, setShowVente] = useState(false);
  const [venteForm, setVenteForm] = useState({ stockId: "", prixVente: "", note: "" });
  const [toast, setToast] = useState<any>(null);

  const showToast = (msg: string, color = "#22c55e") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };
  const stockDispo = stock.filter((s: any) => s.quantite > 0);
  const mesVentes = ventes.filter((v: any) => v.vendeur.toLowerCase() === nomVendeur.toLowerCase());
  const monSolde = (() => {
    const v = vendeurs.find((x: any) => x.nom.toLowerCase() === nomVendeur.toLowerCase());
    if (!v) return 0;
    const du = mesVentes.reduce((s: number, x: any) => s + x.commissionMontant, 0);
    const paye = paiements.filter((p: any) => p.vendeur.toLowerCase() === nomVendeur.toLowerCase()).reduce((s: number, p: any) => s + p.montant, 0);
    return du - paye;
  })();

  const handleAdd = async () => {
    if (!venteForm.stockId || !venteForm.prixVente) return;
    const article = stock.find((s: any) => s.id === +venteForm.stockId);
    const vObj = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
    const prixV = +venteForm.prixVente;
    const benef = prixV - article.prixAchat;
    const comm = benef * (vObj.commission / 100);
    const vente = { id: Date.now(), date: fmtDate(), mois: moisActuel(), vendeur: vObj.nom, commission: vObj.commission, article: article.nom, prixAchat: article.prixAchat, prixVente: prixV, benefBrut: benef, commissionMontant: comm, partEntreprise: benef - comm, note: venteForm.note };
    await onAddVente(vente, article.id);
    setVenteForm({ stockId: "", prixVente: "", note: "" }); setShowVente(false);
    showToast("Vente enregistrée ✓");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", maxWidth: "480px", margin: "0 auto" }}>
      {toast && <div style={{ position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.color, color: "#fff", padding: "12px 24px", borderRadius: "100px", fontSize: "14px", fontWeight: "700", zIndex: 100 }}>{toast.msg}</div>}
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ marginBottom: "16px" }}><div style={{ color: "#e94560", fontSize: "10px", fontWeight: "800" }}>Vinted Business</div><div style={{ fontSize: "22px", fontWeight: "800" }}>Bonjour {nomVendeur} 👋</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}><div>SOLDE</div><div style={{color: "#e94560"}}>{fmt(monSolde)}</div></div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}><div>VENTES</div><div>{mesVentes.length}</div></div>
        </div>
        <div style={{ display: "flex", gap: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "4px" }}>
          {["ventes", "classement", "stock"].map(k => <button key={k} onClick={() => setTab(k)} style={{flex: 1, padding: "10px", border: "none", borderRadius: "10px", backgroundColor: tab === k ? "#e94560" : "transparent", color: "#fff"}}>{k}</button>)}
        </div>
      </div>
      <div style={{ padding: "16px" }}>
        {tab === "ventes" && mesVentes.map(v => <div key={v.id} style={S.card}><b>{v.article}</b><div>{fmt(v.prixVente)}</div></div>)}
      </div>
      {tab === "ventes" && <button onClick={() => setShowVente(true)} style={{ position: "fixed", bottom: "32px", right: "20px", width: "58px", height: "58px", borderRadius: "50%", backgroundColor: "#e94560", border: "none", color: "#fff", fontSize: "30px" }}>+</button>}
      {showVente && (
        <div style={S.overlay} onClick={() => setShowVente(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <Field label="Article"><Select value={venteForm.stockId} onChange={(v)=>setVenteForm({...venteForm, stockId: v})} options={stockDispo.map(s=>({value:s.id, label:s.nom}))}/></Field>
            <Field label="Prix"><TInput type="number" value={venteForm.prixVente} onChange={(v)=>setVenteForm({...venteForm, prixVente: v})}/></Field>
            <button onClick={handleAdd} style={{...S.btn("#e94560", false), marginTop: "20px"}}>Valider</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ADMIN (AVEC TON OPTION DEMANDÉE) ──────────────────────────────────────
function AppAdmin({ vendeurs, setVendeurs, stock, setStock, ventes, setVentes, paiements, setPaiements, save }: any) {
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState<any>(null);
  const [showVenteType, setShowVenteType] = useState<null | 'DIR' | 'EMP'>(null);
  const [syncing, setSyncing] = useState(false);
  const [venteForm, setVenteForm] = useState({ vendeur: vendeurs?.nom || "", stockId: "", prixVente: "", note: "" });

  const showToast = (msg: string, color = "#22c55e") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };
  const saveSync = async (key: string, data: any) => { setSyncing(true); await save(key, data); setSyncing(false); };

  const stats = useMemo(() => ({
    ca: ventes.reduce((s, v) => s + v.prixVente, 0),
    benef: ventes.reduce((s, v) => s + v.partEntreprise, 0),
    nb: ventes.length
  }), [ventes]);

  // LOGIQUE VENTE ASSOCIÉ OU EMPLOYÉ
  const handleAddVente = async (type: 'DIR' | 'EMP') => {
    if (!venteForm.stockId || !venteForm.prixVente) return;
    const article = stock.find((s: any) => s.id === +venteForm.stockId);
    
    let vendeurNom = "Direction";
    let commMontant = 0;
    let commPct = 0;

    if (type === 'EMP') {
      const vObj = vendeurs.find((v: any) => v.nom === venteForm.vendeur);
      vendeurNom = vObj.nom;
      commPct = vObj.commission;
      commMontant = (+venteForm.prixVente - article.prixAchat) * (commPct / 100);
    }

    const nouvelleVente = {
      id: Date.now(), date: fmtDate(), mois: moisActuel(), 
      vendeur: vendeurNom, commission: commPct, article: article.nom, 
      prixAchat: article.prixAchat, prixVente: +venteForm.prixVente,
      benefBrut: +venteForm.prixVente - article.prixAchat,
      commissionMontant: commMontant, partEntreprise: (+venteForm.prixVente - article.prixAchat) - commMontant,
      isDir: type === 'DIR'
    };

    const nVt = [nouvelleVente, ...ventes];
    const nSt = stock.map((s: any) => s.id === article.id ? { ...s, quantite: s.quantite - 1 } : s);
    
    setVentes(nVt); setStock(nSt);
    await Promise.all([saveSync("ventes", nVt), saveSync("stock", nSt)]);
    setShowVenteType(null);
    showToast("Vente enregistrée ✓");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", maxWidth: "480px", margin: "0 auto", paddingBottom: "120px" }}>
      {toast && <div style={{ position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.color, color: "#fff", padding: "12px 24px", borderRadius: "100px", fontSize: "14px", zIndex: 100 }}>{toast.msg}</div>}
      
      {/* HEADER D'ORIGINE */}
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
          <div><div style={{ color: "#e94560", fontSize: "10px", fontWeight: "800" }}>Admin 👑</div><div style={{ fontSize: "22px", fontWeight: "800" }}>Mes Comptes</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}><div>🏢 BÉNÉFICE</div><div style={{color: "#e94560"}}>{fmt(stats.benef)}</div></div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}><div>🏷️ CA TOTAL</div><div style={{color: "#4ecdc4"}}>{fmt(stats.ca)}</div></div>
        </div>
        <div style={{ display: "flex", gap: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "4px" }}>
          {["dashboard", "ventes", "stock"].map(k => <button key={k} onClick={() => setTab(k)} style={{flex: 1, padding: "10px", border: "none", borderRadius: "10px", backgroundColor: tab === k ? "#e94560" : "transparent", color: "#fff"}}>{k}</button>)}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {tab === "ventes" && ventes.map(v => (
          <div key={v.id} style={{ ...S.card, borderLeft: v.isDir ? "4px solid #1a1a2e" : "1px solid #f1f5f9" }}>
            <div style={{display: "flex", justifyContent: "space-between"}}>
              <b>{v.article}</b>
              <span style={{fontSize: "11px", fontWeight: "900", color: v.isDir ? "#1a1a2e" : "#e94560"}}>{v.isDir ? "👑 DIR" : v.vendeur}</span>
            </div>
            <div style={{fontSize: "13px", marginTop: "4px"}}>Prix: {fmt(v.prixVente)} | Gain: {fmt(v.partEntreprise)}</div>
          </div>
        ))}
      </div>

      {/* TON OPTION : LES DEUX BOUTONS FIXES EN BAS */}
      <div style={{ position: "fixed", bottom: "24px", left: "16px", right: "16px", display: "flex", gap: "10px", zIndex: 45 }}>
        <button onClick={() => setShowVenteType('DIR')} style={{ ...S.btn("#1a1a2e", false), flex: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>👑 Associé</button>
        <button onClick={() => setShowVenteType('EMP')} style={{ ...S.btn("#e94560", false), flex: 1, boxShadow: "0 4px 12px rgba(233,69,96,0.3)" }}>🛍️ Employé</button>
      </div>

      {/* MODAL VENTE */}
      {showVenteType && (
        <div style={S.overlay} onClick={() => setShowVenteType(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "900", marginBottom: "20px" }}>{showVenteType === 'DIR' ? "Vente Associé" : "Vente Employé"}</div>
            {showVenteType === 'EMP' && (
              <Field label="Vendeur">
                <Select value={venteForm.vendeur} onChange={(v)=>setVenteForm({...venteForm, vendeur: v})} options={vendeurs.map(v => v.nom)} />
              </Field>
            )}
            <Field label="Article">
              <Select value={venteForm.stockId} onChange={(v)=>setVenteForm({...venteForm, stockId: v})} options={stock.filter(s=>s.quantite>0).map(s=>({value:s.id, label:s.nom}))} />
            </Field>
            <Field label="Prix Final">
              <TInput type="number" value={venteForm.prixVente} onChange={(v)=>setVenteForm({...venteForm, prixVente: v})} />
            </Field>
            <button onClick={() => handleAddVente(showVenteType)} style={{...S.btn(showVenteType === 'DIR' ? "#1a1a2e" : "#e94560", false), marginTop: "20px"}}>Confirmer</button>
          </div>
        </div>
      )}
    </div>
  );
}
