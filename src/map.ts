// Classic Risk world map: 42 territories across 6 continents.
// This is the ONE place map topology is defined (seam: MAP).

export type ContinentId =
  | "North America"
  | "South America"
  | "Europe"
  | "Africa"
  | "Asia"
  | "Australia";

export interface TerritoryDef {
  readonly id: string;
  readonly name: string;
  readonly continent: ContinentId;
  readonly neighbors: readonly string[];
  // Normalised position on a 0..100 canvas, used by the UI and never by rules.
  readonly x: number;
  readonly y: number;
}

export interface ContinentDef {
  readonly id: ContinentId;
  readonly bonus: number;
  readonly territories: readonly string[];
}

export const CONTINENTS: readonly ContinentDef[] = [
  { id: "North America", bonus: 5, territories: ["alaska","northwest-territory","greenland","alberta","ontario","quebec","western-us","eastern-us","central-america"] },
  { id: "South America", bonus: 2, territories: ["venezuela","peru","brazil","argentina"] },
  { id: "Europe", bonus: 5, territories: ["iceland","great-britain","scandinavia","ukraine","northern-europe","southern-europe","western-europe"] },
  { id: "Africa", bonus: 3, territories: ["north-africa","egypt","east-africa","congo","south-africa","madagascar"] },
  { id: "Asia", bonus: 7, territories: ["ural","siberia","yakutsk","kamchatka","irkutsk","mongolia","japan","afghanistan","china","middle-east","india","siam"] },
  { id: "Australia", bonus: 2, territories: ["indonesia","new-guinea","western-australia","eastern-australia"] },
];

