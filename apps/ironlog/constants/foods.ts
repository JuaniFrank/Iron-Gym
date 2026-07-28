import type { FoodItem } from "@/types";

const f = (
  id: string,
  name: string,
  caloriesPer100g: number,
  proteinPer100g: number,
  carbsPer100g: number,
  fatPer100g: number,
  defaultServingG?: number,
): FoodItem => ({ id, name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, defaultServingG });

export const FOOD_DATABASE: FoodItem[] = [
  // Proteínas
  f("food-1", "Pechuga de pollo", 165, 31, 0, 3.6, 150),
  f("food-2", "Huevo entero", 155, 13, 1.1, 11, 50),
  f("food-3", "Clara de huevo", 52, 11, 0.7, 0.2, 33),
  f("food-4", "Atún en agua", 116, 26, 0, 1, 100),
  f("food-5", "Salmón", 208, 20, 0, 13, 150),
  f("food-6", "Carne molida 90/10", 184, 21, 0, 11, 120),
  f("food-7", "Filete de res", 271, 26, 0, 19, 150),
  f("food-8", "Yogur griego natural", 59, 10, 3.6, 0.4, 170),
  f("food-9", "Queso cottage", 98, 11, 3.4, 4.3, 120),
  f("food-10", "Whey protein (1 scoop)", 380, 75, 8, 4, 30),
  f("food-11", "Tofu firme", 144, 17, 3, 9, 100),
  f("food-12", "Tilapia", 96, 20, 0, 1.7, 120),
  f("food-13", "Camarones", 99, 24, 0.2, 0.3, 100),
  f("food-14", "Lomo de cerdo", 143, 26, 0, 3.5, 150),
  // Carbohidratos
  f("food-15", "Arroz blanco cocido", 130, 2.7, 28, 0.3, 150),
  f("food-16", "Arroz integral cocido", 112, 2.6, 24, 0.9, 150),
  f("food-17", "Avena", 379, 13, 67, 7, 40),
  f("food-18", "Pasta cocida", 158, 5.8, 31, 0.9, 150),
  f("food-19", "Patata cocida", 87, 1.9, 20, 0.1, 200),
  f("food-20", "Batata cocida", 86, 2, 20, 0.1, 200),
  f("food-21", "Pan integral", 247, 13, 41, 4.2, 50),
  f("food-22", "Tortilla de trigo", 295, 8, 50, 7, 40),
  f("food-23", "Quinoa cocida", 120, 4.4, 21, 1.9, 150),
  f("food-24", "Lentejas cocidas", 116, 9, 20, 0.4, 150),
  f("food-25", "Frijoles negros cocidos", 132, 8.9, 24, 0.5, 150),
  // Grasas
  f("food-26", "Aguacate", 160, 2, 9, 15, 100),
  f("food-27", "Almendras", 579, 21, 22, 50, 30),
  f("food-28", "Nueces", 654, 15, 14, 65, 30),
  f("food-29", "Mantequilla de maní", 588, 25, 20, 50, 32),
  f("food-30", "Aceite de oliva", 884, 0, 0, 100, 14),
  // Frutas
  f("food-31", "Plátano", 89, 1.1, 23, 0.3, 120),
  f("food-32", "Manzana", 52, 0.3, 14, 0.2, 180),
  f("food-33", "Fresas", 32, 0.7, 7.7, 0.3, 150),
  f("food-34", "Arándanos", 57, 0.7, 14, 0.3, 100),
  f("food-35", "Naranja", 47, 0.9, 12, 0.1, 130),
  f("food-36", "Sandía", 30, 0.6, 8, 0.2, 200),
  // Verduras
  f("food-37", "Brócoli", 34, 2.8, 7, 0.4, 100),
  f("food-38", "Espinaca", 23, 2.9, 3.6, 0.4, 50),
  f("food-39", "Pepino", 15, 0.7, 3.6, 0.1, 150),
  f("food-40", "Tomate", 18, 0.9, 3.9, 0.2, 120),
  // Lácteos
  f("food-41", "Leche entera", 61, 3.2, 4.8, 3.3, 250),
  f("food-42", "Leche descremada", 34, 3.4, 5, 0.1, 250),
  f("food-43", "Queso mozzarella", 280, 28, 3.1, 17, 30),
  f("food-44", "Queso parmesano", 392, 36, 4.1, 26, 15),
  // Snacks comunes
  f("food-45", "Barra de proteína", 350, 30, 35, 9, 60),
  f("food-46", "Chocolate negro 70%", 598, 7.8, 46, 43, 25),
  f("food-47", "Galletas de avena", 437, 7, 65, 16, 25),
];
