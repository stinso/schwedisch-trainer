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
