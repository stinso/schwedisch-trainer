// Levels, topics per level, placement/retest rules and streaks. Pure.
export const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

const T = (id, de, sv) => ({ id, de, sv });

const TOPICS = {
  A1: [
    T("vorstellen", "Sich vorstellen", "Presentera dig"),
    T("familie", "Familie", "Familj"),
    T("cafe", "Im Café", "På kaféet"),
    T("essen", "Essen & Trinken", "Mat och dryck"),
    T("wohnen", "Wo ich wohne", "Där jag bor"),
    T("tag", "Mein Tag", "Min dag"),
    T("einkaufen", "Einkaufen", "Handla"),
    T("wetter", "Das Wetter", "Vädret"),
  ],
  A2: [
    T("wochenende", "Das Wochenende", "Helgen"),
    T("hobbys", "Hobbys & Freizeit", "Fritid och hobbyer"),
    T("arbeit", "Meine Arbeit", "Mitt jobb"),
    T("reisen", "Reisen", "Att resa"),
    T("restaurant", "Im Restaurant", "På restaurangen"),
    T("weg", "Nach dem Weg fragen", "Fråga om vägen"),
    T("arzt", "Beim Arzt", "Hos läkaren"),
    T("feste", "Feste & Feiertage", "Högtider"),
  ],
  B1: [
    T("schweden", "Leben in Schweden", "Att bo i Sverige"),
    T("urlaub", "Ein unvergesslicher Urlaub", "En oförglömlig semester"),
    T("job", "Arbeitsalltag & Kollegen", "Arbetsliv och kollegor"),
    T("wohnungssuche", "Wohnungssuche", "Att leta bostad"),
    T("natur", "Natur & Allemansrätten", "Naturen och allemansrätten"),
    T("gesundheit", "Gesundheit & Sport", "Hälsa och träning"),
    T("medien", "Filme, Serien, Bücher", "Film, serier och böcker"),
    T("fika", "Fika & schwedische Kultur", "Fika och svensk kultur"),
  ],
  B2: [
    T("arbeitswelt", "Die moderne Arbeitswelt", "Det moderna arbetslivet"),
    T("klima", "Klima & Umwelt", "Klimat och miljö"),
    T("technik", "Technik im Alltag", "Teknik i vardagen"),
    T("gesellschaft", "Gleichberechtigung", "Jämställdhet"),
    T("bildung", "Bildung & Schule", "Utbildning och skola"),
    T("stadtland", "Stadt oder Land?", "Stad eller landsbygd?"),
    T("nachrichten", "Aktuelle Nachrichten", "Aktuella nyheter"),
    T("lagom", "Lagom & Jantelagen", "Lagom och jantelagen"),
  ],
  C1: [
    T("politik", "Politik & Demokratie", "Politik och demokrati"),
    T("ethik", "KI & Ethik", "AI och etik"),
    T("wirtschaft", "Wirtschaft & Wohlstand", "Ekonomi och välfärd"),
    T("identitaet", "Sprache & Identität", "Språk och identitet"),
    T("migration", "Migration & Integration", "Migration och integration"),
    T("kunst", "Kunst & Literatur", "Konst och litteratur"),
    T("zukunft", "Die Zukunft der Arbeit", "Arbetets framtid"),
    T("debatte", "Eine Streitfrage debattieren", "Debattera en kontroversiell fråga"),
  ],
};

export function topicsFor(level) {
  return TOPICS[level] || TOPICS.A1;
}

export function needsPlacement(profile) {
  return !profile || !profile.level;
}

const DAY = 86400000;

export function shouldSuggestRetest(placedAtISO, now) {
  if (!placedAtISO) return false;
  return now.getTime() - new Date(placedAtISO).getTime() >= 14 * DAY;
}

export function dayKey(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// Day arithmetic on YYYY-MM-DD keys via UTC to avoid DST effects.
const toUTC = (key) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));

export function streak(dayKeys, today) {
  const days = new Set(dayKeys.map(toUTC));
  let cur = toUTC(today);
  if (!days.has(cur)) cur -= DAY;
  let n = 0;
  while (days.has(cur)) {
    n++;
    cur -= DAY;
  }
  return n;
}

export function placementShouldStop(responses) {
  const last2 = responses.slice(-2);
  return last2.length === 2 && last2.every((r) => !String(r.answer ?? "").trim());
}

