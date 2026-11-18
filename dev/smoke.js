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
  // click a word in Claude's reply, then translate the whole reply
  [...document.querySelectorAll(".bubble.them .w")].find((w) => w.textContent === "gjorde")?.click();
  await wait(300);
  log.push("word: " + ($(".gloss-word")?.innerText.replace(/\s+/g, " ") || "none"));
  [...document.querySelectorAll(".bubble.them .tools button")].find((b) => b.textContent === "DE")?.click();
  await wait(300);
  log.push("translate: " + ($(".gloss-tr")?.innerText.replace(/\s+/g, " ") || "none") + " | said=" + JSON.stringify($(".bubble.them .say")?.textContent));
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
  // open one point, read the explanation, ask a follow-up
  const det = $("details.ask");
  det.open = true;
  await wait(300);
  det.querySelector("input").value = "Warum?";
  det.querySelector("form").requestSubmit();
  await wait(300);
  log.push("ask: " + [...det.querySelectorAll(".ask-q, .ask-a")].map((e) => e.className + "=" + e.textContent.slice(0, 30)).join(" | ") + " | panels=" + document.querySelectorAll("details.ask").length);
  if (location.search.includes("shot=ask")) throw new Error("STOP");
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

  location.hash = "talk";
  await wait(400);
  await click("Spielen");
  await wait(400);
  log.push("mission: " + ($("#view .note")?.innerText.replace(/s+/g, " ") || "none"));
  (await until("#view textarea")).value = "En kaffe, tack";
  await click("Senden");
  await wait(300);
  await click("Beenden & auswerten");
  await wait(500);
  log.push("mission eval: " + text());

  location.hash = "speak";
  (await until("#view .topic")).click();
  await wait(400);
  await click("Nachsprechen");
  await click("Fertig");
  await wait(300);
  log.push("shadow: " + text());
  if (location.search.includes("shot=shadow")) throw new Error("STOP");
  await click("Weiter");
  await click("Weiter");
  await wait(400);
  log.push("shadow end: " + text());

  location.hash = "progress";
  await wait(400);
  await click("Regel lernen");
  await wait(400);
  log.push("grammar: " + text());
  await click("Jetzt üben");
  (await until("#view textarea")).value = "jag gick";
  await click("Prüfen");
  await click("Weiter");
  (await until("#view textarea")).value = "han sag";
  await click("Prüfen");
  await wait(200);
  await click("Fertig");
  await wait(300);
  log.push("grammar end: " + text());
  location.hash = "progress";
  await wait(400);
  log.push("progress: " + text());
  if (location.search.includes("shot=progress")) throw new Error("STOP");
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
