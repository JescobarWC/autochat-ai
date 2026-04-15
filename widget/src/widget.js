/**
 * AutoChat AI — Widget Embebible
 * Se instala con: <script src="widget.min.js" data-tenant="TENANT_ID" data-api="https://api.url/v1"></script>
 * Shadow DOM para aislamiento CSS, SSE streaming, vehicle cards con CSS Scroll Snap.
 */
(function () {
  "use strict";

  // Leer atributos del script tag
  const scriptTag = document.currentScript;
  const TENANT_ID = scriptTag?.getAttribute("data-tenant") || "";
  const API_BASE = (scriptTag?.getAttribute("data-api") || "https://chat.eaistudio.es/api/v1").replace(/\/$/, "");

  if (!TENANT_ID) {
    console.error("[AutoChat] data-tenant es obligatorio");
    return;
  }

  // Session ID persistente entre recargas y navegación
  function genUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  const SESSION_KEY = "autochat_session_" + TENANT_ID;
  let SESSION_ID = localStorage.getItem(SESSION_KEY) || "sess_" + genUUID();

  // Capturar UTM params al cargar (se guardan por si el usuario navega y pierde los query params)
  const UTM_KEY = "autochat_utm_" + TENANT_ID;
  function captureUtms() {
    const params = new URLSearchParams(window.location.search);
    const utms = {};
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"].forEach(k => {
      const v = params.get(k);
      if (v) utms[k] = v;
    });
    if (Object.keys(utms).length > 0) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(utms));
    }
    return JSON.parse(sessionStorage.getItem(UTM_KEY) || "{}");
  }
  const UTM_DATA = captureUtms();
  localStorage.setItem(SESSION_KEY, SESSION_ID);

  // Estado
  let isOpen = false;
  let isLoading = false;
  let widgetConfig = {};
  let messages = []; // { role, content, type?, vehicles?, timestamp }

  // === Detección de contexto de página ===
  function detectPageContext() {
    const url = window.location.href;
    const pathname = window.location.pathname;
    const ctx = { page_type: "other", page_url: url };

    // Patrón worldcars: /comprar-coches-ocasion/:brand/:model/:id
    const vehicleMatch = pathname.match(/\/comprar-coches-ocasion\/([^\/]+)\/([^\/]+)\/(\d+)/);
    if (vehicleMatch) {
      ctx.page_type = "vehicle_detail";
      ctx.vehicle_brand = vehicleMatch[1];
      ctx.vehicle_model = vehicleMatch[2];
      ctx.vehicle_id = vehicleMatch[3];
      return ctx;
    }

    if (pathname.includes("/comprar-coches-ocasion")) ctx.page_type = "listing";
    else if (pathname.includes("/financiacion")) ctx.page_type = "financing";
    else if (pathname.includes("/contacto")) ctx.page_type = "contact";
    else if (pathname === "/" || pathname === "") ctx.page_type = "home";

    // Fallback: meta tags o data attributes
    const vid = document.querySelector("[data-vehicle-id]");
    if (vid) {
      ctx.page_type = "vehicle_detail";
      ctx.vehicle_id = vid.getAttribute("data-vehicle-id");
      ctx.vehicle_brand = vid.getAttribute("data-vehicle-brand") || "";
      ctx.vehicle_model = vid.getAttribute("data-vehicle-model") || "";
    }

    if (Object.keys(UTM_DATA).length > 0) ctx.utm = UTM_DATA;
    ctx.referrer = document.referrer || "";
    return ctx;
  }

  // === Crear contenedor Shadow DOM ===
  const host = document.createElement("div");
  host.id = "autochat-widget-host";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });

  // === Cargar Nunito en el documento principal (necesario: Shadow DOM no carga @import) ===
  if (!document.getElementById("autochat-nunito-font")) {
    const fontLink = document.createElement("link");
    fontLink.id = "autochat-nunito-font";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(fontLink);
  }

  // === Estilos ===
  const style = document.createElement("style");
  style.textContent = `

    :host {
      --ac-primary: #1E40AF;
      --ac-accent: #10B981;
      --ac-bg: #ffffff;
      --ac-bg-secondary: #f3f4f6;
      --ac-text: #1f2937;
      --ac-text-secondary: #6b7280;
      --ac-border: #e5e7eb;
      --ac-radius: 20px;
      --ac-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
      font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    /* Botón flotante */
    .ac-fab-wrapper {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
    }
    .ac-fab-ring {
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      background: var(--ac-primary);
      opacity: 0.2;
      animation: acPulse 2.4s ease-out infinite;
    }
    .ac-fab-ring2 {
      position: absolute;
      inset: -12px;
      border-radius: 50%;
      background: var(--ac-primary);
      opacity: 0.1;
      animation: acPulse 2.4s ease-out 0.6s infinite;
    }
    @keyframes acPulse {
      0% { transform: scale(0.9); opacity: 0.25; }
      60% { transform: scale(1.25); opacity: 0; }
      100% { transform: scale(1.25); opacity: 0; }
    }
    .ac-fab-wrapper.open .ac-fab-ring,
    .ac-fab-wrapper.open .ac-fab-ring2 { display: none; }

    .ac-fab {
      position: relative;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: var(--ac-primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
    }
    .ac-fab:hover { transform: scale(1.1); box-shadow: 0 8px 28px rgba(0,0,0,0.3); }
    .ac-fab svg { width: 26px; height: 26px; fill: white; transition: transform 0.3s; }
    .ac-fab-wrapper.open svg.chat-icon { display: none; }
    .ac-fab-wrapper:not(.open) svg.close-icon { display: none; }

    /* Ventana de chat */
    .ac-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 560px;
      background: var(--ac-bg);
      border-radius: var(--ac-radius);
      box-shadow: var(--ac-shadow);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999998;
      border: 1px solid rgba(0,0,0,0.06);
      transform-origin: bottom right;
    }
    .ac-window.open {
      display: flex;
      animation: acSlideIn 0.3s cubic-bezier(.34,1.56,.64,1);
    }

    @keyframes acSlideIn {
      from { opacity: 0; transform: scale(0.88) translateY(12px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Header */
    .ac-header {
      background: linear-gradient(135deg, var(--ac-primary) 0%, color-mix(in srgb, var(--ac-primary) 80%, #000) 100%);
      color: white;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .ac-header-avatar {
      width: 62px;
      height: 62px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      border: 3px solid rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    }
    .ac-header-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
    .ac-header-info { flex: 1; }
    .ac-header-info h3 { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
    .ac-header-status {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }
    .ac-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 0 2px rgba(74,222,128,0.3);
      animation: acStatusPulse 2s infinite;
    }
    @keyframes acStatusPulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(74,222,128,0.3); }
      50% { box-shadow: 0 0 0 4px rgba(74,222,128,0.15); }
    }
    .ac-header-status span { font-size: 11.5px; opacity: 0.9; font-weight: 500; }
    .ac-header-close {
      background: rgba(255,255,255,0.15);
      border: none;
      cursor: pointer;
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .ac-header-close:hover { background: rgba(255,255,255,0.25); }
    .ac-header-close svg { width: 16px; height: 16px; fill: white; }

    /* Mensajes */
    .ac-messages {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
      background: #f8f9fb;
    }
    .ac-messages::-webkit-scrollbar { width: 4px; }
    .ac-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

    /* Bot message row (avatar + bubble) */
    .ac-msg-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      align-self: flex-start;
      max-width: 88%;
    }
    .ac-msg-row.user-row {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    .ac-msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--ac-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .ac-msg-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .ac-msg-avatar svg { width: 14px; height: 14px; fill: white; }

    .ac-msg {
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.55;
      word-wrap: break-word;
      overflow-wrap: break-word;
      min-width: 0;
    }
    .ac-msg.bot {
      background: #ffffff;
      color: var(--ac-text);
      border-bottom-left-radius: 5px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04);
    }
    .ac-msg.bot img {
      max-width: 100%;
      width: 100%;
      border-radius: 10px;
      display: block;
      margin-top: 6px;
    }
    .ac-msg.bot a { color: var(--ac-primary); text-decoration: underline; word-break: break-all; }
    .ac-msg-link-btn {
      display: inline-block;
      margin-top: 8px;
      padding: 8px 16px;
      background: var(--ac-primary);
      color: white !important;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none !important;
      transition: opacity 0.2s, transform 0.15s;
    }
    .ac-msg-link-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .ac-msg.user {
      background: var(--ac-primary);
      color: white;
      border-bottom-right-radius: 5px;
      box-shadow: 0 2px 10px rgba(30,64,175,0.3);
      white-space: pre-wrap;
    }

    /* Quick replies */
    .ac-quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 4px 0 4px 36px;
      align-self: flex-start;
    }
    .ac-quick-btn {
      padding: 7px 14px;
      border-radius: 20px;
      border: 1.5px solid var(--ac-primary);
      background: transparent;
      color: var(--ac-primary);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.18s, color 0.18s, transform 0.15s;
      white-space: nowrap;
    }
    .ac-quick-btn:hover {
      background: var(--ac-primary);
      color: white;
      transform: translateY(-1px);
    }

    /* Typing indicator */
    .ac-typing-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      align-self: flex-start;
    }
    .ac-typing {
      display: flex;
      gap: 5px;
      padding: 12px 16px;
      background: #ffffff;
      border-radius: 18px;
      border-bottom-left-radius: 5px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    }
    .ac-typing span {
      width: 7px; height: 7px;
      background: #9ca3af;
      border-radius: 50%;
      animation: acBounce 1.2s infinite;
    }
    .ac-typing span:nth-child(2) { animation-delay: 0.18s; }
    .ac-typing span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes acBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* Tool status */
    .ac-tool-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: #eff6ff;
      border-radius: 12px;
      font-size: 12.5px;
      color: var(--ac-primary);
      align-self: flex-start;
      border: 1px solid rgba(30,64,175,0.12);
      font-weight: 500;
    }
    .ac-spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(30,64,175,0.2);
      border-top-color: var(--ac-primary);
      border-radius: 50%;
      animation: acSpin 0.8s linear infinite;
      flex-shrink: 0;
    }
    @keyframes acSpin { to { transform: rotate(360deg); } }

    /* Vehicle cards — vertical stack, full width */
    .ac-carousel {
      align-self: flex-start;
      width: 100%;
      position: relative;
    }
    .ac-carousel-track {
      overflow: hidden;
      border-radius: 16px 16px 0 0;
      position: relative;
    }
    .ac-carousel-inner {
      display: flex;
      transition: transform 0.3s ease;
    }
    .ac-carousel-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.92);
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      transition: background 0.15s, transform 0.15s;
    }
    .ac-carousel-btn:hover { background: white; transform: translateY(-50%) scale(1.08); }
    .ac-carousel-btn:disabled { opacity: 0.25; cursor: default; }
    .ac-carousel-btn.prev { left: 8px; }
    .ac-carousel-btn.next { right: 8px; }
    .ac-carousel-btn svg { width: 16px; height: 16px; fill: #1e293b; }
    .ac-carousel-counter {
      text-align: center;
      font-size: 11px;
      color: var(--ac-text-secondary);
      font-weight: 600;
      padding: 5px 0 2px;
      background: var(--ac-bg);
    }

    .ac-card {
      min-width: 100%;
      background: var(--ac-bg);
      overflow: hidden;
    }
    .ac-card-wrap {
      border: 1px solid var(--ac-border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .ac-card img {
      width: 100%;
      height: 160px;
      object-fit: cover;
      background: #e5e7eb;
      display: block;
    }
    .ac-card-body { padding: 12px 14px 14px; }
    .ac-card-title {
      font-weight: 700;
      font-size: 13.5px;
      color: var(--ac-text);
      margin-bottom: 8px;
      line-height: 1.35;
    }
    .ac-card-price {
      font-size: 22px;
      font-weight: 800;
      color: var(--ac-primary);
      text-align: center;
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }
    .ac-card-finance {
      font-size: 12px;
      color: var(--ac-text-secondary);
      margin-bottom: 2px;
      text-align: center;
    }
    .ac-card-finance strong { color: var(--ac-text); font-weight: 700; }
    .ac-card-specs {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      margin-bottom: 12px;
      justify-content: space-between;
    }
    .ac-card-spec-tag {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: 10px;
      padding: 5px 4px;
      border-radius: 8px;
      background: var(--ac-bg-secondary);
      color: var(--ac-text-secondary);
      font-weight: 500;
      text-align: center;
      line-height: 1.2;
    }
    .ac-card-spec-label {
      font-size: 9px;
      color: var(--ac-text-secondary);
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .ac-card-spec-val { font-weight: 700; color: var(--ac-text); font-size: 11px; }
    .ac-card-actions {
      display: flex;
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--ac-border);
    }
    .ac-card-btn {
      flex: 1;
      padding: 9px 10px;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      text-align: center;
      text-decoration: none;
      display: block;
      transition: opacity 0.2s, transform 0.15s;
    }
    .ac-card-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .ac-card-btn.primary {
      background: var(--ac-primary);
      color: white;
    }
    .ac-card-btn.secondary {
      background: var(--ac-bg-secondary);
      color: var(--ac-text);
      border: 1px solid var(--ac-border);
    }

    /* Lead captured banner */
    .ac-lead-banner {
      padding: 10px 14px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 12px;
      color: #065f46;
      font-size: 13px;
      font-weight: 500;
      align-self: flex-start;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Input area */
    .ac-input-area {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid var(--ac-border);
      background: var(--ac-bg);
      flex-shrink: 0;
    }
    .ac-input {
      flex: 1;
      border: 1.5px solid var(--ac-border);
      border-radius: 22px;
      padding: 10px 16px;
      font-size: 16px;
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #f8f9fb;
      color: var(--ac-text);
    }
    .ac-input:focus {
      border-color: var(--ac-primary);
      background: white;
      box-shadow: 0 0 0 3px rgba(30,64,175,0.08);
    }
    .ac-input::placeholder { color: #adb5c0; }

    .ac-send {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--ac-primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s, transform 0.15s;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(30,64,175,0.3);
    }
    .ac-send:hover { transform: scale(1.08); }
    .ac-send:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .ac-send svg { width: 17px; height: 17px; fill: white; }

    /* Powered by */
    .ac-powered {
      text-align: center;
      padding: 5px;
      font-size: 10.5px;
      color: #b0b8c4;
      background: var(--ac-bg);
    }
    .ac-powered a { color: var(--ac-primary); text-decoration: none; }

    /* Mobile responsive */
    @media (max-width: 480px) {
      .ac-window {
        bottom: 0;
        right: 0;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        height: 100dvh;
        max-height: 100%;
        border-radius: 0;
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .ac-messages {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      .ac-input-area {
        flex-shrink: 0;
        padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
      }
      .ac-input {
        font-size: 16px;
      }
      .ac-fab-wrapper { bottom: 80px; right: 18px; }
      .ac-fab-wrapper.open { display: none; }
    }

    /* Proactive popup */

    /* Cart */
    .ac-cart-badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: white; font-size: 10px; font-weight: 700;
      min-width: 18px; height: 18px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      padding: 0 4px; line-height: 1;
    }
    .ac-cart-btn-header {
      position: relative; background: none; border: none; cursor: pointer;
      color: white; opacity: 0.8; transition: opacity 0.2s;
    }
    .ac-cart-btn-header:hover { opacity: 1; }
    .ac-cart-btn-header svg { width: 22px; height: 22px; fill: currentColor; }
    .ac-cart-panel {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--ac-bg); z-index: 10; display: none;
      flex-direction: column;
    }
    .ac-cart-panel.open { display: flex; }
    .ac-cart-header {
      padding: 14px 16px; border-bottom: 1px solid var(--ac-border);
      display: flex; align-items: center; justify-content: space-between;
      font-weight: 700; font-size: 15px;
    }
    .ac-cart-header button { background: none; border: none; cursor: pointer; color: var(--ac-text-secondary); font-size: 20px; }
    .ac-cart-items {
      flex: 1; overflow-y: auto; padding: 12px;
    }
    .ac-cart-item {
      display: flex; gap: 10px; padding: 10px; margin-bottom: 8px;
      background: var(--ac-bg-secondary); border-radius: 10px; align-items: center;
    }
    .ac-cart-item img { width: 50px; height: 50px; object-fit: cover; border-radius: 8px; }
    .ac-cart-item-info { flex: 1; min-width: 0; }
    .ac-cart-item-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ac-cart-item-price { font-size: 12px; color: var(--ac-primary); font-weight: 700; }
    .ac-cart-item-qty {
      display: flex; align-items: center; gap: 6px; font-size: 13px;
    }
    .ac-cart-item-qty button {
      width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--ac-border);
      background: var(--ac-bg); cursor: pointer; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; color: var(--ac-text);
    }
    .ac-cart-footer {
      padding: 14px 16px; border-top: 1px solid var(--ac-border);
    }
    .ac-cart-total {
      display: flex; justify-content: space-between; font-weight: 700; font-size: 15px; margin-bottom: 10px;
    }
    .ac-cart-checkout {
      width: 100%; padding: 12px; background: var(--ac-primary); color: white;
      border: none; border-radius: 10px; font-weight: 700; font-size: 14px;
      cursor: pointer; transition: opacity 0.2s;
    }
    .ac-cart-checkout:hover { opacity: 0.9; }
    .ac-cart-empty { text-align: center; padding: 40px 20px; color: var(--ac-text-secondary); font-size: 13px; }
    .ac-card-btn.cart-btn {
      background: var(--ac-accent, #10b981); color: white; border: none;
      font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .ac-card-btn.cart-btn:hover { opacity: 0.85; }

    .ac-proactive {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 270px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      padding: 44px 18px 18px;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      animation: ac-pop-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
      z-index: 9999;
      overflow: visible;
    }
    .ac-proactive-avatar {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      overflow: hidden;
      border: 3px solid #fff;
      background: var(--ac-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: absolute;
      top: -34px;
      left: 50%;
      transform: translateX(-50%);
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    }
    .ac-proactive-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ac-proactive.visible { display: flex; }
    .ac-proactive-close {
      position: absolute;
      top: 8px; right: 10px;
      background: none; border: none;
      font-size: 16px; cursor: pointer; color: #9ca3af; line-height: 1;
    }
    .ac-proactive-msg {
      font-size: 14px; font-weight: 600; color: #1f2937;
      padding-right: 16px; line-height: 1.4;
    }
    .ac-proactive-btn {
      background: var(--ac-primary);
      color: #fff; border: none; border-radius: 8px;
      padding: 9px 12px; font-size: 13px; font-weight: 600;
      cursor: pointer; text-align: center;
      transition: opacity 0.2s;
    }
    .ac-proactive-btn:hover { opacity: 0.85; }
    @keyframes ac-pop-in {
      from { opacity: 0; transform: scale(0.8) translateY(10px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
  `;
  shadow.appendChild(style);

  // === HTML del widget ===
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="ac-fab-wrapper" aria-label="Chat">
      <div class="ac-proactive" id="ac-proactive">
        <button class="ac-proactive-close" id="ac-proactive-close">✕</button>
        <div class="ac-proactive-avatar" id="ac-proactive-avatar">
          <svg viewBox="0 0 24 24" style="width:26px;height:26px;fill:white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
        </div>
        <div class="ac-proactive-msg" id="ac-proactive-msg" style="text-align:center"></div>
      </div>
      <div class="ac-fab-ring"></div>
      <div class="ac-fab-ring2"></div>
      <button class="ac-fab" aria-label="Abrir chat">
        <svg class="chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
        <svg class="close-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
      </button>
    </div>
    <div class="ac-window">
      <div class="ac-header">
        <div class="ac-header-avatar">
          <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
        </div>
        <div class="ac-header-info">
          <h3 class="ac-bot-name">Asistente</h3>
          <div class="ac-header-status">
            <div class="ac-status-dot"></div>
            <span>En línea ahora</span>
          </div>
        </div>
        <button class="ac-header-close" aria-label="Minimizar chat">
          <svg viewBox="0 0 24 24"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
        </button>
      </div>
      <div class="ac-messages"></div>
      <div class="ac-input-area">
        <input class="ac-input" type="text" placeholder="Escribe tu mensaje..." />
        <button class="ac-send" aria-label="Enviar">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="ac-powered" style="display:none">Powered by <a href="#">AutoChat AI</a></div>
    </div>
  `;
  shadow.appendChild(container);

  // Referencias DOM
  const fabWrapper = shadow.querySelector(".ac-fab-wrapper");
  const fab = shadow.querySelector(".ac-fab");
  const win = shadow.querySelector(".ac-window");
  const messagesEl = shadow.querySelector(".ac-messages");
  const input = shadow.querySelector(".ac-input");
  const sendBtn = shadow.querySelector(".ac-send");
  const botNameEl = shadow.querySelector(".ac-bot-name");
  const poweredEl = shadow.querySelector(".ac-powered");
  const headerClose = shadow.querySelector(".ac-header-close");

  // === Funciones de renderizado ===
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function makeBotAvatar() {
    const av = document.createElement("div");
    av.className = "ac-msg-avatar";
    if (widgetConfig.avatar_url) {
      av.innerHTML = `<img src="${widgetConfig.avatar_url}" alt="bot" />`;
    } else {
      av.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zm-9-6c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm6 0c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13zm-3 3c-1.29 0-2.42-.69-3.03-1.71l1.06-.8c.34.78 1.11 1.31 1.97 1.31s1.63-.53 1.97-1.31l1.06.8C13.42 15.31 12.29 16 11 16z"/></svg>`;
    }
    return av;
  }

  function renderBotContent(text) {
    // Escapar HTML para evitar XSS
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped
      // Imágenes markdown: ![alt](url)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
        '<img src="$2" alt="$1" onerror="this.style.display=\'none\'" />')
      // Negrita: **texto**
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      // Links: [texto](url) → botón
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a class="ac-msg-link-btn" href="$2" target="_blank" rel="noopener">$1</a>')
      // Saltos de línea → <br>
      .replace(/\n/g, "<br>");
  }

  function addMessage(role, content) {
    if (role === "bot") {
      const row = document.createElement("div");
      row.className = "ac-msg-row";
      const av = makeBotAvatar();
      const bubble = document.createElement("div");
      bubble.className = "ac-msg bot";
      bubble.innerHTML = renderBotContent(content);
      row.appendChild(av);
      row.appendChild(bubble);
      messagesEl.appendChild(row);
      scrollToBottom();
      return bubble; // return bubble so streaming can update textContent
    } else {
      const row = document.createElement("div");
      row.className = "ac-msg-row user-row";
      const bubble = document.createElement("div");
      bubble.className = "ac-msg user";
      bubble.textContent = content;
      row.appendChild(bubble);
      messagesEl.appendChild(row);
      scrollToBottom();
      return bubble;
    }
  }

  function addQuickReplies(replies) {
    const existing = shadow.getElementById("ac-quick-replies");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.className = "ac-quick-replies";
    wrap.id = "ac-quick-replies";
    replies.forEach(label => {
      const btn = document.createElement("button");
      btn.className = "ac-quick-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        wrap.remove();
        input.value = label;
        sendMessage();
      });
      wrap.appendChild(btn);
    });
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const row = document.createElement("div");
    row.className = "ac-typing-row";
    row.id = "ac-typing";
    const av = makeBotAvatar();
    const dots = document.createElement("div");
    dots.className = "ac-typing";
    dots.innerHTML = "<span></span><span></span><span></span>";
    row.appendChild(av);
    row.appendChild(dots);
    messagesEl.appendChild(row);
    scrollToBottom();
    return row;
  }

  function removeTypingIndicator() {
    const el = shadow.getElementById("ac-typing");
    if (el) el.remove();
  }

  function addToolStatus(message) {
    const div = document.createElement("div");
    div.className = "ac-tool-status";
    div.id = "ac-tool-status";
    div.innerHTML = `<div class="ac-spinner"></div><span>${message}</span>`;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function removeToolStatus() {
    const el = shadow.getElementById("ac-tool-status");
    if (el) el.remove();
  }

  function addVehicleCards(vehicles) {
    if (!vehicles || vehicles.length === 0) return;

    const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='155' viewBox='0 0 400 155'%3E%3Crect fill='%23f3f4f6' width='400' height='155'/%3E%3Cpath fill='%23d1d5db' d='M280 80H120l15-30h130zm-155 20a15 15 0 1 0 30 0 15 15 0 0 0-30 0zm120 0a15 15 0 1 0 30 0 15 15 0 0 0-30 0z'/%3E%3C/svg%3E`;

    // Contenedor del carrusel
    const carousel = document.createElement("div");
    carousel.className = "ac-carousel";

    const track = document.createElement("div");
    track.className = "ac-carousel-track";
    const inner = document.createElement("div");
    inner.className = "ac-carousel-inner";

    vehicles.forEach((v) => {
      const card = document.createElement("div");
      card.className = "ac-card";
      const monthlyFee = v.monthly_fee_formatted || (v.monthly_fee ? `${v.monthly_fee} €/mes` : null);
      const financedPrice = v.financed_price_formatted || (v.financed_price ? `${v.financed_price.toLocaleString("es-ES")} €` : null);
      const imgSrc = v.image_url && v.image_url.startsWith("http") ? v.image_url : PLACEHOLDER;

      const specs = [
        v.interest_type || v.body_type ? { label: "Tipología", val: v.interest_type || v.body_type || "Ocasión" } : null,
        v.year ? { label: "Año", val: v.year } : null,
        v.fuel ? { label: "Combustible", val: v.fuel } : null,
        v.km ? { label: "Kilómetros", val: v.km.toLocaleString("es-ES") + " km" } : null,
        v.transmission ? { label: "Cambio", val: v.transmission } : null,
      ].filter(Boolean).slice(0, 3);

      card.innerHTML = `
        <div class="ac-card-wrap">
          <img src="${imgSrc}" alt="${v.brand} ${v.model}" loading="lazy" onerror="this.src='${PLACEHOLDER}'" />
          <div class="ac-card-body">
            <div class="ac-card-title">${v.brand} ${v.model}</div>
            <div class="ac-card-price">${v.price_formatted}</div>
            ${monthlyFee ? `<div class="ac-card-finance">Desde: <strong>${monthlyFee}</strong></div>` : ""}
            ${financedPrice ? `<div class="ac-card-finance">FINANCIADO: ${financedPrice}</div>` : ""}
            <div class="ac-card-specs">
              ${specs.map(s => `<span class="ac-card-spec-tag"><span class="ac-card-spec-label">${s.label}</span><span class="ac-card-spec-val">${s.val}</span></span>`).join("")}
            </div>
            <div class="ac-card-actions">
              <button class="ac-card-btn primary ac-interest-btn" data-id="${v.id}" data-name="${v.brand} ${v.model}">Me interesa</button>
              ${widgetConfig.enable_cart ? `<button class="ac-card-btn cart-btn" data-cart-id="${v.id}" data-cart-name="${(v.title||v.brand+' '+v.model).replace(/"/g,'')}" data-cart-price="${v.price}" data-cart-pricefmt="${v.price_formatted}" data-cart-img="${v.image_url||''}">A\u00f1adir</button>` : ""}
              <a class="ac-card-btn secondary" href="${v.detail_url}" target="_blank">Ver ficha</a>
            </div>
          </div>
        </div>
      `;
      inner.appendChild(card);
    });

    track.appendChild(inner);
    carousel.appendChild(track);

    // Navegación (solo si hay más de 1 card)
    let current = 0;
    const total = vehicles.length;

    if (total > 1) {
      const btnPrev = document.createElement("button");
      btnPrev.className = "ac-carousel-btn prev";
      btnPrev.disabled = true;
      btnPrev.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`;

      const btnNext = document.createElement("button");
      btnNext.className = "ac-carousel-btn next";
      btnNext.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`;

      const counter = document.createElement("div");
      counter.className = "ac-carousel-counter";
      counter.textContent = `1 / ${total}`;

      track.appendChild(btnPrev);
      track.appendChild(btnNext);
      carousel.appendChild(counter);

      function goTo(idx) {
        current = idx;
        inner.style.transform = `translateX(-${current * 100}%)`;
        counter.textContent = `${current + 1} / ${total}`;
        btnPrev.disabled = current === 0;
        btnNext.disabled = current === total - 1;
      }

      btnPrev.addEventListener("click", () => goTo(current - 1));
      btnNext.addEventListener("click", () => goTo(current + 1));
    }

    messagesEl.appendChild(carousel);
    scrollToBottom();

    // Botones "Me interesa"
    carousel.querySelectorAll(".ac-interest-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-name");
        input.value = `Me interesa el ${name}`;
        sendMessage();
      });
    });

    // Botones "A\u00f1adir al carrito"
    carousel.querySelectorAll(".cart-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const product = {
          id: btn.dataset.cartId,
          name: btn.dataset.cartName,
          price: parseFloat(btn.dataset.cartPrice) || 0,
          price_fmt: btn.dataset.cartPricefmt,
          image: btn.dataset.cartImg
        };
        addToCart(product);
        btn.textContent = "\u2713 A\u00f1adido";
        btn.style.background = "#059669";
        btn.style.color = "white";
        setTimeout(() => {
          btn.textContent = "A\u00f1adir";
          btn.style.background = "";
          btn.style.color = "";
        }, 1500);
      });
    });
  }

  function addLeadBanner(message) {
    const div = document.createElement("div");
    div.className = "ac-lead-banner";
    div.innerHTML = `<span>✅</span><span>${message}</span>`;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function applyConfig(config) {
    widgetConfig = config;
    if (config.primary_color) {
      style.textContent = style.textContent.replace(
        /--ac-primary:\s*[^;]+/,
        `--ac-primary: ${config.primary_color}`
      );
    }
    if (config.accent_color) {
      style.textContent = style.textContent.replace(
        /--ac-accent:\s*[^;]+/,
        `--ac-accent: ${config.accent_color}`
      );
    }
    if (config.bot_name) botNameEl.textContent = config.bot_name;
    if (config.show_powered_by) poweredEl.style.display = "block";
    // Avatar en header
    if (config.avatar_url) {
      const headerAvEl = shadow.querySelector(".ac-header-avatar");
      headerAvEl.textContent = "";
      const img = document.createElement("img");
      img.src = config.avatar_url;
      img.alt = "bot";
      headerAvEl.appendChild(img);
    }
    // Cart: add cart button to header if enabled
    if (config.enable_cart) {
      const headerEl = shadow.querySelector(".ac-header");
      if (headerEl && !shadow.getElementById("ac-cart-btn-header")) {
        const cartBtn = document.createElement("button");
        cartBtn.className = "ac-cart-btn-header";
        cartBtn.id = "ac-cart-btn-header";
        cartBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg><span class="ac-cart-badge" id="ac-cart-badge" style="display:none">0</span>';
        cartBtn.style.marginLeft = "auto";
        headerEl.appendChild(cartBtn);
        cartBtn.addEventListener("click", (e) => { e.stopPropagation(); openCart(); });

        // Add cart panel to window
        const win = shadow.querySelector(".ac-window");
        if (win && !shadow.getElementById("ac-cart-panel")) {
          const panel = document.createElement("div");
          panel.className = "ac-cart-panel";
          panel.id = "ac-cart-panel";
          panel.innerHTML = `
            <div class="ac-cart-header"><span>Carrito</span><button id="ac-cart-close">\u2715</button></div>
            <div class="ac-cart-items" id="ac-cart-items"></div>
            <div class="ac-cart-footer">
              <div class="ac-cart-total"><span>Total</span><span id="ac-cart-total">0 \u20ac</span></div>
              <button class="ac-cart-checkout" id="ac-cart-checkout">Hacer pedido</button>
            </div>
          `;
          win.appendChild(panel);
          panel.querySelector("#ac-cart-close").addEventListener("click", closeCart);
          panel.querySelector("#ac-cart-checkout").addEventListener("click", () => {
            if (acCart.length === 0) return;
            const checkoutUrl = widgetConfig.checkout_url || "";
            if (checkoutUrl) {
              // External checkout: open store with first product, then redirect to checkout
              const addPattern = widgetConfig.checkout_add_pattern || "";
              if (addPattern && acCart.length > 0) {
                // Open new tab adding first product
                const firstUrl = addPattern.replace("{id}", acCart[0].id).replace("{qty}", acCart[0].qty);
                const newTab = window.open(firstUrl, "_blank");
                // Add remaining products and finish at checkout
                if (newTab && acCart.length > 1) {
                  let idx = 1;
                  const addNext = () => {
                    if (idx < acCart.length) {
                      const url = addPattern.replace("{id}", acCart[idx].id).replace("{qty}", acCart[idx].qty);
                      try { newTab.location.href = url; } catch(e) {}
                      idx++;
                      setTimeout(addNext, 1200);
                    } else {
                      setTimeout(() => { try { newTab.location.href = checkoutUrl; } catch(e) {} }, 1200);
                    }
                  };
                  setTimeout(addNext, 1500);
                } else if (newTab) {
                  setTimeout(() => { try { newTab.location.href = checkoutUrl; } catch(e) {} }, 1500);
                }
              } else {
                window.open(checkoutUrl, "_blank");
              }
              // Clear cart
              acCart = [];
              saveCart();
              closeCart();
              renderCartPanel();
            } else {
              // No external checkout: send as chat message
              const items = acCart.map(i => i.name + " x" + i.qty + " (" + i.price_fmt + ")").join(", ");
              closeCart();
              input.value = "Quiero hacer un pedido: " + items;
              sendMessage();
            }
          });
          updateCartBadge();
        }
      }
    }

    // Posición: bottom-left o bottom-right
    if (config.position === "bottom-left") {
      const fab = shadow.querySelector(".ac-fab-wrapper");
      const win = shadow.querySelector(".ac-window");
      const pro = shadow.getElementById("ac-proactive");
      fab.style.right = "auto"; fab.style.left = "24px";
      win.style.right = "auto"; win.style.left = "24px";
      win.style.transformOrigin = "bottom left";
      if (pro) { pro.style.right = "auto"; pro.style.left = "90px"; }
    }
  }


    // === Cart ===
    let acCart = JSON.parse(localStorage.getItem("ac_cart_" + TENANT_ID) || "[]");

    function saveCart() { localStorage.setItem("ac_cart_" + TENANT_ID, JSON.stringify(acCart)); updateCartBadge(); }
    
    function updateCartBadge() {
      const badge = shadow.getElementById("ac-cart-badge");
      const total = acCart.reduce((s, i) => s + i.qty, 0);
      if (badge) { badge.textContent = total; badge.style.display = total > 0 ? "flex" : "none"; }
    }

    function addToCart(product) {
      const existing = acCart.find(i => i.id === product.id);
      if (existing) { existing.qty++; } else { acCart.push({ ...product, qty: 1 }); }
      saveCart();
    }

    function renderCartPanel() {
      const panel = shadow.getElementById("ac-cart-panel");
      const items = shadow.getElementById("ac-cart-items");
      const total = shadow.getElementById("ac-cart-total");
      if (!items) return;
      if (acCart.length === 0) {
        items.innerHTML = '<div class="ac-cart-empty">El carrito est\u00e1 vac\u00edo</div>';
        total.textContent = "0 \u20ac";
        return;
      }
      items.innerHTML = acCart.map((item, idx) => `
        <div class="ac-cart-item">
          <img src="${item.image || ""}" alt="" onerror="this.style.display='none'" />
          <div class="ac-cart-item-info">
            <div class="ac-cart-item-name">${item.name}</div>
            <div class="ac-cart-item-price">${item.price_fmt}</div>
          </div>
          <div class="ac-cart-item-qty">
            <button data-cart-minus="${idx}">\u2212</button>
            <span>${item.qty}</span>
            <button data-cart-plus="${idx}">+</button>
          </div>
        </div>
      `).join("");
      items.querySelectorAll("[data-cart-minus]").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = parseInt(btn.dataset.cartMinus);
          acCart[i].qty--; if (acCart[i].qty <= 0) acCart.splice(i, 1);
          saveCart(); renderCartPanel();
        });
      });
      items.querySelectorAll("[data-cart-plus]").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = parseInt(btn.dataset.cartPlus);
          acCart[i].qty++; saveCart(); renderCartPanel();
        });
      });
      const sum = acCart.reduce((s, i) => s + (i.price * i.qty), 0);
      total.textContent = sum.toFixed(2).replace(".", ",") + " \u20ac";
    }

    function openCart() {
      const panel = shadow.getElementById("ac-cart-panel");
      if (panel) { panel.classList.add("open"); renderCartPanel(); }
    }
    function closeCart() {
      const panel = shadow.getElementById("ac-cart-panel");
      if (panel) panel.classList.remove("open");
    }

  // === API ===
  async function initSession() {
    try {
      const res = await fetch(`${API_BASE}/chat/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": TENANT_ID,
        },
        body: JSON.stringify({
          session_id: SESSION_ID,
          page_context: detectPageContext(),
        }),
      });

      if (!res.ok) throw new Error(`Init failed: ${res.status}`);
      const data = await res.json();

      if (data.widget_config) applyConfig(data.widget_config);

      // Restaurar historial
      if (data.history && data.history.length > 0) {
        data.history.forEach((msg) => addMessage(msg.role === "user" ? "user" : "bot", msg.content));
      } else {
        const welcome = widgetConfig.welcome_message || "¡Hola! 👋 ¿En qué puedo ayudarte hoy?";
        addMessage("bot", welcome);
        // Quick replies de bienvenida
        const quickReplies = widgetConfig.quick_replies || ["Información", "Contactar"];
        addQuickReplies(quickReplies);
      }
    } catch (err) {
      console.error("[AutoChat] Error inicializando:", err);
      addMessage("bot", "¡Hola! 👋 ¿En qué puedo ayudarte hoy?");
      addQuickReplies(["Información", "Contactar"]);
    }
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    isLoading = true;
    input.value = "";
    sendBtn.disabled = true;

    addMessage("user", text);
    const typingEl = addTypingIndicator();

    let currentBotMsg = null;
    let botContent = "";
    let displayedLength = 0;
    let typeTimer = null;

    // Efecto de escritura humana — renderiza gradualmente el texto acumulado
    function typeStep() {
      if (!currentBotMsg) return;
      const remaining = botContent.length - displayedLength;
      if (remaining <= 0) { typeTimer = null; return; }
      // 2-4 caracteres por tick para variación natural
      const step = Math.min(remaining, Math.floor(Math.random() * 3) + 2);
      displayedLength += step;
      currentBotMsg.innerHTML = renderBotContent(botContent.slice(0, displayedLength));
      scrollToBottom();
      typeTimer = setTimeout(typeStep, 18 + Math.random() * 16); // 18-34ms entre ticks
    }

    function startTyping() {
      if (!typeTimer && displayedLength < botContent.length) {
        typeTimer = setTimeout(typeStep, 18 + Math.random() * 16);
      }
    }

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": TENANT_ID,
        },
        body: JSON.stringify({
          session_id: SESSION_ID,
          message: text,
          page_context: detectPageContext(),
        }),
      });

      if (!res.ok) throw new Error(`Chat failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case "text_delta":
                removeTypingIndicator();
                if (!currentBotMsg) {
                  currentBotMsg = addMessage("bot", "");
                  botContent = "";
                  displayedLength = 0;
                }
                botContent += event.content;
                startTyping();
                break;

              case "tool_status":
                if (event.status === "running") {
                  removeTypingIndicator();
                  addToolStatus(event.message || "Procesando...");
                } else if (event.status === "completed") {
                  removeToolStatus();
                }
                break;

              case "vehicle_cards":
                removeToolStatus();
                removeTypingIndicator();
                // Volcar texto pendiente antes de mostrar cards
                if (currentBotMsg && displayedLength < botContent.length) {
                  clearTimeout(typeTimer); typeTimer = null;
                  currentBotMsg.innerHTML = renderBotContent(botContent);
                }
                addVehicleCards(event.vehicles || []);
                currentBotMsg = null;
                botContent = "";
                displayedLength = 0;
                break;

              case "lead_captured":
                addLeadBanner(event.message || "Datos registrados");
                break;

              case "done":
                break;
            }
          } catch (e) {
            // Ignorar líneas no JSON
          }
        }
      }
    } catch (err) {
      console.error("[AutoChat] Error en chat:", err);
      removeTypingIndicator();
      removeToolStatus();
      addMessage("bot", "Lo siento, ha ocurrido un error. ¿Puedes intentarlo de nuevo?");
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }

  // === Proactive popup ===
  const PROACTIVE_KEY = "autochat_proactive_shown_" + TENANT_ID + "_" + window.location.pathname;

  function buildProactivePopup() {
    const ctx = detectPageContext();
    const proactiveEl = shadow.getElementById("ac-proactive");
    const msgEl = shadow.getElementById("ac-proactive-msg");
    const avatarEl = shadow.getElementById("ac-proactive-avatar");
    if (widgetConfig.avatar_url) {
      avatarEl.textContent = "";
      const img = document.createElement("img");
      img.src = widgetConfig.avatar_url;
      img.alt = "bot";
      avatarEl.appendChild(img);
    }

    let message = "";
    let buttons = [];

    if (widgetConfig.proactive_message) {
      message = widgetConfig.proactive_message;
      buttons = (widgetConfig.proactive_buttons || []).map(b => ({ label: b.label, msg: b.msg }));
    } else if (ctx.page_type === "vehicle_detail" && ctx.vehicle_brand && ctx.vehicle_model) {
      const brand = ctx.vehicle_brand.replace(/-/g, " ").toUpperCase();
      const model = ctx.vehicle_model.replace(/-/g, " ").toUpperCase();
      message = `¿Quieres saber más cosas de este ${brand} ${model}?`;
      buttons = [{ label: "Sí, cuéntame más", msg: `Quiero más información sobre el ${brand} ${model}` }];
    } else {
      message = "¡Hola! 👋 ¿Te ayudo a encontrar tu próximo coche?";
      buttons = [
        { label: "Buscar un coche", msg: "Quiero buscar un coche" },
      ];
    }

    msgEl.textContent = message;
    proactiveEl.querySelectorAll(".ac-proactive-btn").forEach(b => b.remove());

    buttons.forEach(({ label, msg }) => {
      const btn = document.createElement("button");
      btn.className = "ac-proactive-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        hideProactive();
        toggleChat(true);
        setTimeout(() => {
          input.value = msg;
          sendMessage();
        }, 400);
      });
      proactiveEl.appendChild(btn);
    });
  }

  function showProactive() {
    if (isOpen) return;
    if (sessionStorage.getItem(PROACTIVE_KEY)) return;
    buildProactivePopup();
    shadow.getElementById("ac-proactive").classList.add("visible");
  }

  function hideProactive() {
    shadow.getElementById("ac-proactive").classList.remove("visible");
    sessionStorage.setItem(PROACTIVE_KEY, "1");
  }

  // Prefetch widget config para el proactive popup
  async function prefetchConfig() {
    try {
      const res = await fetch(`${API_BASE}/chat/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-ID": TENANT_ID },
        body: JSON.stringify({ session_id: SESSION_ID, page_context: detectPageContext() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.widget_config) applyConfig(data.widget_config);
      }
    } catch (e) { /* silently fail */ }
  }

  // Prefetch config y mostrar proactive tras 6s (lo que tarde más)
  const prefetchPromise = prefetchConfig();
  setTimeout(async () => {
    await prefetchPromise;
    showProactive();
  }, 6000);

  shadow.getElementById("ac-proactive-close").addEventListener("click", (e) => {
    e.stopPropagation();
    hideProactive();
  });

  // === Event listeners ===
  function toggleChat(forceOpen) {
    isOpen = forceOpen !== undefined ? forceOpen : !isOpen;
    fabWrapper.classList.toggle("open", isOpen);
    win.classList.toggle("open", isOpen);
    if (isOpen) {
      hideProactive();
      if (messagesEl.children.length === 0) initSession();
      input.focus();
    }
  }

  fab.addEventListener("click", () => toggleChat());
  headerClose.addEventListener("click", () => toggleChat(false));

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();
