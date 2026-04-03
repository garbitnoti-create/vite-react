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

// Détection du mode via URL
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

  const classement = useMemo(() => {
    return vendeurs.map((v: any) => {
      const vv = ventes.filter((x: any) => x.vendeur === v.nom);
      return { nom: v.nom, nb: vv.length, ca: vv.reduce((s: number, x: any) => s + x.prixVente, 0) };
    }).sort((a: any, b: any) => b.nb - a.nb);
  }, [ventes, vendeurs]);

  const addVente = async () => {
    if (!venteForm.stockId || !venteForm.prixVente) return;
    const article = stock.find((s: any) => s.id === +venteForm.stockId);
    const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
    if (!article || !vendeur) return;
    const prixVente = +venteForm.prixVente;
    const benefBrut = prixVente - article.prixAchat;
    const commissionMontant = benefBrut * (vendeur.commission / 100);
    const partEntreprise = benefBrut - commissionMontant;
    const vente = { id: Date.now(), date: fmtDate(), mois: moisActuel(), vendeur: vendeur.nom, commission: vendeur.commission, article: article.nom, prixAchat: article.prixAchat, prixVente, benefBrut, commissionMontant, partEntreprise, note: venteForm.note };
    await onAddVente(vente, article.id);
    setVenteForm({ stockId: "", prixVente: "", note: "" });
    setShowVente(false);
    showToast(`Vente enregistrée ! Ta part : ${fmt(commissionMontant)} ✓`);
  };

  const nomAffiche = nomVendeur.charAt(0).toUpperCase() + nomVendeur.slice(1);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "480px", margin: "0 auto" }}>
      {toast && <div style={{ position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", backgroundColor: toast.color, color: "#fff", padding: "12px 24px", borderRadius: "100px", fontSize: "14px", fontWeight: "700", zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>{toast.msg}</div>}

      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "20px 16px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: "#e94560", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.12em" }}>Vinted Business</div>
          <div style={{ fontSize: "22px", fontWeight: "800", marginTop: "2px" }}>Bonjour {nomAffiche} 👋</div>
        </div>

        {/* Solde vendeur */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", marginBottom: "10px" }}>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700", marginBottom: "4px" }}>💰 Total gagné</div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#f7b731" }}>{fmt(mesVentes.reduce((s: number, v: any) => s + v.commissionMontant, 0))}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700" }}>✅ Déjà payé</div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#4ecdc4", marginTop: "4px" }}>{fmt(paiements.filter((p: any) => p.vendeur.toLowerCase() === nomVendeur.toLowerCase() && (p.montant > 0)).reduce((s: number, p: any) => s + p.montant, 0))}</div>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontWeight: "700" }}>🔴 Reste à payer</div>
            <div style={{ fontSize: "16px", fontWeight: "800", color: monSolde > 0 ? "#e94560" : "#4ecdc4", marginTop: "4px" }}>{fmt(monSolde)}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "4px" }}>
          {[["ventes", "🛍️ Mes ventes"], ["classement", "🏆 Classement"], ["stock", "📦 Stock"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "10px 4px", borderRadius: "10px", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer", backgroundColor: tab === key ? "#e94560" : "transparent", color: tab === key ? "#fff" : "rgba(255,255,255,0.45)" }}>
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
                <div style={{ fontWeight: "700", fontSize: "16px", color: "#1a1a2e" }}>{v.article}</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{v.date}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
                  <MiniStat label="Vendu" value={fmt(v.prixVente)} color="#4ecdc4" />
                  <MiniStat label="Ma commission" value={fmt(v.commissionMontant)} color="#e94560" />
                </div>
                {v.note && <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>📝 {v.note}</div>}
              </div>
            ))
        )}

        {tab === "classement" && (
          <div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>🏆 Classement des vendeurs</div>
            {classement.map((v: any, i: number) => (
              <div key={v.nom} style={{ ...S.card, border: v.nom.toLowerCase() === nomVendeur.toLowerCase() ? "2px solid #e94560" : "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: i === 0 ? "#f7b731" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px", color: i < 3 ? "#fff" : "#64748b", flexShrink: 0 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "700", color: "#1a1a2e", fontSize: "15px" }}>{v.nom} {v.nom.toLowerCase() === nomVendeur.toLowerCase() ? "👈 toi" : ""}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{v.nb} vente(s)</div>
                  </div>
                  <div style={{ fontWeight: "800", color: "#4ecdc4", fontSize: "15px" }}>{fmt(v.ca)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "stock" && (
          stock.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}><div style={{ fontSize: "52px" }}>📦</div><div style={{ fontWeight: "700", marginTop: "12px" }}>Stock vide</div></div>
            : stock.map((s: any) => (
              <div key={s.id} style={{ ...S.card, opacity: s.quantite === 0 ? 0.4 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e" }}>{s.nom}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{s.categorie}</div>
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: "800", color: s.quantite === 0 ? "#ef4444" : "#22c55e" }}>×{s.quantite}</div>
                </div>
              </div>
            ))
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
                      options={stockDispo.map((s: any) => ({ value: String(s.id), label: `${s.nom} (×${s.quantite})` }))} />
                }
              </Field>
              <Field label="Prix de vente (€)">
                <TInput type="number" value={venteForm.prixVente} onChange={(v: string) => setVenteForm({ ...venteForm, prixVente: v })} placeholder="Ex: 50" />
              </Field>
              {venteForm.stockId && venteForm.prixVente && (() => {
                const article = stock.find((s: any) => s.id === +venteForm.stockId);
                const vendeur = vendeurs.find((v: any) => v.nom.toLowerCase() === nomVendeur.toLowerCase());
                if (!article || !vendeur) return null;
                const benef = +venteForm.prixVente - article.prixAchat;
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

// ─── APP ADMIN ─────────────────────────────────────────────────────────────────
function AppAdmin({ vendeurs, setVendeurs, stock, setStock, ventes, setVentes, paiements, setPaiements, save }: any) {
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState<any>(null);
  const [showVente, setShowVente] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editStock, setEditStock] = useState<any>(null);
  const [showPaiement, setShowPaiement] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [venteForm, setVenteForm] = useState({ vendeur: vendeurs[0]?.nom || "", stockId: "", prixVente: "", note: "" });
  const [stockForm, setStockForm] = useState({ nom: "", categorie: "Vêtements", prixAchat: "", quantite: "1" });
  const [paiementForm, setPaiementForm] = useState({ montant: "", note: "" });
  const [showAjustement, setShowAjustement] = useState<any>(null);
  const [ajustementForm, setAjustementForm] = useState({ montant: "", note: "", type: "prime" });

  const showToast = (msg: string, color = "#22c55e") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };
  const saveSync = async (key: string, data: any) => { setSyncing(true); await save(key, data); setTimeout(() => setSyncing(false), 800); };

  const stockDispo = stock.filter((s: any) => s.quantite > 0);
  const ventesMonth = useMemo(() => ventes.filter((v: any) => v.mois === moisActuel()), [ventes]);
  const stats = useMemo(() => ({
    ca: ventes.reduce((s: number, v: any) => s + v.prixVente, 0),
    caMonth: ventesMonth.reduce((s: number, v: any) => s + v.prixVente, 0),
    benef: ventes.reduce((s: number, v: any) => s + v.partEntreprise, 0),
    benefMonth: ventesMonth.reduce((s: number, v: any) => s + v.partEntreprise, 0),
    commissions: ventes.reduce((s: number, v: any) => s + v.commissionMontant, 0),
    commissionsMonth: ventesMonth.reduce((s: number, v: any) => s + v.commissionMontant, 0),
    nbVentes: ventes.length, nbVentesMonth: ventesMonth.length,
  }), [ventes, ventesMonth]);

  const statsVendeurs = useMemo(() => vendeurs.map((v: any) => {
    const vv = ventes.filter((x: any) => x.vendeur === v.nom);
    const vvM = ventesMonth.filter((x: any) => x.vendeur === v.nom);
    const totalDu = vv.reduce((s: number, x: any) => s + x.commissionMontant, 0);
    const totalPaye = paiements.filter((p: any) => p.vendeur === v.nom).reduce((s: number, p: any) => s + p.montant, 0);
    return { ...v, nb: vv.length, nbMonth: vvM.length, ca: vv.reduce((s: number, x: any) => s + x.prixVente, 0), commissionTotal: totalDu, commissionMonth: vvM.reduce((s: number, x: any) => s + x.commissionMontant, 0), totalPaye, solde: totalDu - totalPaye };
  }), [ventes, ventesMonth, paiements, vendeurs]);

  const addStock = async () => {
    if (!stockForm.nom || !stockForm.prixAchat) return;
    const newStock = [...stock, { id: Date.now(), ...stockForm, prixAchat: +stockForm.prixAchat, quantite: +stockForm.quantite, mois: moisActuel() }];
    setStock(newStock); await saveSync("stock", newStock);
    setStockForm({ nom: "", categorie: "Vêtements", prixAchat: "", quantite: "1" });
    setShowStock(false); showToast("Article ajouté ✓");
  };

  const saveEditStock = async () => {
    if (!editStock) return;
    const newStock = stock.map((s: any) => s.id === editStock.id ? { ...editStock, prixAchat: +editStock.prixAchat, quantite: +editStock.quantite } : s);
    setStock(newStock); await saveSync("stock", newStock);
    setEditStock(null); showToast("Stock modifié ✓");
  };

  const deleteStock = async (id: number) => {
    const newStock = stock.filter((s: any) => s.id !== id);
    setStock(newStock); await saveSync("stock", newStock);
    setEditStock(null); showToast("Article supprimé", "#ef4444");
  };

  const addVente = async () => {
    if (!venteForm.vendeur || !venteForm.stockId || !venteForm.prixVente) return;
    const article = stock.find((s: any) => s.id === +venteForm.stockId);
    const vendeur = vendeurs.find((v: any) => v.nom === venteForm.vendeur);
    if (!article || !vendeur) return;
    const prixVente = +venteForm.prixVente;
    const benefBrut = prixVente - article.prixAchat;
    const commissionMontant = benefBrut * (vendeur.commission / 100);
    const partEntreprise = benefBrut - commissionMontant;
    const vente = { id: Date.now(), date: fmtDate(), mois: moisActuel(), vendeur: vendeur.nom, commission: vendeur.commission, article: article.nom, prixAchat: article.prixAchat, prixVente, benefBrut, commissionMontant, partEntreprise, note: venteForm.note };
    const newVentes = [vente, ...ventes];
    const newStock = stock.map((s: any) => s.id === article.id ? { ...s, quantite: s.quantite - 1 } : s);
    setVentes(newVentes); setStock(newStock);
    await Promise.all([saveSync("ventes", newVentes), saveSync("stock", newStock)]);
    setVenteForm({ vendeur: vendeurs[0]?.nom || "", stockId: "", prixVente: "", note: "" });
    setShowVente(false); showToast(`Bénéfice entreprise : ${fmt(partEntreprise)} ✓`);
  };

  const deleteVente = async (id: number) => {
    const v = ventes.find((x: any) => x.id === id);
    const newVentes = ventes.filter((x: any) => x.id !== id);
    const newStock = v ? stock.map((s: any) => s.nom === v.article ? { ...s, quantite: s.quantite + 1 } : s) : stock;
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
    // On utilise un paiement négatif pour une prime (augmente le solde dû) et positif pour une déduction
    const p = { id: Date.now(), vendeur: showAjustement, montant: -montant, date: fmtDate(), note: ajustementForm.note || (ajustementForm.type === "prime" ? "Prime" : ajustementForm.type === "dette" ? "Dette initiale" : "Déduction"), type: ajustementForm.type };
    const newP = [p, ...paiements];
    setPaiements(newP); await saveSync("paiements", newP);
    setAjustementForm({ montant: "", note: "", type: "prime" }); setShowAjustement(null);
    showToast(`Ajustement enregistré ✓`);
  };

  const saveVendeurs = async () => { await saveSync("vendeurs", vendeurs); setShowSettings(false); showToast("Commissions sauvegardées ✓"); };

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
          {[["dashboard", "📊"], ["ventes", "🛍️"], ["stock", "📦"], ["vendeurs", "👥"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "10px 4px", borderRadius: "10px", border: "none", fontSize: "16px", cursor: "pointer", backgroundColor: tab === key ? "#e94560" : "transparent", color: tab === key ? "#fff" : "rgba(255,255,255,0.45)" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ height: "16px" }} />
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
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

        {tab === "ventes" && (
          ventes.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}><div style={{ fontSize: "52px" }}>🛍️</div><div style={{ fontWeight: "700", marginTop: "12px" }}>Aucune vente</div></div>
            : ventes.map((v: any) => (
              <div key={v.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div><div style={{ fontWeight: "700", fontSize: "16px", color: "#1a1a2e" }}>{v.article}</div><div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{v.date} · {v.vendeur} ({v.commission}%)</div></div>
                  <button onClick={() => deleteVente(v.id)} style={{ background: "none", border: "none", color: "#cbd5e1", fontSize: "18px", cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "12px" }}>
                  <MiniStat label="Vendu" value={fmt(v.prixVente)} color="#4ecdc4" />
                  <MiniStat label="Commission" value={fmt(v.commissionMontant)} color="#f7b731" />
                  <MiniStat label="Entreprise" value={fmt(v.partEntreprise)} color="#e94560" />
                </div>
                {v.note && <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>📝 {v.note}</div>}
              </div>
            ))
        )}

        {tab === "stock" && (
          stock.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}><div style={{ fontSize: "52px" }}>📦</div><div style={{ fontWeight: "700", marginTop: "12px" }}>Stock vide</div></div>
            : stock.map((s: any) => (
              <div key={s.id} style={{ ...S.card, opacity: s.quantite === 0 ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontWeight: "700", fontSize: "16px", color: "#1a1a2e" }}>{s.nom}</div><div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{s.categorie} · Acheté {fmt(s.prixAchat)}</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "28px", fontWeight: "800", color: s.quantite === 0 ? "#ef4444" : "#22c55e" }}>×{s.quantite}</div>
                    <button onClick={() => setEditStock({ ...s })} style={{ backgroundColor: "#f1f5f9", border: "none", borderRadius: "10px", padding: "8px 12px", fontSize: "14px", cursor: "pointer", color: "#64748b" }}>✏️</button>
                  </div>
                </div>
              </div>
            ))
        )}

        {tab === "vendeurs" && statsVendeurs.map((v: any) => (
          <div key={v.nom} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontWeight: "800", fontSize: "18px", color: "#1a1a2e" }}>{v.nom}</div>
              <div style={{ backgroundColor: "#e94560", color: "#fff", fontSize: "12px", fontWeight: "700", padding: "4px 14px", borderRadius: "100px" }}>{v.commission}%</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
              <MiniStat label="Ventes" value={v.nb} />
              <MiniStat label="CA" value={fmt(v.ca)} color="#4ecdc4" />
              <MiniStat label="Comm. totale" value={fmt(v.commissionTotal)} color="#f7b731" />
            </div>
            <div style={{ backgroundColor: v.solde > 0 ? "#fef2f2" : "#f0fdf4", borderRadius: "12px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: "700", color: v.solde > 0 ? "#ef4444" : "#16a34a", textTransform: "uppercase" }}>Solde à payer</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: v.solde > 0 ? "#ef4444" : "#16a34a" }}>{fmt(v.solde)}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Déjà payé : {fmt(v.totalPaye)}</div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {v.solde > 0 && <button onClick={() => { setShowPaiement(v.nom); setPaiementForm({ montant: v.solde.toFixed(2), note: "" }); }} style={{ backgroundColor: "#e94560", color: "#fff", border: "none", borderRadius: "12px", padding: "10px 16px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>💸 Payer</button>}
                <button onClick={() => { setShowAjustement(v.nom); setAjustementForm({ montant: "", note: "", type: "prime" }); }} style={{ backgroundColor: "#a29bfe", color: "#fff", border: "none", borderRadius: "12px", padding: "10px 16px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>✏️ Ajuster</button>
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

      <div style={{ position: "fixed", bottom: "32px", right: "20px", zIndex: 40 }}>
        {tab === "stock" && <button onClick={() => setShowStock(true)} style={{ width: "58px", height: "58px", borderRadius: "50%", backgroundColor: "#4ecdc4", border: "none", fontSize: "30px", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(78,205,196,0.5)", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
        {tab === "ventes" && <button onClick={() => setShowVente(true)} style={{ width: "58px", height: "58px", borderRadius: "50%", backgroundColor: "#e94560", border: "none", fontSize: "30px", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(233,69,96,0.5)", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
      </div>

      {showVente && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowVente(false)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>🛍️ Nouvelle vente</div>
              <button onClick={() => setShowVente(false)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Vendeur"><Select value={venteForm.vendeur} onChange={(v: string) => setVenteForm({ ...venteForm, vendeur: v })} options={vendeurs.map((v: any) => ({ value: v.nom, label: `${v.nom} (${v.commission}%)` }))} /></Field>
              <Field label="Article vendu">
                {stockDispo.length === 0
                  ? <div style={{ backgroundColor: "#fef2f2", color: "#ef4444", padding: "14px", borderRadius: "12px", fontSize: "13px", fontWeight: "600", textAlign: "center" }}>⚠️ Stock vide</div>
                  : <Select value={venteForm.stockId} onChange={(v: string) => setVenteForm({ ...venteForm, stockId: v })} placeholder="Choisir un article..." options={stockDispo.map((s: any) => ({ value: String(s.id), label: `${s.nom} — achat ${fmt(s.prixAchat)} (×${s.quantite})` }))} />
                }
              </Field>
              <Field label="Prix de vente (€)"><TInput type="number" value={venteForm.prixVente} onChange={(v: string) => setVenteForm({ ...venteForm, prixVente: v })} placeholder="Ex: 50" /></Field>
              {venteForm.stockId && venteForm.prixVente && (() => {
                const article = stock.find((s: any) => s.id === +venteForm.stockId);
                const vendeur = vendeurs.find((v: any) => v.nom === venteForm.vendeur);
                if (!article || !vendeur) return null;
                const benef = +venteForm.prixVente - article.prixAchat;
                const comm = benef * vendeur.commission / 100;
                return (
                  <div style={{ backgroundColor: "#f0fdf4", borderRadius: "14px", padding: "14px", border: "2px solid #bbf7d0" }}>
                    <div style={{ fontSize: "10px", fontWeight: "800", color: "#16a34a", marginBottom: "10px", textTransform: "uppercase" }}>Aperçu</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
                      <MiniStat label="Bénéfice" value={fmt(benef)} />
                      <MiniStat label="Commission" value={fmt(comm)} color="#f7b731" />
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

      {showStock && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowStock(false)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>📦 Ajouter au stock</div>
              <button onClick={() => setShowStock(false)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Nom de l'article"><TInput value={stockForm.nom} onChange={(v: string) => setStockForm({ ...stockForm, nom: v })} placeholder="Ex: Sac Lacoste noir" /></Field>
              <Field label="Catégorie"><Select value={stockForm.categorie} onChange={(v: string) => setStockForm({ ...stockForm, categorie: v })} options={CATEGORIES} /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Prix d'achat (€)"><TInput type="number" value={stockForm.prixAchat} onChange={(v: string) => setStockForm({ ...stockForm, prixAchat: v })} placeholder="Ex: 12,56" /></Field>
                <Field label="Quantité"><TInput type="number" value={stockForm.quantite} onChange={(v: string) => setStockForm({ ...stockForm, quantite: v })} placeholder="Ex: 20" /></Field>
              </div>
              <button onClick={addStock} disabled={!stockForm.nom || !stockForm.prixAchat} style={S.btn("#4ecdc4", !stockForm.nom || !stockForm.prixAchat)}>Ajouter ✓</button>
            </div>
          </div>
        </div>
      )}

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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Prix d'achat (€)"><TInput type="number" value={editStock.prixAchat} onChange={(v: string) => setEditStock({ ...editStock, prixAchat: v })} placeholder="Prix" /></Field>
                <Field label="Quantité"><TInput type="number" value={editStock.quantite} onChange={(v: string) => setEditStock({ ...editStock, quantite: v })} placeholder="Qté" /></Field>
              </div>
              <button onClick={saveEditStock} style={S.btn("#4ecdc4", false)}>Sauvegarder ✓</button>
              <button onClick={() => deleteStock(editStock.id)} style={S.btn("#ef4444", false)}>🗑️ Supprimer</button>
            </div>
          </div>
        </div>
      )}

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
              <Field label="Montant (€)">
                <TInput type="number" value={ajustementForm.montant} onChange={(v: string) => setAjustementForm({ ...ajustementForm, montant: v })} placeholder="Ex: 15" />
              </Field>
              <Field label="Note (optionnel)">
                <TInput value={ajustementForm.note} onChange={(v: string) => setAjustementForm({ ...ajustementForm, note: v })} placeholder="Ex: prime de bienvenue" />
              </Field>
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

      {showSettings && (
        <div style={S.overlay} onClick={(e: any) => e.target === e.currentTarget && setShowSettings(false)}>
          <div style={S.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#1a1a2e" }}>⚙️ Commissions vendeurs</div>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", fontSize: "22px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: "12px", backgroundColor: "#f0fdf4", borderRadius: "12px", padding: "12px", fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>🔄 Synchronisé en temps réel</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              {vendeurs.map((v: any, i: number) => (
                <div key={v.nom} style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#fff", borderRadius: "12px", padding: "12px 16px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "700", color: "#1a1a2e", flex: 1, fontSize: "15px" }}>{v.nom}</div>
                  <input type="number" min="0" max="100" value={v.commission} onChange={(e: any) => setVendeurs((prev: any) => prev.map((x: any, j: number) => j === i ? { ...x, commission: +e.target.value } : x))} style={{ width: "64px", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "8px 10px", fontSize: "16px", fontWeight: "700", color: "#1a1a2e", backgroundColor: "#fff", textAlign: "center", outline: "none" }} />
                  <span style={{ color: "#64748b", fontWeight: "700", fontSize: "15px" }}>%</span>
                </div>
              ))}
            </div>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, "vinted", "ventes"), (snap) => { if (snap.exists()) setVentes(JSON.parse(snap.data().data)); setLoading(false); }),
      onSnapshot(doc(db, "vinted", "stock"), (snap) => { if (snap.exists()) setStock(JSON.parse(snap.data().data)); }),
      onSnapshot(doc(db, "vinted", "vendeurs"), (snap) => { if (snap.exists()) setVendeurs(JSON.parse(snap.data().data)); else setLoading(false); }),
      onSnapshot(doc(db, "vinted", "paiements"), (snap) => { if (snap.exists()) setPaiements(JSON.parse(snap.data().data)); }),
    ];
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => { unsubs.forEach(u => u()); clearTimeout(timer); };
  }, []);

  const save = async (key: string, data: any) => { await fbSave(key, data); };

  const handleAddVente = async (vente: any, articleId: number) => {
    const newVentes = [vente, ...ventes];
    const newStock = stock.map((s: any) => s.id === articleId ? { ...s, quantite: s.quantite - 1 } : s);
    setVentes(newVentes); setStock(newStock);
    await Promise.all([save("ventes", newVentes), save("stock", newStock)]);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "48px" }}>👗</div>
      <div style={{ fontWeight: "700", color: "#1a1a2e", fontSize: "18px" }}>Chargement...</div>
    </div>
  );

  // Mode admin
  if (IS_ADMIN) {
    return <AppAdmin vendeurs={vendeurs} setVendeurs={setVendeurs} stock={stock} setStock={setStock} ventes={ventes} setVentes={setVentes} paiements={paiements} setPaiements={setPaiements} save={save} />;
  }

  // Mode vendeur
  if (VENDEUR_PARAM) {
    const vendeurTrouve = vendeurs.find((v: any) => v.nom.toLowerCase() === VENDEUR_PARAM);
    if (!vendeurTrouve) return <PageInconnue />;
    return <AppVendeur nomVendeur={vendeurTrouve.nom} vendeurs={vendeurs} stock={stock} ventes={ventes} paiements={paiements} onAddVente={handleAddVente} />;
  }

  return <PageInconnue />;
}
