// Local-only: clicks through every view and writes a report into <pre id="smoke">.
const log = [];
const errors = [];
window.addEventListener("error", (e) => errors.push("error: " + e.message));
window.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + (e.reason?.message || JSON.stringify(e.reason))));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const btn = (txt) => [...document.querySelectorAll("button")].find((b) => b.textContent.includes(txt) && !b.disabled);
const text = () => $("#view").innerText.replace(/\s+/g, " ").slice(0, 200);
async function click(txt) {
  for (let i = 0; i < 40; i++) {
    const b = btn(txt);
    if (b) { b.click(); await wait(150); return true; }
    await wait(50);
  }
  log.push("MISSING button: " + txt + " @ " + text());
  return false;
}
async function until(sel) {
  for (let i = 0; i < 40; i++) { const el = $(sel); if (el) return el; await wait(50); }
  throw new Error("missing " + sel);
}

async function steps() {
  await wait(400);
  log.push("start: " + text());
  await click("Test starten");
  for (let i = 0; i < 10; i++) {
    const ta = $("#view textarea");
    if (!ta) break;
    ta.value = i < 4 ? "Jag heter Marc" : "";
    await click(i < 4 ? "Weiter" : "Weiß ich nicht");
  }
  await wait(300);
  log.push("placement result: " + text());
  await click("Los geht's");
  await wait(300);
  log.push("today: " + text());

  location.hash = "talk";
  (await until("#view .topic")).click();
  await wait(400);
  (await until("#view textarea")).value = "Jag gå till stranden";
  await click("Senden");
  await wait(300);
  await click("✏️");
  await wait(300);
  log.push("fix: " + ($(".fix")?.innerText.replace(/\s+/g, " ") || "none"));
  // mic still on when sending: last phrase must be included
  $("#view textarea").value = "Jag bor i Berlin";
  await click("Sprechen");
  await click("Senden");
  await wait(400);
  log.push("mic-send: " + [...document.querySelectorAll(".bubble.me .sv")].at(-1)?.textContent + " | field=" + JSON.stringify($("#view textarea").value));
  // resume from Today (draft comes back frozen from the store)
  location.hash = "today";
  await wait(400);
  await click("Weiter");
  await wait(400);
  (await until("#view textarea")).value = "Hej igen";
  await click("Senden");
  await wait(400);
  log.push("resume: me-bubbles=" + document.querySelectorAll(".bubble.me").length + " them=" + document.querySelectorAll(".bubble.them").length);
  $("#view textarea").value = "Zug verpasst";
  await click("Wie sagt man");
  await wait(300);
  if (location.search.includes("shot=talk")) throw new Error("STOP");
  log.push("help: " + ($(".composer .note")?.innerText.replace(/\s+/g, " ") || "none"));
  await click("Beenden & auswerten");
  await wait(500);
  log.push("evaluation: " + text());
  await click("Jetzt wiederholen");
  await wait(400);
  log.push("review: " + text());
  for (let i = 0; i < 8; i++) {
    const ta = $("#view textarea");
    if (!ta) break;
    ta.value = "jag gick";
    await click("Prüfen");
    await wait(200);
    const b = btn("Weiter") || btn("Fertig") || btn("gewusst") || btn("war richtig");
    b?.click();
    await wait(200);
    (btn("Weiter") || btn("Fertig"))?.click();
    await wait(200);
  }
  log.push("review end: " + text());

  location.hash = "listen";
  (await until("#view .topic")).click();
  await wait(400);
  (await until("#q0")).value = "Im Zug";
  await click("Antworten prüfen");
  await wait(300);
  log.push("listen graded: " + text());

  location.hash = "progress";
  await wait(400);
  log.push("progress: " + text());
  location.hash = "today";
  await wait(400);
  if (location.search.includes("shot=today")) throw new Error("STOP");
  log.push("widths: inner=" + innerWidth + " scroll=" + document.documentElement.scrollWidth);
  log.push("today2: " + text());
  log.push("header: " + $(".top").innerText.replace(/\s+/g, " "));
}

async function run() {
  try {
    await steps();
  } catch (e) {
    errors.push("smoke threw: " + e.message + " @ " + text());
  }
  if (location.search.includes("shot=")) return;
  const pre = document.createElement("pre");
  pre.id = "smoke";
  pre.textContent = [...log, "ERRORS: " + (errors.join(" | ") || "none")].join("\n");
  document.body.append(pre);
}
run();
