/* Proposal-site prototypes. Teaching aids, not the Python engine.
   Hybrid identity shape: 32 + 1952 = 1984 bytes, fingerprint sha256[:16].
   12-hex field signatures are refused. Ignition writes nothing.
   Light-time: 1 s clock = 1 min simulated (scale 60). */
(function () {
  "use strict";

  var ED = 32;
  var PQ = 1952;
  var PUB = ED + PQ;
  var ORIGIN = "561783900808";


  function $(id) { return document.getElementById(id); }
  function on(id, ev, fn) {
    var el = $(id);
    if (el) el.addEventListener(ev, fn);
  }
  function hex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
    return s;
  }
  function sha256hex(bytes) {
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return hex(new Uint8Array(buf));
    });
  }
  function mintBytes() {
    var b = new Uint8Array(PUB);
    crypto.getRandomValues(b);
    return b;
  }
  function refusePairing(raw) {
    var s = (raw || "").trim();
    if (!s) return "pairing material is empty";
    if (s.charAt(0) === "{") {
      try { JSON.parse(s); } catch (e) { return "looks like JSON but does not parse"; }
      return "ForeignInvitation: THRESHOLD JSON is not a Starline identity";
    }
    var h = s.toLowerCase();
    if (h === ORIGIN) return "ForeignInvitation: published OriginMonad signature, not a hybrid public key";
    if (h.length === 12 && /^[0-9a-f]+$/.test(h)) {
      return "ForeignInvitation: 12-hex field signature is not a hybrid public key (" + (PUB * 2) + " hex chars)";
    }
    if (/^[0-9a-f]+$/i.test(s) && s.length !== PUB * 2) {
      return "pairing material is " + s.length + " hex chars; a Starline hybrid public key is " + (PUB * 2);
    }
    return null;
  }

  var ident = { bytes: null, fp: "" };

  function paintIdentity() {
    var fp = $("id-fp");
    if (fp) fp.textContent = ident.fp || "—";
    var ed = $("half-ed");
    var pq = $("half-pq");
    if (ed) ed.classList.toggle("on", !!ident.bytes);
    if (pq) pq.classList.toggle("on", !!ident.bytes);
    if (pq) pq.classList.toggle("off", ident.bytes && ident.bytes.length === ED);
  }

  function setIdentity(bytes) {
    ident.bytes = bytes;
    return sha256hex(bytes).then(function (h) {
      ident.fp = h.slice(0, 16);
      paintIdentity();
      return ident;
    });
  }

  function logPair(ok, text) {
    var ol = $("id-log");
    if (!ol) return;
    if (ol.querySelector(".faint")) ol.innerHTML = "";
    var li = document.createElement("li");
    li.className = ok ? "ok" : "no";
    li.textContent = text;
    ol.insertBefore(li, ol.firstChild);
  }

  on("id-mint", "click", function () {
    $("id-note").textContent = "";
    setIdentity(mintBytes()).then(function () {
      $("id-note").textContent = "minted in memory. " + PUB + " bytes. no file.";
    });
  });
  on("id-drop", "click", function () {
    if (!ident.bytes || ident.bytes.length !== PUB) {
      $("id-note").textContent = "mint first. dropping a missing half proves nothing.";
      return;
    }
    var before = ident.fp;
    setIdentity(ident.bytes.slice(0, ED)).then(function () {
      $("id-note").textContent = "ML-DSA half dropped. fingerprint changed " + before + " → " + ident.fp + ". that is the substitution gap closing.";
    });
  });
  on("id-pair", "click", function () {
    var reason = refusePairing($("id-paste").value);
    if (reason) logPair(false, reason);
    else logPair(true, "length matches a hybrid public key. this page cannot verify ML-DSA; the Python engine can.");
  });
  on("id-origin", "click", function () {
    $("id-paste").value = ORIGIN;
    var reason = refusePairing(ORIGIN);
    logPair(false, reason);
  });
  on("id-selftest", "click", function () {
    var box = $("id-tests");
    box.innerHTML = "";
    var a = mintBytes();
    var b = new Uint8Array(a);
    b.set(a.subarray(0, ED));
    Promise.all([sha256hex(a), sha256hex(a.subarray(0, ED)), sha256hex(b)]).then(function (hs) {
      var rows = [
        [a.length === PUB, "public blob is 1984 bytes"],
        [hs[0].slice(0, 16).length === 16, "fingerprint is 16 hex"],
        [hs[0].slice(0, 16) !== hs[1].slice(0, 16), "dropping ML-DSA changes the fingerprint"],
        [!!refusePairing(ORIGIN), "origin 12-hex is refused"],
      ];
      rows.forEach(function (r) {
        var li = document.createElement("li");
        li.className = r[0] ? "ok" : "no";
        li.textContent = (r[0] ? "pass — " : "fail — ") + r[1];
        box.appendChild(li);
      });
    });
  });

  on("ign-smash", "click", function () {
    var pre = $("ign-banner");
    pre.textContent = "[PROTOCOL] Start Ya Bastard\n*smashes*\nEngines cough…";
    setIdentity(mintBytes()).then(function () {
      pre.textContent =
        "[PROTOCOL] Start Ya Bastard\n" +
        "*smashes*\n" +
        "Engines cough, then roar.\n" +
        "Starline-shaped identity live. fingerprint=" + ident.fp + "\n" +
        "1984-byte public blob (browser stand-in for Ed25519++ML-DSA).\n" +
        "Red dust kernel synced. Ready.\n" +
        "(prototype — real ignition is python3 -m consent_transport.start)";
    });
  });
  on("ign-clear", "click", function () {
    ident = { bytes: null, fp: "" };
    paintIdentity();
    $("ign-banner").textContent = "[PROTOCOL] Start Ya Bastard\nidle. smash to cough, then roar.";
  });

  var lt = { consent: "none", timer: null };
  function paintLt() {
    var badge = $("lt-consent");
    if (badge) {
      badge.textContent = "consent: " + lt.consent;
      badge.setAttribute("data-consent", lt.consent === "granted" ? "granted" : lt.consent);
    }
    var mins = Number($("lt-range").value);
    $("lt-mins").textContent = String(mins);
    $("lt-wall").textContent = mins.toFixed(1);

  }
  function ltLog(ok, text) {
    var ol = $("lt-log");
    if (ol.querySelector(".faint")) ol.innerHTML = "";
    var li = document.createElement("li");
    li.className = ok ? "ok" : "no";
    li.textContent = text;
    ol.insertBefore(li, ol.firstChild);
  }
  on("lt-range", "input", paintLt);
  on("lt-grant", "click", function () {
    lt.consent = "granted";
    paintLt();
    ltLog(true, "granted. next uplink may fly.");
  });
  on("lt-revoke", "click", function () {
    lt.consent = "revoked";
    paintLt();
    ltLog(false, "revoked. in-flight landing will fail closed.");
  });
  on("lt-send", "click", function () {
    var belt = $("lt-belt").value;
    if (!belt) { ltLog(false, "rejected: unlabelled speech (no belt)"); return; }
    if (lt.consent !== "granted") { ltLog(false, "fail-closed: no grant"); return; }
    var mins = Number($("lt-range").value);
    var wait = mins * 1000;
    ltLog(true, "uplink in flight. " + mins + " min simulated · " + (wait / 1000).toFixed(1) + " s wall.");
    if (lt.timer) clearTimeout(lt.timer);
    lt.timer = setTimeout(function () {
      if (lt.consent !== "granted") ltLog(false, "landing refused: consent " + lt.consent + " on arrival");
      else ltLog(true, "landing: uplink arrived after " + mins + " min simulated light-time");
    }, wait);
  });
  paintLt();
})();
