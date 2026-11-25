import assert from "node:assert/strict";
import test from "node:test";
import { bestHand, compareScores, describeHand, scoreFive } from "./pokerRules.js";

const card = (value, suit = "spades") => ({ value, suit });

test("ranks a royal flush above every other hand", () => {
  const score = scoreFive([10, 11, 12, 13, 14].map((value) => card(value, "hearts")));
  assert.deepEqual(score, [8, 14]);
});

test("recognizes the ace-low wheel straight", () => {
  const score = scoreFive([
    card(14, "spades"), card(2, "hearts"), card(3, "diamonds"), card(4, "clubs"), card(5, "spades"),
  ]);
  assert.deepEqual(score, [4, 5]);
});

test("uses kickers to decide equal pairs", () => {
  const acePairWithKingKicker = scoreFive([card(14), card(14, "hearts"), card(13), card(9, "hearts"), card(4, "clubs")]);
  const acePairWithQueenKicker = scoreFive([card(14), card(14, "hearts"), card(12), card(11, "hearts"), card(4, "clubs")]);
  assert.equal(compareScores(acePairWithKingKicker, acePairWithQueenKicker), 1);
  assert.match(describeHand(acePairWithKingKicker), /kickers K, 9, 4/);
});

test("compares two-pair hands by both pairs and then the kicker", () => {
  const strongerKicker = scoreFive([card(14), card(14, "hearts"), card(8), card(8, "clubs"), card(13)]);
  const weakerKicker = scoreFive([card(14), card(14, "hearts"), card(8), card(8, "clubs"), card(12)]);
  assert.deepEqual(strongerKicker, [2, 14, 8, 13]);
  assert.equal(compareScores(strongerKicker, weakerKicker), 1);
});

test("chooses the best five-card hand from all seven cards", () => {
  const score = bestHand([
    card(14, "hearts"), card(13, "hearts"), card(12, "hearts"), card(11, "hearts"),
    card(10, "hearts"), card(2), card(2, "clubs"),
  ]);
  assert.deepEqual(score, [8, 14]);
});

test("rejects incomplete hands rather than scoring them silently", () => {
  assert.throws(() => scoreFive([card(14), card(13), card(12), card(11)]), RangeError);
  assert.throws(() => bestHand([card(14), card(13), card(12), card(11)]), RangeError);
});
