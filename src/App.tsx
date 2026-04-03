import { useState, useEffect, useMemo } from "react";
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
  overlay: { position: "fixed" as const, inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end" },
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

async function fbSave(key: string, data: any) {
  await setDoc(doc(db, "vinted", key), { data: JSON.stringify(data) });
}

// ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────
export default function VinterApp() {
  const [vendeurs, setVendeurs] = useState(VENDEURS_INIT);
  const [stock, setStock] = useState<any[]>([]);
  const [ventes, setVentes] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
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
  
  const vNom = VENDEUR_PARAM;
  const vExiste = vendeurs.find(v => v.nom.toLowerCase() === vNom);
  if (!vNom || !vExiste) return <PageInconnue />;
  
  return <AppVendeur nomVendeur={vExiste.nom} vendeurs={vendeurs} stock={stock} ventes={ventes} paiements={paiements} />;
}

function PageInconnue() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", padding: "24px" }}>
      <div style={{ fontSize: "52px" }}>🔒</div>
      <div style={{ fontWeight: "800", color: "#1a1a2e", fontSize: "20px" }}>Accès non autorisé</div>
    </div>
  );
}

// ─── APP VENDEUR ───────────────────────────────────────────────────────────────
function AppVendeur({ nomVendeur, vendeurs, stock, ventes, paiements }: any) {
  const [tab, setTab] = useState("ventes");
  const [showVente, setShowVente] = useState(false);
  const [venteForm, setVenteForm] = useState({ stockId: "", prixVente: "", note: "" });

  const stockDispo = stock.filter((s: any) => s.quantite > 0);
  const mesVentes = ventes.filter((v: any) => v.vendeur.toLowerCase() === nomVendeur.toLowerCase() && !v.isDir);

  const addVente = async () => {
    if (!venteForm.stockId || !venteForm.prixVente) return;
    const article = stock.find((s: any) => s.id === +venteForm.stockId);
    const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
    if (!article || !vendeur) return;
    const prixVente = +venteForm.prixVente;
    const benefBrut = prixVente - article.prixAchat;
    const commissionMontant = benefBrut * (vendeur.commission / 100);
    const vente = { id: Date.now(), date: fmtDate(), mois: moisActuel(), vendeur: vendeur.nom, commission: vendeur.commission, article: article.nom, prixAchat: article.prixAchat, prixVente, benefBrut, commissionMontant, partEntreprise: benefBrut - commissionMontant, note: venteForm.note, isDir: false };
    const newVentes = [vente, ...ventes];
    const newStock = stock.map((s: any) => s.id === article.id ? { ...s, quantite: s.quantite - 1 } : s);
    await Promise.all([fbSave("ventes", newVentes), fbSave("stock", newStock)]);
    setVenteForm({ stockId: "", prixVente: "", note: "" }); setShowVente(false);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px" }}>
        <div style={{ fontSize: "22px", fontWeight: "800" }}>Bonjour {nomVendeur} 👋</div>
        <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
           <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", padding: "10px", borderRadius: "12px" }}>
              <div style={{ fontSize: "10px", opacity: 0.6 }}>MON CA</div>
              <div style={{ fontWeight: "800" }}>{fmt(mesVentes.reduce((s, v) => s + v.prixVente, 0))}</div>
           </div>
           <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", padding: "10px", borderRadius: "12px" }}>
              <div style={{ fontSize: "10px", opacity: 0.6 }}>MA COM</div>
              <div style={{ fontWeight: "800", color: "#f7b731" }}>{fmt(mesVentes.reduce((s, v) => s + v.commissionMontant, 0))}</div>
           </div>
        </div>
      </div>
      
      <div style={{ padding: "16px" }}>
        {mesVentes.map(v => (
          <div key={v.id} style={S.card}>
            <b>{v.article}</b>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
              <MiniStat label="Vendu" value={fmt(v.prixVente)} />
              <MiniStat label="Commission" value={fmt(v.commissionMontant)} color="#e94560" />
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setShowVente(true)} style={{ position: "fixed", bottom: "30px", right: "20px", width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "#e94560", color: "#fff", border: "none", fontSize: "30px", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>+</button>

      {showVente && (
        <div style={S.overlay} onClick={() => setShowVente(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "800", marginBottom: "20px" }}>Nouvelle vente</div>
            <Field label="Article"><Select value={venteForm.stockId} onChange={(v:any) => setVenteForm({...venteForm, stockId: v})} options={stockDispo.map((s:any) => ({value: s.id, label: s.nom}))}/></Field>
            <Field label="Prix"><TInput type="number" value={venteForm.prixVente} onChange={(v:any) => setVenteForm({...venteForm, prixVente: v})}/></Field>
            <button onClick={addVente} style={{ ...S.btn("#e94560", false), marginTop: "15px" }}>Valider</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ADMIN ─────────────────────────────────────────────────────────────────
function AppAdmin({ vendeurs, stock, ventes, save }: any) {
  const [tab, setTab] = useState("dashboard");
  const [showVente, setShowVente] = useState(false);
  const [showVenteDir, setShowVenteDir] = useState(false);
  const [showStock, setShowStock] = useState(false);
  
  const [venteForm, setVenteForm] = useState({ vendeur: vendeurs?.nom || "", stockId: "", prixVente: "", note: "" });
  const [venteDirForm, setVenteDirForm] = useState({ auteur: "Moi", stockId: "", prixVente: "", note: "" });
  const [stockForm, setStockForm] = useState({ nom: "", prixAchat: "", quantite: "1" });

  const stockDispo = stock.filter((s: any) => s.quantite > 0);
  const stats = useMemo(() => ({
    ca: ventes.reduce((s:number, v:any) => s + v.prixVente, 0),
    benef: ventes.reduce((s:number, v:any) => s + v.partEntreprise, 0),
  }), [ventes]);

  const classementVendeurs = useMemo(() => {
    return vendeurs.map((v: any) => {
      const vv = ventes.filter((x: any) => x.vendeur === v.nom && !x.isDir);
      return { nom: v.nom, nb: vv.length, ca: vv.reduce((s: number, x: any) => s + x.prixVente, 0) };
    }).sort((a: any, b: any) => b.nb - a.nb);
  }, [ventes, vendeurs]);

  const processVente = async (form: any, isDir: boolean) => {
    if (!form.stockId || !form.prixVente) return;
    const article = stock.find((s: any) => s.id === +form.stockId);
    if (!article) return;

    const prixVente = +form.prixVente;
    const benefBrut = prixVente - article.prixAchat;
    let comm = 0;
    let nomVendeur = form.auteur;

    if (!isDir) {
      const vObj = vendeurs.find((v: any) => v.nom === form.vendeur);
      comm = benefBrut * (vObj.commission / 100);
      nomVendeur = vObj.nom;
    }

    const nouvelleVente = {
      id: Date.now(), date: fmtDate(), mois: moisActuel(),
      vendeur: nomVendeur, article: article.nom, prixAchat: article.prixAchat,
      prixVente, benefBrut, commissionMontant: comm,
      partEntreprise: benefBrut - comm, isDir, note: form.note
    };

    const newVentes = [nouvelleVente, ...ventes];
    const newStock = stock.map((s: any) => s.id === article.id ? { ...s, quantite: s.quantite - 1 } : s);
    await Promise.all([save("ventes", newVentes), save("stock", newStock)]);
    setShowVente(false); setShowVenteDir(false);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px" }}>
        <div style={{ fontSize: "10px", color: "#e94560", fontWeight: "800" }}>ADMINISTRATION 👑</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "15px" }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: "12px", borderRadius: "14px" }}>
            <div style={{ fontSize: "10px", opacity: 0.5 }}>BÉNÉFICE TOTAL</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#e94560" }}>{fmt(stats.benef)}</div>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: "12px", borderRadius: "14px" }}>
            <div style={{ fontSize: "10px", opacity: 0.5 }}>CA GLOBAL</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#4ecdc4" }}>{fmt(stats.ca)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "5px", marginTop: "15px" }}>
          {["dashboard", "ventes", "stock"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", backgroundColor: tab === t ? "#e94560" : "rgba(255,255,255,0.05)", color: "#fff", fontSize: "11px", fontWeight: "700" }}>{t.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {tab === "dashboard" && classementVendeurs.map((v, i) => (
          <div key={v.nom} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{i+1}. <b>{v.nom}</b></span>
              <span style={{ color: "#4ecdc4", fontWeight: "800" }}>{fmt(v.ca)}</span>
            </div>
          </div>
        ))}

        {tab === "ventes" && ventes.map(v => (
          <div key={v.id} style={{ ...S.card, borderLeft: v.isDir ? "4px solid #1a1a2e" : "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{v.article}</b>
              <span style={{ fontSize: "11px", fontWeight: "800", color: v.isDir ? "#1a1a2e" : "#64748b" }}>{v.isDir ? "👑 DIRECTION" : v.vendeur}</span>
            </div>
            <div style={{ fontSize: "13px", marginTop: "5px" }}>Vendu: {fmt(v.prixVente)} | Gain: {fmt(v.partEntreprise)}</div>
          </div>
        ))}

        {tab === "stock" && (
          <div>
            <button onClick={() => setShowStock(true)} style={{ ...S.btn("#1a1a2e", false), marginBottom: "10px" }}>+ Ajouter du stock</button>
            {stock.map(s => (
              <div key={s.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><b>{s.nom}</b><span>×{s.quantite}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOUTONS ACTIONS ADMIN */}
      <div style={{ position: "fixed", bottom: "20px", right: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <button onClick={() => setShowVenteDir(true)} style={{ padding: "12px 20px", borderRadius: "25px", backgroundColor: "#1a1a2e", color: "#fff", border: "none", fontWeight: "800", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}>👑 Vente Associé</button>
        <button onClick={() => setShowVente(true)} style={{ padding: "12px 20px", borderRadius: "25px", backgroundColor: "#e94560", color: "#fff", border: "none", fontWeight: "800", boxShadow: "0 4px 15px rgba(233,69,96,0.3)" }}>🛍️ Vente Employé</button>
      </div>

      {/* MODAL VENTE ASSOCIÉ */}
      {showVenteDir && (
        <div style={S.overlay} onClick={() => setShowVenteDir(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "800", marginBottom: "20px", color: "#1a1a2e" }}>Vente Associé (0% com)</div>
            <Field label="Vendeur"><Select value={venteDirForm.auteur} onChange={(v:any) => setVenteDirForm({...venteDirForm, auteur: v})} options={["Moi", "Associé"]}/></Field>
            <Field label="Article"><Select value={venteDirForm.stockId} onChange={(v:any) => setVenteDirForm({...venteDirForm, stockId: v})} options={stockDispo.map((s:any) => ({value: s.id, label: s.nom}))}/></Field>
            <Field label="Prix"><TInput type="number" value={venteDirForm.prixVente} onChange={(v:any) => setVenteDirForm({...venteDirForm, prixVente: v})}/></Field>
            <button onClick={() => processVente(venteDirForm, true)} style={S.btn("#1a1a2e", false)}>Valider Vente Direction</button>
          </div>
        </div>
      )}

      {/* MODAL VENTE EMPLOYÉ */}
      {showVente && (
        <div style={S.overlay} onClick={() => setShowVente(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "800", marginBottom: "20px" }}>Vente Employé</div>
            <Field label="Vendeur"><Select value={venteForm.vendeur} onChange={(v:any) => setVenteForm({...venteForm, vendeur: v})} options={vendeurs.map((v:any) => v.nom)}/></Field>
            <Field label="Article"><Select value={venteForm.stockId} onChange={(v:any) => setVenteForm({...venteForm, stockId: v})} options={stockDispo.map((s:any) => ({value: s.id, label: s.nom}))}/></Field>
            <Field label="Prix"><TInput type="number" value={venteForm.prixVente} onChange={(v:any) => setVenteForm({...venteForm, prixVente: v})}/></Field>
            <button onClick={() => processVente(venteForm, false)} style={S.btn("#e94560", false)}>Enregistrer</button>
          </div>
        </div>
      )}

      {/* MODAL STOCK */}
      {showStock && (
        <div style={S.overlay} onClick={() => setShowStock(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: "800", marginBottom: "20px" }}>Nouveau Stock</div>
            <Field label="Nom"><TInput value={stockForm.nom} onChange={(v:any) => setStockForm({...stockForm, nom: v})}/></Field>
            <Field label="Prix Achat"><TInput type="number" value={stockForm.prixAchat} onChange={(v:any) => setStockForm({...stockForm, prixAchat: v})}/></Field>
            <Field label="Quantité"><TInput type="number" value={stockForm.quantite} onChange={(v:any) => setStockForm({...stockForm, quantite: v})}/></Field>
            <button onClick={async () => {
              const newS = [...stock, {id: Date.now(), ...stockForm, prixAchat: +stockForm.prixAchat, quantite: +stockForm.quantite}];
              await save("stock", newS); setShowStock(false);
            }} style={S.btn("#22c55e", false)}>Ajouter</button>
          </div>
        </div>
      )}
    </div>
  );
}
