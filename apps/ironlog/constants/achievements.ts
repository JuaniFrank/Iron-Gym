import type { Achievement } from "@/types";

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-workout",
    title: "Primera sesión",
    description: "Completaste tu primer entrenamiento. ¡Bienvenido!",
    icon: "award",
    check: (s) => s.sessions.length >= 1,
  },
  {
    id: "first-week",
    title: "Primera semana",
    description: "Entrenaste 3 veces en una semana.",
    icon: "calendar",
    check: (s) => s.streak >= 3,
  },
  {
    id: "ten-workouts",
    title: "10 entrenamientos",
    description: "Llegaste a 10 sesiones registradas.",
    icon: "target",
    check: (s) => s.sessions.length >= 10,
  },
  {
    id: "fifty-workouts",
    title: "50 entrenamientos",
    description: "Medio centenar de sesiones. Eres consistente.",
    icon: "shield",
    check: (s) => s.sessions.length >= 50,
  },
  {
    id: "hundred-workouts",
    title: "100 entrenamientos",
    description: "Centurión del hierro. ¡Imparable!",
    icon: "star",
    check: (s) => s.sessions.length >= 100,
  },
  {
    id: "streak-7",
    title: "Racha de 7 días",
    description: "Una semana entrenando seguidos.",
    icon: "zap",
    check: (s) => s.streak >= 7,
  },
  {
    id: "streak-30",
    title: "30 días seguidos",
    description: "Un mes de constancia. Eres otra persona.",
    icon: "trending-up",
    check: (s) => s.streak >= 30,
  },
  {
    id: "first-pr",
    title: "Primer PR",
    description: "Rompiste tu primer récord personal.",
    icon: "trophy",
    check: (s) => s.prs.length >= 1,
  },
  {
    id: "ten-prs",
    title: "10 PRs",
    description: "Diez récords personales conseguidos.",
    icon: "crown",
    check: (s) => s.prs.length >= 10,
  },
  {
    id: "bench-100",
    title: "100kg en press de banca",
    description: "Hito clásico de fuerza. Tres dígitos en banca.",
    icon: "anchor",
    check: (s) =>
      s.prs.some(
        (p) => p.exerciseId === "chest-1" && p.type === "weight" && p.value >= 100,
      ),
  },
  {
    id: "squat-140",
    title: "140kg en sentadilla",
    description: "Sentadilla pesada. Las piernas son un templo.",
    icon: "anchor",
    check: (s) =>
      s.prs.some(
        (p) => p.exerciseId === "q-1" && p.type === "weight" && p.value >= 140,
      ),
  },
  {
    id: "deadlift-180",
    title: "180kg en peso muerto",
    description: "Peso muerto pesado. Fuerza pura.",
    icon: "anchor",
    check: (s) =>
      s.prs.some(
        (p) => p.exerciseId === "back-7" && p.type === "weight" && p.value >= 180,
      ),
  },
  {
    id: "weight-tracker",
    title: "Seguimiento corporal",
    description: "Registraste tu peso 10 veces.",
    icon: "activity",
    check: (s) => s.bodyWeights.length >= 10,
  },
];