// Role-play missions: Claude plays a role, the learner has a concrete goal.
const M = (id, de, role_de, goal_de) => ({ id, de, role_de, goal_de });
const MISSIONS = {
  A1: [
    M("fika", "Fika bestellen", "Barista in einem Café in Stockholm", "Bestelle einen Kaffee und eine Zimtschnecke (kanelbulle) und frag, was es kostet."),
    M("hotel", "Im Hotel einchecken", "Rezeptionist in einem Hotel in Göteborg", "Checke ein: nenne deinen Namen, frag nach dem Frühstück und dem WLAN-Passwort."),
    M("weg", "Nach dem Weg fragen", "freundliche Passantin in Uppsala", "Finde heraus, wie du zum Bahnhof kommst und wie lange es zu Fuß dauert."),
    M("markt", "Auf dem Markt", "Verkäufer an einem Obststand", "Kauf ein Kilo Äpfel und zwei Bananen und bezahle mit Karte."),
    M("nachbar", "Den Nachbarn kennenlernen", "neuer Nachbar im Treppenhaus", "Stell dich vor und finde heraus, woher er kommt und was er arbeitet."),
  ],
  A2: [
    M("arzt", "Termin beim Arzt", "Sprechstundenhilfe in einer Vårdcentral", "Vereinbare einen Termin, beschreibe kurz deine Beschwerden und bestätige Tag und Uhrzeit."),
    M("zug", "Zug verpasst", "Mitarbeiterin am Schalter der SJ", "Erkläre, dass du deinen Zug verpasst hast, und buche den nächsten Zug nach Malmö um."),
    M("restaurant", "Tisch reservieren", "Kellner in einem Restaurant", "Reserviere einen Tisch für vier Personen am Freitag und frag nach vegetarischen Gerichten."),
    M("wohnung", "Wohnung besichtigen", "Vermieterin einer Zweizimmerwohnung", "Frag nach Miete, Nebenkosten und wann du einziehen kannst."),
    M("reklamation", "Etwas umtauschen", "Verkäufer in einem Kleidungsgeschäft", "Tausche eine zu kleine Jacke um und frag, ob du stattdessen das Geld zurückbekommen kannst."),
  ],
  B1: [
    M("vorstellung", "Vorstellungsgespräch", "Personalchefin eines Start-ups in Stockholm", "Stell dich vor, nenne zwei Stärken und frag nach den Arbeitszeiten."),
    M("beschwerde", "Lärm beschweren", "Nachbar, der jeden Abend laut Musik hört", "Beschwere dich höflich und findet gemeinsam eine Lösung."),
    M("bank", "Konto eröffnen", "Bankberater", "Eröffne ein Konto und finde heraus, welche Unterlagen (z. B. Personnummer) du brauchst."),
    M("urlaub", "Urlaub planen", "Freundin, die mit dir nach Lappland reisen will", "Einigt euch auf Reisezeit, Transportmittel und Unterkunft."),
  ],
  B2: [
    M("gehalt", "Gehalt verhandeln", "Abteilungsleiter, der knapp bei Kasse ist", "Verhandle eine Gehaltserhöhung von mindestens 5 % und begründe sie überzeugend."),
    M("vermieter", "Mietstreit", "Vermieter, der die Kaution nicht zurückzahlen will", "Überzeuge ihn sachlich, die Kaution vollständig zurückzuzahlen."),
    M("projekt", "Projekt vorstellen", "skeptische Kollegin im Meeting", "Stelle eine Projektidee vor und entkräfte mindestens zwei ihrer Einwände."),
    M("versicherung", "Schaden melden", "Mitarbeiter einer Versicherung", "Melde einen Wasserschaden in deiner Wohnung und kläre, welche Kosten übernommen werden."),
  ],
  C1: [
    M("debatte", "Podiumsdiskussion", "Moderatorin einer Radiodebatte über Vierstundenwoche", "Vertritt eine klare Position und reagiere auf kritische Nachfragen."),
    M("journalist", "Interview geben", "Journalist von Dagens Nyheter", "Erkläre als Expertin/Experte ein Thema deiner Wahl verständlich und weiche einer Fangfrage diplomatisch aus."),
    M("verhandlung", "Geschäftsverhandlung", "Einkäuferin eines schwedischen Möbelkonzerns", "Handle einen Liefervertrag aus: Preis, Liefertermin und Vertragsstrafe."),
    M("kritik", "Konstruktive Kritik", "Mitarbeiter, dessen Arbeit nachgelassen hat", "Sprich das Problem taktvoll an und vereinbart konkrete nächste Schritte."),
  ],
};

export function missionsFor(level) {
  return MISSIONS[level] || MISSIONS.A1;
}
