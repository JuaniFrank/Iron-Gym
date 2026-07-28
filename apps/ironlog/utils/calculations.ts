import type { UserProfile } from "@/types";

export function calculateBMR(profile: Pick<UserProfile, "sex" | "age" | "weightKg" | "heightCm">): number {
  // Mifflin-St Jeor
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === "male" ? base + 5 : base - 161;
}

const ACTIVITY_FACTORS: Record<UserProfile["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export function calculateTDEE(profile: UserProfile): number {
  const bmr = calculateBMR(profile);
  return Math.round(bmr * ACTIVITY_FACTORS[profile.activityLevel]);
}

export function calorieGoalForGoal(tdee: number, goal: UserProfile["goal"]): number {
  switch (goal) {
    case "lose":
      return Math.round(tdee - 500);
    case "gain":
      return Math.round(tdee + 400);
    case "muscle":
      return Math.round(tdee + 250);
    case "maintain":
    default:
      return tdee;
  }
}

export function macroSplitForGoal(
  calories: number,
  weightKg: number,
  goal: UserProfile["goal"],
): { protein: number; carbs: number; fat: number } {
  // Protein: 2g/kg for muscle/cutting, 1.6g/kg for maintain, 1.4g/kg for gain
  let proteinPerKg = 2.0;
  if (goal === "maintain") proteinPerKg = 1.8;
  if (goal === "gain") proteinPerKg = 1.8;
  const protein = Math.round(weightKg * proteinPerKg);
  const fatCalories = Math.round(calories * 0.25);
  const fat = Math.round(fatCalories / 9);
  const proteinCalories = protein * 4;
  const remainingCalories = Math.max(0, calories - proteinCalories - fatCalories);
  const carbs = Math.round(remainingCalories / 4);
  return { protein, carbs, fat };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Bajo peso", color: "#3B82F6" };
  if (bmi < 25) return { label: "Saludable", color: "#10B981" };
  if (bmi < 30) return { label: "Sobrepeso", color: "#F59E0B" };
  return { label: "Obesidad", color: "#EF4444" };
}

// US Navy body fat formula (returns percentage)
export function navyBodyFat(
  sex: "male" | "female",
  heightCm: number,
  neckCm: number,
  waistCm: number,
  hipCm?: number,
): number | null {
  if (!heightCm || !neckCm || !waistCm) return null;
  if (sex === "male") {
    if (waistCm <= neckCm) return null;
    const bf =
      495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) -
      450;
    return Math.max(0, bf);
  }
  if (!hipCm) return null;
  if (waistCm + hipCm <= neckCm) return null;
  const bf =
    495 /
      (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) -
    450;
  return Math.max(0, bf);
}

export function kgToLb(kg: number): number {
  return kg * 2.20462;
}
export function lbToKg(lb: number): number {
  return lb / 2.20462;
}
export function cmToIn(cm: number): number {
  return cm / 2.54;
}
export function inToCm(inch: number): number {
  return inch * 2.54;
}

export function formatWeight(kg: number, units: "metric" | "imperial"): string {
  if (units === "imperial") return `${kgToLb(kg).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

export function formatLength(cm: number, units: "metric" | "imperial"): string {
  if (units === "imperial") return `${cmToIn(cm).toFixed(1)} in`;
  return `${cm.toFixed(1)} cm`;
}
