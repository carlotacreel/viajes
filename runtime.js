// Runtime de Firebase para la app de viajes: login, datos, fotos y descargas.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot,
  setDoc, deleteDoc, getDoc, getDocFromCache, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, OWNER_EMAIL } from "./firebase-config.js?v=3";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

/* ---------- pantalla de acceso ---------- */
const LS_EMAIL = "viajes-email";
const box = document.getElementById("login");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function showLogin(msg = "", sent = false) {
  document.getElementById("main").hidden = true;
  box.hidden = false;
  box.innerHTML = `<div class="lg">
    <div class="lg-brand"><b>Carlota The Travel Maker</b><span>Viajes a la medida</span></div>
    ${sent ? `<h2>Revisa tu correo</h2><p class="note">Te mandamos un enlace para entrar. Ábrelo en este mismo teléfono.</p>
      <button class="ghost" id="lg-back">Usar otro correo</button>`
    : `<h2>Tu viaje, a la mano</h2><p class="note">Escribe el correo con el que reservaste y te mandamos un enlace para entrar. Sin contraseñas.</p>
      <form id="lg-form" class="stack"><input id="lg-email" type="email" autocomplete="email" required placeholder="tu@correo.com" value="${esc(localStorage.getItem(LS_EMAIL) || "")}">
      <button class="primary" type="submit">Enviarme el enlace</button></form>
      <div class="lg-or"><span>o</span></div>
      <button id="lg-google"><svg class="icon" viewBox="0 0 24 24"><path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7z"/><path d="M12 21c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5A9.5 9.5 0 0 0 12 21z"/></svg>Entrar con Google</button>`}
    ${msg ? `<p class="note err">${esc(msg)}</p>` : ""}</div>`;
  document.getElementById("lg-back")?.addEventListener("click", () => showLogin());
  document.getElementById("lg-google")?.addEventListener("click", async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { if (e.code === "auth/popup-blocked") signInWithRedirect(auth, new GoogleAuthProvider()); else showLogin("No se pudo entrar con Google. Intenta de nuevo."); }
  });
  document.getElementById("lg-form")?.addEventListener("submit", async ev => {
    ev.preventDefault();
    const email = document.getElementById("lg-email").value.trim().toLowerCase();
    try {
      await sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
      localStorage.setItem(LS_EMAIL, email); showLogin("", true);
    } catch (e) { showLogin("No pudimos enviar el enlace. Revisa el correo y vuelve a intentar."); }
  });
}

/* ---------- llegar desde el enlace del correo ---------- */
if (isSignInWithEmailLink(auth, location.href)) {
  let email = localStorage.getItem(LS_EMAIL);
  if (!email) email = (prompt("Confirma tu correo para entrar") || "").trim().toLowerCase();
  signInWithEmailLink(auth, email, location.href)
    .then(() => history.replaceState(null, "", location.pathname))
    .catch(() => showLogin("El enlace ya expiró o se usó antes. Pide uno nuevo."));
}

/* ---------- fotos guardadas en Firestore ---------- */
const FOTO = "fsimg:";
const urlCache = new Map(), pending = new Map();
async function fotoObjectUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  if (pending.has(id)) return pending.get(id);
  const p = (async () => {
    const ref = doc(fs, "fotos", id);
    let snap; try { snap = await getDocFromCache(ref); } catch (e) { snap = await getDoc(ref); }
    if (!snap.exists()) return "";
    const d = snap.data(); const bin = atob(d.b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([arr], { type: d.ct || "image/jpeg" })); urlCache.set(id, u); return u;
  })().catch(() => "");
  pending.set(id, p); return p;
}
function resolveIn(root) {
  root.querySelectorAll(`img[src^="${FOTO}"]`).forEach(async img => {
    const id = img.getAttribute("src").slice(FOTO.length); img.removeAttribute("src");
    const u = await fotoObjectUrl(id); if (u) img.src = u;
  });
  root.querySelectorAll(`a[href^="${FOTO}"]`).forEach(async a => {
    const id = a.getAttribute("href").slice(FOTO.length); a.removeAttribute("href");
    const u = await fotoObjectUrl(id); if (u) a.href = u;
  });
  root.querySelectorAll(`[style*="${FOTO}"]`).forEach(async el => {
    const st = el.getAttribute("style"); const ids = [...st.matchAll(/fsimg:([A-Za-z0-9_-]+)/g)].map(m => m[1]);
    let out = st; for (const id of ids) { const u = await fotoObjectUrl(id); out = out.split(FOTO + id).join(u || ""); }
    el.setAttribute("style", out);
  });
}
new MutationObserver(ms => { for (const m of ms) { if (m.type === "childList") m.addedNodes.forEach(n => n.nodeType === 1 && resolveIn(n.parentNode || n)); else if (m.target.nodeType === 1) resolveIn(m.target.parentNode || m.target); } })
  .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "style", "href"] });

async function compress(blob, max = 1400, q = .82) {
  try {
    const bmp = await createImageBitmap(blob); const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let out = await new Promise(r => c.toBlob(r, "image/jpeg", q));
    if (out.size > 700000) out = await new Promise(r => c.toBlob(r, "image/jpeg", .65));
    return out;
  } catch (e) { return blob; }
}
const toB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b); });
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 20);
async function saveFoto(blob) {
  const isImg = /^image\//.test(blob.type || "image/jpeg");
  const b = isImg ? await compress(blob) : blob;
  if (b.size > 950000) throw { code: "too_large" };
  const id = newId(); await setDoc(doc(fs, "fotos", id), { b64: await toB64(b), ct: b.type || "image/jpeg" });
  return { id, url: FOTO + id };
}

/* ---------- links privados por viaje (sin correo ni contraseña) ---------- */
const LS_LINKS = "viajes-links";
const publico = (t, id) => { const c = { ...t, id }; delete c.email; delete c.clientes; return c; };
const leerLinks = () => { try { return JSON.parse(localStorage.getItem(LS_LINKS) || "[]").filter(x => /^[A-Za-z0-9]{16,}$/.test(x)); } catch (e) { return []; } };
const guardarLinks = l => { try { localStorage.setItem(LS_LINKS, JSON.stringify([...new Set(l)])); } catch (e) {} };
const qLink = new URLSearchParams(location.search).get("v");
if (qLink && /^[A-Za-z0-9]{16,}$/.test(qLink)) guardarLinks([qLink, ...leerLinks()]);
function linkDb() {
  return {
    collection: name => ({
      onSnapshot: (next, err) => {
        const toks = leerLinks(), found = new Map(), seen = new Set();
        const emit = () => { if (seen.size >= toks.length) next({ docs: [...found.values()], size: found.size, empty: !found.size }); };
        if (!toks.length) { next({ docs: [], size: 0, empty: true }); return () => {}; }
        const subs = toks.map(tok => onSnapshot(doc(fs, "compartidos", tok), s => {
          seen.add(tok);
          if (s.exists()) found.set(tok, wrapSnap(s));
          else { found.delete(tok); if (!s.metadata.fromCache) guardarLinks(leerLinks().filter(x => x !== tok)); }
          emit();
        }, e => { seen.add(tok); emit(); }));
        return () => subs.forEach(u => u());
      },
      doc: () => ({ set: async () => {}, delete: async () => {} })
    }),
    doc: path => ({
      onSnapshot: (next, err) => onSnapshot(doc(fs, ...path.split("/")), s => next(wrapSnap(s)), e => err && err(e)),
      set: async () => {}
    })
  };
}
function startLinkMode() {
  started = true; window.__linkMode = true;
  box.hidden = true; document.getElementById("main").hidden = false;
  window.__fotoUrl = u => String(u||"").startsWith(FOTO) ? fotoObjectUrl(String(u).slice(FOTO.length)) : Promise.resolve(u);
  __rt.resolve("user", { isOwner: () => false, email: "" });
  __rt.resolve("db", linkDb());
  __rt.resolve("sample", null);
  __rt.resolve("assets", null);
  __rt.resolve("downloads", { save: async ({ filename, data }) => {
    const b = data instanceof Blob ? data : new Blob([data]); const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); return { status: "saved" };
  } });
}

/* ---------- adaptadores con la forma que espera la app ---------- */
const wrapSnap = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
function makeDb(user, owner) {
  const em = (user.email || "").toLowerCase();
  return {
    collection: name => ({
      onSnapshot: (next, err) => {
        const q = name === "viajes" && !owner ? query(collection(fs, "viajes"), where("clientes", "array-contains", em)) : collection(fs, name);
        return onSnapshot(q, s => next({ docs: s.docs.map(wrapSnap), size: s.size, empty: s.empty }), e => err && err({ code: e.code, message: e.message }));
      },
      doc: id => ({
        set: async data => {
          const clean = JSON.parse(JSON.stringify(data));
          await setDoc(doc(fs, name, id), clean);
          if (name === "viajes" && owner && clean.token) await setDoc(doc(fs, "compartidos", clean.token), publico(clean, id));
        },
        delete: () => deleteDoc(doc(fs, name, id))
      })
    }),
    doc: path => ({
      onSnapshot: (next, err) => onSnapshot(doc(fs, ...path.split("/")), s => next(wrapSnap(s)), e => err && err(e)),
      set: data => setDoc(doc(fs, ...path.split("/")), data)
    })
  };
}

let started = false;
if (qLink && !isSignInWithEmailLink(auth, location.href)) startLinkMode();
onAuthStateChanged(auth, user => {
  if (window.__linkMode) return;
  if (!user) { if (started) location.reload(); else if (leerLinks().length) startLinkMode(); else showLogin(); return; }
  if (started) return; started = true;
  box.hidden = true; document.getElementById("main").hidden = false;
  const owner = (user.email || "").toLowerCase() === OWNER_EMAIL && user.emailVerified;
  document.body.classList.toggle("is-owner", owner);
  window.__logout = () => signOut(auth).then(() => location.reload());
  window.__importFoto = saveFoto;
  window.__fotoUrl = u => String(u||"").startsWith(FOTO) ? fotoObjectUrl(String(u).slice(FOTO.length)) : Promise.resolve(u);
  __rt.resolve("user", { isOwner: () => owner, email: user.email });
  __rt.resolve("db", makeDb(user, owner));
  __rt.resolve("sample", null);
  __rt.resolve("assets", owner ? { upload: saveFoto } : null);
  __rt.resolve("downloads", { save: async ({ filename, data }) => {
    const b = data instanceof Blob ? data : new Blob([data]); const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); return { status: "saved" };
  } });
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
