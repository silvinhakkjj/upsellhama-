/* =========================================================
   Back redirect com chave + repasse de UTMs, reaproveitável.
   Uso: backRedirect({ prefixo: "ab_", rotaDestino: "/oferta", checkout: "f5SOE2kqryUniC23kUPRJt" })
   Chaves no sessionStorage: <prefixo>bk, <prefixo>bk_t, <prefixo>back_visto
   - checkout: trecho do link de compra que gera a chave (omitido = qualquer link ggcheckout)
   Um upsell novo é só mais uma chamada com outro prefixo e outra rota.
   ========================================================= */
(function () {
  "use strict";
  var MAX_MS = 30 * 60 * 1000;
  var CHAVES = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck", "fbclid"];

  window.backRedirect = function (cfg) {
    var P = cfg.prefixo, DESTINO = cfg.rotaDestino, CHECKOUT = cfg.checkout || "ggcheckout.app";
    var K_BK = P + "bk", K_T = P + "bk_t", K_VISTO = P + "back_visto";

    function ss(fn) { try { return fn(); } catch (e) { return null; } }
    function queryLimpa() {
      var p = new URLSearchParams(location.search); p.delete(K_BK);
      var q = p.toString(); return q ? "?" + q : "";
    }
    function comUtms(href) {
      try {
        var u = new URL(href, location.href), atual = new URLSearchParams(location.search);
        CHAVES.forEach(function (k) { var v = atual.get(k); if (v && !u.searchParams.has(k)) u.searchParams.set(k, v); });
        return u.toString();
      } catch (e) { return href; }
    }
    function irDestino() {
      ss(function () { sessionStorage.setItem(K_VISTO, "1"); });
      location.replace(DESTINO + queryLimpa());
    }

    /* A) chave ao ir pro checkout + UTMs em todo link de compra */
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var href = a.getAttribute("href");
      var interno = href === DESTINO || href.indexOf(DESTINO + "?") === 0;
      if (href.indexOf("ggcheckout.app") === -1 && !interno) return;
      a.setAttribute("href", comUtms(href));
      if (interno) { ss(function () { sessionStorage.setItem(K_VISTO, "1"); }); return; }
      if (href.indexOf(CHECKOUT) > -1) {
        var chave = Math.random().toString(36).slice(2, 10);
        ss(function () { sessionStorage.setItem(K_BK, chave); sessionStorage.setItem(K_T, String(Date.now())); });
        var p = new URLSearchParams(location.search); p.set(K_BK, chave);
        history.replaceState(history.state, "", location.pathname + "?" + p.toString() + location.hash);
      }
    }, true);

    /* B) voltou do checkout com a chave certa: vai pro destino */
    function checarVolta(persisted) {
      var chave = new URLSearchParams(location.search).get(K_BK);
      if (!chave) return;
      var nav = ss(function () { return performance.getEntriesByType("navigation")[0]; });
      var voltou = persisted || (nav && nav.type === "back_forward");
      var salva = ss(function () { return sessionStorage.getItem(K_BK); });
      var t = Number(ss(function () { return sessionStorage.getItem(K_T); }) || 0);
      if (voltou && chave === salva && Date.now() - t <= MAX_MS) {
        ss(function () { sessionStorage.removeItem(K_BK); sessionStorage.removeItem(K_T); });
        irDestino();
      } else {
        history.replaceState(history.state, "", location.pathname + queryLimpa() + location.hash);
      }
    }
    checarVolta(false);
    window.addEventListener("pageshow", function (ev) { if (ev.persisted) checarVolta(true); });

    /* C) tentou sair sem comprar: arma só depois da primeira interação real, 1 vez por sessão */
    var armado = false;
    function armar() {
      if (armado) return; armado = true;
      history.pushState({ backRedirect: P }, "", location.href);
    }
    ["pointerdown", "touchstart", "keydown"].forEach(function (ev) {
      window.addEventListener(ev, armar, { once: true, passive: true });
    });
    window.addEventListener("popstate", function () {
      if (!armado) return;
      if (ss(function () { return sessionStorage.getItem(K_VISTO); })) { history.back(); return; }
      irDestino();
    });
  };
})();
