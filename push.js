/* NECO ENVÍOS - Parte 3: activar notificaciones push en el navegador/app.
   PEGÁ ACÁ TU CLAVE PÚBLICA VAPID (la pública es segura de exponer). */
(function () {
  const VAPID_PUBLIC = 'BDTw7eeBhWjhfaVOVT8Zatjjp_VfFxFRUllzvXdznFpyyuNkUhDarQ018xPxP6sE-fJHFBkvFAUTaBDxWmFGGxw';
  const configurado = VAPID_PUBLIC.length > 60;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const soportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!configurado) return;
  if (!soportado && !(ios && !standalone)) return;

  const b = document.createElement('button');
  b.id = 'btn-push'; b.type = 'button'; b.title = 'Activar avisos';
  b.className = 'bg-brand-50 border border-brand-200 text-brand-600 p-2 rounded-xl active:scale-95 shadow-sm flex items-center';
  b.innerHTML = '<i data-lucide="bell" class="w-4 h-4"></i>';
  const g = $('btn-google'); g.parentNode.insertBefore(b, g);
  ico();

  const key = () => { let s = VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };

  async function guardar(sub) {
    await asegurarSesion();
    const j = sub.toJSON();
    const { error } = await _sb.rpc('ne_guardar_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    if (error) throw error;
  }
  async function activar() {
    if (!soportado) { mostrarToast('En iPhone primero instalá la app: Compartir → Agregar a pantalla de inicio. Después activá los avisos desde la app.'); return; }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { mostrarToast('Los avisos quedaron bloqueados. Podés activarlos en los ajustes del navegador.'); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
      await guardar(sub);
      b.classList.add('hidden'); mostrarToast('¡Avisos activados!');
    } catch (e) { mostrarToast('No se pudieron activar los avisos: ' + (e.message || e)); }
  }
  b.onclick = activar;

  // Si ya había permiso, vuelve a registrar la suscripción con el usuario actual (por si cambió de cuenta)
  async function revisar() {
    if (!soportado) return;
    if (Notification.permission === 'granted') {
      b.classList.add('hidden');
      try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await guardar(sub); } catch (e) {}
    }
  }
  _sb.auth.onAuthStateChange((ev, s) => { if (s && (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) setTimeout(revisar, 800); });
})();
