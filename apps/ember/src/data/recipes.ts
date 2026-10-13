// The six guided recipes, in carousel order, plus the oven modes. Every
// recipe preheats first; its steps then alternate timed cooking with prompts
// that wait for the cook (add the food, flip it, uncover it).

export const BAKE = 0;
export const CONVECTION = 1;
export const GRILL = 2;
export const AIR_FRY = 3;

export const MODE_NAMES = ["Bake", "Convection", "Grill", "Air-fry"];

// Step kinds.
export const ADD = 0; // prompt: put the food in
export const TURN = 1; // prompt: flip, rotate, uncover
export const TIMED = 2; // cook for `minutes`

export type Step = {
  kind: number;
  title: string;
  detail: string;
  minutes: number;
  mode: number;
  temp: number;
};

export type Recipe = {
  name: string;
  tagline: string;
  mode: number;
  temp: number;
  minutes: number; // total cooking time, preheat excluded
  steps: Step[];
};

export const RECIPES: Recipe[] = [
  {
    name: "Roast chicken",
    tagline: "Lemon, garlic & rosemary · Serves 4",
    mode: CONVECTION,
    temp: 200,
    minutes: 80,
    steps: [
      {
        kind: ADD,
        title: "Add the chicken",
        detail: "Breast up, on the middle rack.",
        minutes: 0,
        mode: CONVECTION,
        temp: 200,
      },
      { kind: TIMED, title: "Roast", detail: "Until the skin turns golden.", minutes: 45, mode: CONVECTION, temp: 200 },
      {
        kind: TURN,
        title: "Baste & turn",
        detail: "Spoon over the juices, turn the pan.",
        minutes: 0,
        mode: CONVECTION,
        temp: 200,
      },
      { kind: TIMED, title: "Finish", detail: "Until the juices run clear.", minutes: 35, mode: CONVECTION, temp: 200 },
    ],
  },
  {
    name: "Margherita",
    tagline: "Blistered crust, basil · Serves 2",
    mode: BAKE,
    temp: 250,
    minutes: 12,
    steps: [
      {
        kind: ADD,
        title: "Add the pizza",
        detail: "Slide it onto the hot stone, top rack.",
        minutes: 0,
        mode: BAKE,
        temp: 250,
      },
      { kind: TIMED, title: "Bake", detail: "Until the base is crisp.", minutes: 7, mode: BAKE, temp: 250 },
      {
        kind: TURN,
        title: "Rotate the pizza",
        detail: "Half a turn for an even crust.",
        minutes: 0,
        mode: GRILL,
        temp: 250,
      },
      { kind: TIMED, title: "Blister", detail: "Under the grill until it chars.", minutes: 5, mode: GRILL, temp: 250 },
    ],
  },
  {
    name: "Sourdough",
    tagline: "Open crumb, deep ear · 1 loaf",
    mode: BAKE,
    temp: 240,
    minutes: 45,
    steps: [
      { kind: ADD, title: "Load the loaf", detail: "Lid on, on the lower rack.", minutes: 0, mode: BAKE, temp: 240 },
      {
        kind: TIMED,
        title: "Bake covered",
        detail: "The steam lets the loaf spring.",
        minutes: 20,
        mode: BAKE,
        temp: 240,
      },
      { kind: TURN, title: "Remove the lid", detail: "Let the crust take colour.", minutes: 0, mode: BAKE, temp: 230 },
      { kind: TIMED, title: "Bake open", detail: "Until it sounds hollow.", minutes: 25, mode: BAKE, temp: 230 },
    ],
  },
  {
    name: "Crisp salmon",
    tagline: "Asparagus & lemon · Serves 2",
    mode: AIR_FRY,
    temp: 200,
    minutes: 14,
    steps: [
      {
        kind: ADD,
        title: "Add the salmon",
        detail: "Skin down, asparagus around it.",
        minutes: 0,
        mode: AIR_FRY,
        temp: 200,
      },
      { kind: TIMED, title: "Air-fry", detail: "Until the flesh turns opaque.", minutes: 8, mode: AIR_FRY, temp: 200 },
      {
        kind: TURN,
        title: "Flip the fillet",
        detail: "Skin up for a crisp finish.",
        minutes: 0,
        mode: AIR_FRY,
        temp: 200,
      },
      { kind: TIMED, title: "Crisp", detail: "Until the skin crackles.", minutes: 6, mode: AIR_FRY, temp: 200 },
    ],
  },
  {
    name: "Lasagna",
    tagline: "Rich ragu, golden top · Serves 6",
    mode: BAKE,
    temp: 190,
    minutes: 50,
    steps: [
      {
        kind: ADD,
        title: "Add the lasagna",
        detail: "Covered with foil, middle rack.",
        minutes: 0,
        mode: BAKE,
        temp: 190,
      },
      {
        kind: TIMED,
        title: "Bake covered",
        detail: "Until it bubbles at the edges.",
        minutes: 35,
        mode: BAKE,
        temp: 190,
      },
      {
        kind: TURN,
        title: "Remove the foil",
        detail: "Uncover to brown the cheese.",
        minutes: 0,
        mode: GRILL,
        temp: 220,
      },
      { kind: TIMED, title: "Grill", detail: "Until the top is golden.", minutes: 15, mode: GRILL, temp: 220 },
    ],
  },
  {
    name: "Lava cake",
    tagline: "Molten centre, raspberries · Serves 4",
    mode: BAKE,
    temp: 220,
    minutes: 12,
    steps: [
      {
        kind: ADD,
        title: "Add the ramekins",
        detail: "On a tray, on the middle rack.",
        minutes: 0,
        mode: BAKE,
        temp: 220,
      },
      { kind: TIMED, title: "Bake", detail: "Set at the edges, soft inside.", minutes: 12, mode: BAKE, temp: 220 },
      {
        kind: TURN,
        title: "Rest a minute",
        detail: "Then turn out onto the plates.",
        minutes: 0,
        mode: BAKE,
        temp: 220,
      },
    ],
  },
];

export function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest}`;
}
