export function compareScores(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function getStraightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  let run = 1;
  for (let index = 0; index < unique.length - 1; index += 1) {
    if (unique[index] - 1 === unique[index + 1]) {
      run += 1;
      if (run >= 5) return unique[index + 1] + 4;
    } else {
      run = 1;
    }
  }
  return 0;
}

export function scoreFive(cards) {
  if (cards.length !== 5) throw new RangeError("A poker hand must contain exactly five cards.");
  const values = cards.map((card) => card.value).sort((a, b) => b - a);
  const counts = new Map();
  cards.forEach((card) => counts.set(card.value, (counts.get(card.value) ?? 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(values);
  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...values];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][1] === 3) {
    return [3, groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)];
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return [2, ...pairs, groups[2][0]];
  }
  if (groups[0][1] === 2) {
    return [1, groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)];
  }
  return [0, ...values];
}

function combinations(cards, size, start = 0, selected = [], output = []) {
  if (selected.length === size) {
    output.push(selected);
    return output;
  }
  for (let index = start; index <= cards.length - (size - selected.length); index += 1) {
    combinations(cards, size, index + 1, [...selected, cards[index]], output);
  }
  return output;
}

export function bestHand(cards) {
  if (cards.length < 5 || cards.length > 7) throw new RangeError("Texas Hold'em hands need five to seven cards.");
  return combinations(cards, 5).map(scoreFive).sort((a, b) => compareScores(b, a))[0];
}

export function describeHand(score) {
  const rankName = (value) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[value] ?? String(value);
  const kickers = (values) => values.map(rankName).join(", ");
  if (score[0] === 8) return `Escalera de color · ${rankName(score[1])} alta`;
  if (score[0] === 7) return `Poker de ${rankName(score[1])} · ${rankName(score[2])} de kicker`;
  if (score[0] === 6) return `Full house · ${rankName(score[1])} y ${rankName(score[2])}`;
  if (score[0] === 5) return `Color · ${kickers(score.slice(1))}`;
  if (score[0] === 4) return `Escalera · ${rankName(score[1])} alta`;
  if (score[0] === 3) return `Trío de ${rankName(score[1])} · kickers ${kickers(score.slice(2))}`;
  if (score[0] === 2) return `Doble pareja · ${rankName(score[1])} y ${rankName(score[2])}, kicker ${rankName(score[3])}`;
  if (score[0] === 1) return `Pareja de ${rankName(score[1])} · kickers ${kickers(score.slice(2))}`;
  return `Carta alta · ${kickers(score.slice(1))}`;
}
