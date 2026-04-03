// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// --- CONFIGURATION FIREBASE ---
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

const fmt = (n: number) => Number(n || 0).toFixed(2).replace(".", ",") + " €";
const fmtDate = () => new Date().toLocaleDateString("fr-FR");
const moisActuel = () => { const d = new Date(); return `${d.getMonth()}-${d.getFullYear()}`; };

const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const IS_ADMIN = params.get("admin") === "true";
const VENDEUR_PARAM = params.get("v")?.toLowerCase() || null;

const S: any = {
  card: { backgroundColor: "#fff", borderRadius: "16px", padding: "16px", marginBottom: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #f1f5f9" },
  overlay: { position: "fixed" as const, inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end" },
  modal: { backgroundColor: "#f8fafc", width: "100%", borderTopLeftRadius: "24px", borderTopRightRadius: "24px", padding: "24px", maxHeight: "92vh", overflowY: "auto" as const },
  input: { width: "100%", backgroundColor: "#fff", color: "#1a1a2e", border: "2px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", fontSize: "15px", fontWeight: "500", outline: "none", boxSizing: "border-box" as const },
  btn: (bg: string, disabled: boolean) => ({ width: "100%", backgroundColor: disabled ? "#cbd5e1" : bg, color: "#fff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "16px", fontWeight: "800", cursor: disabled ? "not-allowed" : "pointer" }),
  label: { fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "6px" },
};

// --- COMPOSANTS UTILES ---
function Select({ value, onChange, options, placeholder }: any) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e: any) => onChange(e.target.value)}
        style={{ ...S.input, padding: "14px 40px 14px 16px", appearance: "none", cursor: "pointer" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o: any) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748b" }}>▼</div>
    </div>
  );
}

function TInput({ value, onChange, placeholder, type = "text" }: any) {
  return <input type={type} step="0.01" value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} style={S.input} />;
}

async function fbSave(key: string, data: any) {
  await setDoc(doc(db, "vinted", key), { data: JSON.stringify(data) });
}

// --- COMPOSANT PRINCIPAL ---
export default function VinterApp() {
  const [vendeurs, setVendeurs] = useState(VENDEURS_INIT);
  const [stock, setStock] = useState<any[]>([]);
  const [ventes, setVentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubV = onSnapshot(doc(db, "vinted", "vendeurs"), (d) => d.exists() && setVendeurs(JSON.parse(d.data().data)));
    const unsubS = onSnapshot(doc(db, "vinted", "stock"), (d) => d.exists() && setStock(JSON.parse(d.data().data)));
    const unsubVt = onSnapshot(doc(db, "vinted", "ventes"), (d) => d.exists() && setVentes(JSON.parse(d.data().data)));
    setLoading(false);
    return () => { unsubV(); unsubS(); unsubVt(); };
  }, []);

  if (loading) return <div style={{padding: 20, textAlign: 'center'}}>Chargement...</div>;

  if (IS_ADMIN) {
    return <AppAdmin vendeurs={vendeurs} stock={stock} ventes={ventes} save={fbSave} />;
  }

  const vExiste = vendeurs.find(v => v.nom.toLowerCase() === VENDEUR_PARAM);
  if (!vExiste) return <div style={{padding: 50, textAlign: 'center'}}>Accès Refusé 🔒</div>;

  return <AppVendeur nomVendeur={vExiste.nom} vendeurs={vendeurs} stock={stock} ventes={ventes} />;
}

