export const tableSettings = {
  name: "Royal Poker Club",
  variant: "Texas Hold'em",
  startingChips: 2500,
  ante: 25,
  actionAmount: 20,
  minimumRaise: 20,
};

export const simulatedPlayers = [
  { id: "luna", name: "Luna", avatar: "L", style: "patient", chips: 1500, color: "violet", cards: [] },
  { id: "marco", name: "Marco", avatar: "M", style: "aggressive", chips: 1500, color: "blue", cards: [] },
  { id: "ines", name: "Inés", avatar: "I", style: "balanced", chips: 1500, color: "rose", cards: [] },
];

export const handNames = [
  "Carta alta",
  "Pareja",
  "Doble pareja",
  "Trío",
  "Escalera",
  "Color",
  "Full house",
  "Poker",
  "Escalera de color",
];
