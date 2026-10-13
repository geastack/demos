// The five destinations, in carousel order. Colours sit on the RGB565 grid.
// `ink` / `soft` are the title and tagline colours over the hero's sky; `pill`
// is an opaque dark glass pre-blended from the art's lower edge, `pillEdge`
// its lighter rim. `inkButton` puts ink text on a light accent.
export type Place = {
  name: string;
  country: string;
  tagline: string;
  season: string;
  flight: string;
  price: string;
  zone: string;
  copyTop: string;
  copyBottom: string;
  firstLabel: string;
  firstName: string;
  secondLabel: string;
  secondName: string;
  accent: string;
  inkButton: boolean;
  ink: string;
  soft: string;
  pill: string;
  pillEdge: string;
};

export const PLACES: Place[] = [
  {
    name: "Kyoto",
    country: "Japan",
    tagline: "Japan · Temples in autumn fire",
    season: "Oct – Nov",
    flight: "13h",
    price: "€€€",
    zone: "UTC+9",
    copyTop: "Temple bells, lantern-lit lanes",
    copyBottom: "and maples ablaze at dusk.",
    firstLabel: "Taste",
    firstName: "Matcha & mochi",
    secondLabel: "See",
    secondName: "Fushimi Inari",
    accent: "#E05830",
    inkButton: false,
    ink: "#381410",
    soft: "#702818",
    pill: "#301410",
    pillEdge: "#502820",
  },
  {
    name: "Santorini",
    country: "Greece",
    tagline: "Greece · Where the sunset lingers",
    season: "May – Sep",
    flight: "4h",
    price: "€€€",
    zone: "UTC+2",
    copyTop: "Cliffside villages, blue domes",
    copyBottom: "and a caldera glowing at dusk.",
    firstLabel: "Taste",
    firstName: "Grilled octopus",
    secondLabel: "See",
    secondName: "Oia blue domes",
    accent: "#3070D8",
    inkButton: false,
    ink: "#182850",
    soft: "#384878",
    pill: "#403020",
    pillEdge: "#605040",
  },
  {
    name: "Iceland",
    country: "South coast",
    tagline: "South Iceland · Aurora on the ice",
    season: "Sep – Mar",
    flight: "3h",
    price: "€€€€",
    zone: "UTC+0",
    copyTop: "Drift past icebergs under a sky",
    copyBottom: "of dancing green and violet light.",
    firstLabel: "Soak",
    firstName: "Blue Lagoon",
    secondLabel: "See",
    secondName: "Reynisfjara",
    accent: "#40DC98",
    inkButton: true,
    ink: "#F8ECE0",
    soft: "#B8E0D0",
    pill: "#102420",
    pillEdge: "#284440",
  },
  {
    name: "Marrakech",
    country: "Morocco",
    tagline: "Morocco · Nights in the Sahara",
    season: "Mar – May",
    flight: "3h",
    price: "€€",
    zone: "UTC+1",
    copyTop: "Ride the dunes at golden hour,",
    copyBottom: "then sleep by the fire under stars.",
    firstLabel: "Taste",
    firstName: "Apricot tagine",
    secondLabel: "See",
    secondName: "Bahia Palace",
    accent: "#E89038",
    inkButton: true,
    ink: "#401808",
    soft: "#682808",
    pill: "#381808",
    pillEdge: "#583420",
  },
  {
    name: "Patagonia",
    country: "Chile",
    tagline: "Chile · The end of the world",
    season: "Nov – Mar",
    flight: "16h",
    price: "€€€",
    zone: "UTC-3",
    copyTop: "Hike beneath granite spires to",
    copyBottom: "glacier-fed turquoise lakes.",
    firstLabel: "Taste",
    firstName: "Lamb asado",
    secondLabel: "See",
    secondName: "The W Trek",
    accent: "#20A4A8",
    inkButton: true,
    ink: "#183038",
    soft: "#385058",
    pill: "#303420",
    pillEdge: "#505440",
  },
];