// --- VUE VENDEUR (EMPLOYÉ) ---
function AppVendeur({ nomVendeur, vendeurs, stock, ventes }: any) {
  const [showVente, setShowVente] = useState(false);
  const [form, setForm] = useState({ stockId: "", prix: "" });

  const mesVentes = ventes.filter((v: any) => v.vendeur.toLowerCase() === nomVendeur.toLowerCase() && !v.isDir);

  const addVente = async () => {
    const article = stock.find((s: any) => s.id === +form.stockId);
    const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
    if (!article || !form.prix) return;

    const vnt = {
      id: Date.now(), date: fmtDate(), mois: moisActuel(), vendeur: vendeur.nom,
      article: article.nom, prixAchat: article.prixAchat, prixVente: +form.prix,
      benefBrut: +form.prix - article.prixAchat,
      commissionMontant: (+form.prix - article.prixAchat) * (vendeur.commission / 100),
      partEntreprise: (+form.prix - article.prixAchat) * (1 - vendeur.commission / 100),
      isDir: false
    };

    const newStock = stock.map((s: any) => s.id === article.id ? { ...s, quantite: s.quantite - 1 } : s);
    await Promise.all([fbSave("ventes", [vnt, ...ventes]), fbSave("stock", newStock)]);
    setShowVente(false);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px" }}>
        <div style={{ fontSize: "20px", fontWeight: "800" }}>Bonjour {nomVendeur} 👋</div>
      </div>
      <div style={{ padding: "16px" }}>
        {mesVentes.map((v: any) => (
          <div key={v.id} style={S.card}>
            <b>{v.article}</b> - {fmt(v.prixVente)}
          </div>
        ))}
      </div>
      <button onClick={() => setShowVente(true)} style={{ position: "fixed", bottom: 20, right: 20, width: 60, height: 60, borderRadius: "50%", backgroundColor: "#e94560", color: "#fff", border: "none", fontSize: 30 }}>+</button>
      
      {showVente && (
        <div style={S.overlay} onClick={() => setShowVente(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.label}>Article</div>
            <Select value={form.stockId} onChange={(v:any)=>setForm({...form, stockId:v})} options={stock.filter(s=>s.quantite>0).map(s=>({value:s.id, label:s.nom}))} />
            <div style={{marginTop: 15}}><div style={S.label}>Prix de vente</div>
            <TInput type="number" value={form.prix} onChange={(v:any)=>setForm({...form, prix:v})} /></div>
            <button onClick={addVente} style={{...S.btn("#e94560", false), marginTop: 20}}>Valider</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- VUE ADMIN ---
function AppAdmin({ vendeurs, stock, ventes, save }: any) {
  const [tab, setTab] = useState("dashboard");
  const [showVenteDir, setShowVenteDir] = useState(false);
  const [showVenteEmp, setShowVenteEmp] = useState(false);
  const [form, setForm] = useState({ stockId: "", prix: "", vendeur: vendeurs?.nom });

  const stats = useMemo(() => ({
    ca: ventes.reduce((s, v) => s + v.prixVente, 0),
    benef: ventes.reduce((s, v) => s + v.partEntreprise, 0),
  }), [ventes]);

  const addVenteAction = async (isDir: boolean) => {
    const article = stock.find((s: any) => s.id === +form.stockId);
    if (!article || !form.prix) return;

    let comm = 0;
    let vNom = isDir ? "Direction" : form.vendeur;

    if (!isDir) {
      const vObj = vendeurs.find((v: any) => v.nom === form.vendeur);
      comm = (+form.prix - article.prixAchat) * (vObj.commission / 100);
    }

    const vnt = {
      id: Date.now(), date: fmtDate(), mois: moisActuel(), vendeur: vNom,
      article: article.nom, prixAchat: article.prixAchat, prixVente: +form.prix,
      benefBrut: +form.prix - article.prixAchat,
      commissionMontant: comm,
      partEntreprise: (+form.prix - article.prixAchat) - comm,
      isDir: isDir
    };

    const newStock = stock.map((s: any) => s.id === article.id ? { ...s, quantite: s.quantite - 1 } : s);
    await Promise.all([save("ventes", [vnt, ...ventes]), save("stock", newStock)]);
    setShowVenteDir(false); setShowVenteEmp(false);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px" }}>
        <div style={{ fontSize: "10px", color: "#e94560", fontWeight: "900" }}>ESPACE MODÉRATEUR 👑</div>
        <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize: 10, opacity: 0.5 }}>BÉNÉFICE TOTAL</div>
             <div style={{ fontSize: 18, fontWeight: "800", color: "#e94560" }}>{fmt(stats.benef)}</div>
          </div>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize: 10, opacity: 0.5 }}>CA GLOBAL</div>
             <div style={{ fontSize: 18, fontWeight: "800", color: "#4ecdc4" }}>{fmt(stats.ca)}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setTab("dashboard")} style={{flex: 1, padding: 10, border: 'none', borderRadius: 8, backgroundColor: tab === 'dashboard' ? '#1a1a2e' : '#fff', color: tab === 'dashboard' ? '#fff' : '#000'}}>Stats</button>
          <button onClick={() => setTab("ventes")} style={{flex: 1, padding: 10, border: 'none', borderRadius: 8, backgroundColor: tab === 'ventes' ? '#1a1a2e' : '#fff', color: tab === 'ventes' ? '#fff' : '#000'}}>Ventes</button>
        </div>

        {tab === "ventes" && ventes.map((v: any) => (
          <div key={v.id} style={{ ...S.card, borderLeft: v.isDir ? "4px solid #1a1a2e" : "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{v.article}</b>
              <span style={{ fontSize: 10, color: v.isDir ? '#1a1a2e' : '#999' }}>{v.isDir ? "👑 DIR" : v.vendeur}</span>
            </div>
          </div>
        ))}
      </div>

      {/* BOUTONS FLOTTANTS */}
      <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => setShowVenteDir(true)} style={{ padding: "12px 20px", borderRadius: "25px", backgroundColor: "#1a1a2e", color: "#fff", border: "none", fontWeight: "800" }}>👑 Vente Associé</button>
        <button onClick={() => setShowVenteEmp(true)} style={{ padding: "12px 20px", borderRadius: "25px", backgroundColor: "#e94560", color: "#fff", border: "none", fontWeight: "800" }}>🛍️ Vente Employé</button>
      </div>

      {/* MODAL VENTE ASSOCIÉ */}
      {showVenteDir && (
        <div style={S.overlay} onClick={() => setShowVenteDir(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "800", marginBottom: 20 }}>Vente Direction (Compta Directe)</div>
            <div style={S.label}>Article</div>
            <Select value={form.stockId} onChange={(v:any)=>setForm({...form, stockId:v})} options={stock.filter(s=>s.quantite>0).map(s=>({value:s.id, label:s.nom}))} />
            <div style={{marginTop: 15}}><div style={S.label}>Prix</div>
            <TInput type="number" value={form.prix} onChange={(v:any)=>setForm({...form, prix:v})} /></div>
            <button onClick={() => addVenteAction(true)} style={{...S.btn("#1a1a2e", false), marginTop: 20}}>Valider la vente</button>
          </div>
        </div>
      )}

      {/* MODAL VENTE EMPLOYÉ */}
      {showVenteEmp && (
        <div style={S.overlay} onClick={() => setShowVenteEmp(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "800", marginBottom: 20 }}>Vente Employé</div>
            <div style={S.label}>Vendeur</div>
            <Select value={form.vendeur} onChange={(v:any)=>setForm({...form, vendeur:v})} options={vendeurs.map(v=>v.nom)} />
            <div style={{marginTop: 15}}><div style={S.label}>Article</div>
            <Select value={form.stockId} onChange={(v:any)=>setForm({...form, stockId:v})} options={stock.filter(s=>s.quantite>0).map(s=>({value:s.id, label:s.nom}))} /></div>
            <div style={{marginTop: 15}}><div style={S.label}>Prix</div>
            <TInput type="number" value={form.prix} onChange={(v:any)=>setForm({...form, prix:v})} /></div>
            <button onClick={() => addVenteAction(false)} style={{...S.btn("#e94560", false), marginTop: 20}}>Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}
