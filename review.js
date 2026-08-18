/* Review Pack gym — same rules as the sitting engine.
   Unlabelled speech is rejected. Consent is fail-closed.
   pending.jsonl write is required before a grant request.
   Revoke takes effect on the next request. Memory survives restart.
   Compression: 1 second of clock = 1 minute of simulated light-time. */
(function () {
  "use strict";

  var KEY = "ta-review-gym-v1";

  function emptyState() {
    return {
      consent: "none",
      pendingWriteOk: true,
      process: 1,
      memory: [],
      log: [],
      simMinutes: 0,
      scale: 60,
      running: false,
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return emptyState();
      return Object.assign(emptyState(), JSON.parse(raw));
    } catch (e) {
      return emptyState();
    }
  }

  function saveState(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function validateEnvelope(env) {
    if (!env.belt) return "rejected: unlabelled speech (no belt)";
    if (env.belt !== "science" && env.belt !== "vision" && env.belt !== "docs-gov") {
      return "rejected: unknown belt";
    }
    if (!env.action) return "rejected: no action";
    return null;
  }

  function evaluate(state, env) {
    var beltFail = validateEnvelope(env);
    var verdict;
    if (beltFail) {
      verdict = { ok: false, reason: beltFail, at: Date.now(), action: env.action, consent: state.consent };
      return { state: Object.assign({}, state, { log: [verdict].concat(state.log).slice(0, 40) }), verdict: verdict };
    }
    if (state.consent === "none" || state.consent === "pending") {
      verdict = {
        ok: false,
        reason: "fail-closed: no grant (consent is a runtime property)",
        at: Date.now(),
        action: env.action,
        consent: state.consent,
      };
      return { state: Object.assign({}, state, { log: [verdict].concat(state.log).slice(0, 40) }), verdict: verdict };
    }
    if (state.consent === "denied" || state.consent === "revoked") {
      verdict = {
        ok: false,
        reason: "fail-closed: " + state.consent + " — next request refused",
        at: Date.now(),
        action: env.action,
        consent: state.consent,
      };
      return { state: Object.assign({}, state, { log: [verdict].concat(state.log).slice(0, 40) }), verdict: verdict };
    }
    verdict = {
      ok: true,
      reason: "granted: " + env.action + " under belt " + env.belt,
      at: Date.now(),
      action: env.action,
      consent: state.consent,
    };
    return { state: Object.assign({}, state, { log: [verdict].concat(state.log).slice(0, 40) }), verdict: verdict };
  }

  function requestGrant(state) {
    if (!state.pendingWriteOk) {
      return { state: state, error: "pending.jsonl write failed — request refused" };
    }
    return { state: Object.assign({}, state, { consent: "pending" }) };
  }

  function decide(state, next) {
    if (state.consent !== "pending") return state;
    return Object.assign({}, state, { consent: next });
  }

  function revoke(state) {
    if (state.consent === "none") return state;
    return Object.assign({}, state, { consent: "revoked" });
  }

  function remember(state, text) {
    var fact = {
      id: String(Date.now()) + Math.random().toString(16).slice(2),
      text: text.trim(),
      writtenAt: Date.now(),
      process: state.process,
    };
    return Object.assign({}, state, { memory: [fact].concat(state.memory).slice(0, 20) });
  }

  function restartProcess(state) {
    return Object.assign({}, state, { process: state.process + 1 });
  }

  function runSelftest() {
    var results = [];
    var s = emptyState();
    var r = evaluate(s, { id: "t1", belt: "", action: "uplink", payload: "ping", at: Date.now() });
    results.push({
      name: "Unlabelled envelope is rejected",
      pass: !r.verdict.ok && r.verdict.reason.indexOf("unlabelled") !== -1,
      detail: r.verdict.reason,
    });
    s = r.state;
    r = evaluate(s, { id: "t2", belt: "science", action: "uplink", payload: "ping", at: Date.now() });
    results.push({
      name: "Action without grant is fail-closed",
      pass: !r.verdict.ok && r.verdict.reason.indexOf("fail-closed") !== -1,
      detail: r.verdict.reason,
    });
    s = r.state;
    s = Object.assign({}, s, { pendingWriteOk: false });
    var blocked = requestGrant(s);
    results.push({
      name: "Failed pending write refuses the request",
      pass: Boolean(blocked.error) && blocked.state.consent === "none",
      detail: blocked.error || "write unexpectedly succeeded",
    });
    s = Object.assign({}, blocked.state, { pendingWriteOk: true });
    var asked = requestGrant(s);
    s = decide(asked.state, "granted");
    r = evaluate(s, { id: "t3", belt: "science", action: "uplink", payload: "ping", at: Date.now() });
    results.push({ name: "Grant then action is allowed", pass: r.verdict.ok, detail: r.verdict.reason });
    s = r.state;
    s = revoke(s);
    r = evaluate(s, { id: "t4", belt: "science", action: "uplink", payload: "ping", at: Date.now() });
    results.push({
      name: "Revoke takes effect on the next request",
      pass: !r.verdict.ok && s.consent === "revoked",
      detail: r.verdict.reason,
    });
    s = r.state;
    s = remember(s, "sol-clock offset recorded");
    var before = s.memory.length;
    s = restartProcess(s);
    results.push({
      name: "Memory survives process restart",
      pass: s.memory.length === before && s.process === 2,
      detail: s.memory.length + " fact(s) in process " + s.process,
    });
    return results;
  }

  var state = loadState();
  var lastTick = null;
  var raf = null;

  function $(id) {
    return document.getElementById(id);
  }

  function render() {
    saveState(state);
    var clock = $("gym-clock");
    if (clock) clock.textContent = state.simMinutes.toFixed(1);
    var process = $("gym-process");
    if (process) process.textContent = String(state.process);
    var consent = $("gym-consent");
    if (consent) {
      consent.textContent = "consent: " + state.consent;
      consent.setAttribute("data-consent", state.consent);
    }
    var write = $("gym-write");
    if (write) write.checked = state.pendingWriteOk;
    var start = $("gym-start");
    if (start) start.textContent = state.running ? "Pause clock" : "Start clock";
    var grantErr = $("gym-grant-error");
    if (grantErr && !grantErr.dataset.hold) grantErr.textContent = "";
    var grant = $("gym-grant");
    var deny = $("gym-deny");
    if (grant) grant.disabled = state.consent !== "pending";
    if (deny) deny.disabled = state.consent !== "pending";

    var log = $("gym-log");
    if (log) {
      log.innerHTML = "";
      if (state.log.length === 0) {
        var empty = document.createElement("li");
        empty.className = "faint";
        empty.textContent = "No verdicts yet.";
        log.appendChild(empty);
      } else {
        state.log.forEach(function (v) {
          var li = document.createElement("li");
          li.className = v.ok ? "ok" : "no";
          li.textContent = (v.ok ? "allow" : "refuse") + " · " + v.reason;
          log.appendChild(li);
        });
      }
    }

    var mem = $("gym-memory");
    if (mem) {
      mem.innerHTML = "";
      if (state.memory.length === 0) {
        var none = document.createElement("li");
        none.className = "faint";
        none.textContent = "No facts stored.";
        mem.appendChild(none);
      } else {
        state.memory.forEach(function (f) {
          var li = document.createElement("li");
          li.textContent = "p" + f.process + " · " + f.text;
          mem.appendChild(li);
        });
      }
    }
  }

  function tick(now) {
    if (!state.running) {
      lastTick = null;
      raf = null;
      return;
    }
    if (lastTick == null) lastTick = now;
    var dt = now - lastTick;
    lastTick = now;
    state = Object.assign({}, state, {
      simMinutes: state.simMinutes + (dt / 1000) * (state.scale / 60),
    });
    render();
    raf = requestAnimationFrame(tick);
  }

  function startClock() {
    if (state.running && raf) return;
    state = Object.assign({}, state, { running: true });
    render();
    raf = requestAnimationFrame(tick);
  }

  function stopClock() {
    state = Object.assign({}, state, { running: false });
    lastTick = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    render();
  }

  function on(id, ev, fn) {
    var el = $(id);
    if (el) el.addEventListener(ev, fn);
  }

  on("gym-start", "click", function () {
    if (state.running) stopClock();
    else startClock();
  });
  on("gym-reset", "click", function () {
    stopClock();
    state = Object.assign({}, state, { simMinutes: 0 });
    render();
  });
  on("gym-write", "change", function (e) {
    state = Object.assign({}, state, { pendingWriteOk: e.target.checked });
    render();
  });
  on("gym-request", "click", function () {
    var result = requestGrant(state);
    var err = $("gym-grant-error");
    if (err) {
      err.textContent = result.error || "";
      err.dataset.hold = result.error ? "1" : "";
    }
    state = result.state;
    render();
  });
  on("gym-grant", "click", function () {
    state = decide(state, "granted");
    render();
  });
  on("gym-deny", "click", function () {
    state = decide(state, "denied");
    render();
  });
  on("gym-revoke", "click", function () {
    state = revoke(state);
    render();
  });
  on("gym-send", "click", function () {
    var belt = $("gym-belt");
    var action = $("gym-action");
    var result = evaluate(state, {
      id: String(Date.now()),
      belt: belt ? belt.value : "",
      action: action ? action.value : "uplink",
      payload: "ping",
      at: Date.now(),
    });
    state = result.state;
    render();
  });
  on("gym-remember", "click", function () {
    var input = $("gym-note");
    if (!input || !input.value.trim()) return;
    state = remember(state, input.value);
    input.value = "";
    render();
  });
  on("gym-restart", "click", function () {
    state = restartProcess(state);
    render();
  });
  on("gym-selftest", "click", function () {
    var box = $("gym-tests");
    if (!box) return;
    box.innerHTML = "";
    runSelftest().forEach(function (t) {
      var li = document.createElement("li");
      li.className = t.pass ? "ok" : "no";
      li.textContent = (t.pass ? "pass" : "fail") + " · " + t.name;
      box.appendChild(li);
    });
  });

  render();
  if (state.running) startClock();
})();
