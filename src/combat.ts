// Dice combat (classic rules). This is the ONE place combat is resolved (seam: COMBAT).
// Attacker rolls up to 3 dice (must leave 1 army behind), defender up to 2.
// Highest dice compare pairwise; ties go to the DEFENDER; each loss is one army.

import type { Rng } from "./rng.js";

export interface CombatResult {
  readonly attackerRolls: readonly number[];
  readonly defenderRolls: readonly number[];
  readonly attackerLosses: number;
  readonly defenderLosses: number;
}

export function maxAttackDice(attackingArmies: number): number {
  if (!Number.isInteger(attackingArmies) || attackingArmies < 2) {
    throw new Error(`attacker needs at least 2 armies to attack, has ${attackingArmies}`);
  }
  return Math.min(3, attackingArmies - 1);
}

export function maxDefendDice(defendingArmies: number): number {
  if (!Number.isInteger(defendingArmies) || defendingArmies < 1) {
    throw new Error(`defender must have at least 1 army, has ${defendingArmies}`);
  }
  return Math.min(2, defendingArmies);
}

export function resolveBattle(
  rng: Rng,
  attackDice: number,
  defendDice: number,
): CombatResult {
  if (attackDice < 1 || attackDice > 3) throw new Error(`attack dice must be 1..3, got ${attackDice}`);
  if (defendDice < 1 || defendDice > 2) throw new Error(`defend dice must be 1..2, got ${defendDice}`);
  const roll = () => rng.int(6) + 1;
  const attackerRolls = Array.from({ length: attackDice }, roll).sort((a, b) => b - a);
  const defenderRolls = Array.from({ length: defendDice }, roll).sort((a, b) => b - a);
  let attackerLosses = 0;
  let defenderLosses = 0;
  const pairs = Math.min(attackDice, defendDice);
  for (let i = 0; i < pairs; i++) {
    if (attackerRolls[i]! > defenderRolls[i]!) defenderLosses++;
    else attackerLosses++; // ties favour the defender
  }
  return { attackerRolls, defenderRolls, attackerLosses, defenderLosses };
}