const RAW: readonly Omit<TerritoryDef, "continent">[] = [
  { id: "alaska", name: "Alaska", neighbors: ["northwest-territory","alberta","kamchatka"], x: 8, y: 22 },
  { id: "northwest-territory", name: "Northwest Territory", neighbors: ["alaska","alberta","ontario","greenland"], x: 16, y: 16 },
  { id: "greenland", name: "Greenland", neighbors: ["northwest-territory","ontario","quebec","iceland"], x: 36, y: 12 },
  { id: "alberta", name: "Alberta", neighbors: ["alaska","northwest-territory","ontario","western-us"], x: 15, y: 27 },
  { id: "ontario", name: "Ontario", neighbors: ["northwest-territory","alberta","greenland","quebec","western-us","eastern-us"], x: 24, y: 26 },
  { id: "quebec", name: "Quebec", neighbors: ["ontario","greenland","eastern-us"], x: 32, y: 27 },
  { id: "western-us", name: "Western US", neighbors: ["alberta","ontario","eastern-us","central-america"], x: 18, y: 36 },
  { id: "eastern-us", name: "Eastern US", neighbors: ["ontario","quebec","western-us","central-america"], x: 26, y: 38 },
  { id: "central-america", name: "Central America", neighbors: ["western-us","eastern-us","venezuela"], x: 22, y: 48 },
  { id: "venezuela", name: "Venezuela", neighbors: ["central-america","peru","brazil"], x: 28, y: 58 },
  { id: "peru", name: "Peru", neighbors: ["venezuela","brazil","argentina"], x: 26, y: 70 },
  { id: "brazil", name: "Brazil", neighbors: ["venezuela","peru","argentina","north-africa"], x: 36, y: 68 },
  { id: "argentina", name: "Argentina", neighbors: ["peru","brazil"], x: 30, y: 84 },
  { id: "iceland", name: "Iceland", neighbors: ["greenland","great-britain","scandinavia"], x: 46, y: 18 },
  { id: "great-britain", name: "Great Britain", neighbors: ["iceland","scandinavia","northern-europe","western-europe"], x: 46, y: 28 },
  { id: "scandinavia", name: "Scandinavia", neighbors: ["iceland","great-britain","ukraine","northern-europe"], x: 53, y: 20 },
  { id: "ukraine", name: "Ukraine", neighbors: ["scandinavia","northern-europe","southern-europe","ural","afghanistan","middle-east"], x: 60, y: 28 },
  { id: "northern-europe", name: "Northern Europe", neighbors: ["great-britain","scandinavia","ukraine","southern-europe","western-europe"], x: 52, y: 32 },
  { id: "southern-europe", name: "Southern Europe", neighbors: ["northern-europe","ukraine","western-europe","north-africa","egypt","middle-east"], x: 54, y: 40 },
  { id: "western-europe", name: "Western Europe", neighbors: ["great-britain","northern-europe","southern-europe","north-africa"], x: 46, y: 40 },
  { id: "north-africa", name: "North Africa", neighbors: ["brazil","western-europe","southern-europe","egypt","east-africa","congo"], x: 48, y: 52 },
  { id: "egypt", name: "Egypt", neighbors: ["north-africa","southern-europe","middle-east","east-africa"], x: 58, y: 50 },
  { id: "east-africa", name: "East Africa", neighbors: ["north-africa","egypt","middle-east","madagascar","congo","south-africa"], x: 60, y: 62 },
  { id: "congo", name: "Congo", neighbors: ["north-africa","east-africa","south-africa"], x: 54, y: 66 },
  { id: "south-africa", name: "South Africa", neighbors: ["congo","east-africa","madagascar"], x: 56, y: 80 },
  { id: "madagascar", name: "Madagascar", neighbors: ["east-africa","south-africa"], x: 68, y: 80 },
  { id: "ural", name: "Ural", neighbors: ["ukraine","siberia","china","afghanistan"], x: 70, y: 28 },
  { id: "siberia", name: "Siberia", neighbors: ["ural","yakutsk","irkutsk","mongolia","china"], x: 74, y: 18 },
  { id: "yakutsk", name: "Yakutsk", neighbors: ["siberia","kamchatka","irkutsk"], x: 82, y: 14 },
  { id: "kamchatka", name: "Kamchatka", neighbors: ["yakutsk","irkutsk","mongolia","japan","alaska"], x: 92, y: 18 },
  { id: "irkutsk", name: "Irkutsk", neighbors: ["siberia","yakutsk","kamchatka","mongolia"], x: 82, y: 26 },
  { id: "mongolia", name: "Mongolia", neighbors: ["siberia","irkutsk","kamchatka","japan","china"], x: 82, y: 34 },
  { id: "japan", name: "Japan", neighbors: ["kamchatka","mongolia"], x: 92, y: 34 },
  { id: "afghanistan", name: "Afghanistan", neighbors: ["ukraine","ural","china","india","middle-east"], x: 66, y: 40 },
  { id: "china", name: "China", neighbors: ["ural","siberia","mongolia","afghanistan","india","siam"], x: 78, y: 42 },
  { id: "middle-east", name: "Middle East", neighbors: ["ukraine","southern-europe","egypt","east-africa","afghanistan","india"], x: 62, y: 48 },
  { id: "india", name: "India", neighbors: ["afghanistan","china","middle-east","siam"], x: 72, y: 52 },
  { id: "siam", name: "Siam", neighbors: ["china","india","indonesia"], x: 80, y: 56 },
  { id: "indonesia", name: "Indonesia", neighbors: ["siam","new-guinea","western-australia"], x: 80, y: 68 },
  { id: "new-guinea", name: "New Guinea", neighbors: ["indonesia","western-australia","eastern-australia"], x: 90, y: 68 },
  { id: "western-australia", name: "Western Australia", neighbors: ["indonesia","new-guinea","eastern-australia"], x: 82, y: 82 },
  { id: "eastern-australia", name: "Eastern Australia", neighbors: ["new-guinea","western-australia"], x: 92, y: 82 },
];

const CONTINENT_OF = new Map<string, ContinentId>();
for (const c of CONTINENTS) for (const t of c.territories) CONTINENT_OF.set(t, c.id);

export const TERRITORIES: readonly TerritoryDef[] = RAW.map((t) => {
  const continent = CONTINENT_OF.get(t.id);
  if (!continent) throw new Error(`territory ${t.id} belongs to no continent`);
  return { ...t, continent };
});

export const TERRITORY_BY_ID: ReadonlyMap<string, TerritoryDef> = new Map(
  TERRITORIES.map((t) => [t.id, t]),
);

/** Loud integrity check: adjacency is symmetric and every reference resolves. */
export function validateMap(): void {
  if (TERRITORIES.length !== 42) throw new Error(`expected 42 territories, got ${TERRITORIES.length}`);
  for (const t of TERRITORIES) {
    for (const n of t.neighbors) {
      const other = TERRITORY_BY_ID.get(n);
      if (!other) throw new Error(`${t.id} lists unknown neighbour ${n}`);
      if (!other.neighbors.includes(t.id)) throw new Error(`adjacency ${t.id}<->${n} is not symmetric`);
    }
  }
}
