export const MACRO_TARGETS = {
  calories: 2500,
  protein: 170,
  carbs: 299,
  fat: 69,
}

export const MEAL_PLAN = [
  {
    id: 1,
    name: 'Lunch',
    time: '12:00 PM',
    emoji: '🍚',
    foods: [
      { name: 'Chicken breast mince (raw)', amount: '150g' },
      { name: 'Jasmine rice (dry)', amount: '120g' },
      { name: 'Mixed veggies (frozen)', amount: '150g' },
      { name: 'Canola oil', amount: '10ml' },
    ],
    protein: 47,
    carbs: 110,
    fat: 17,
    calories: 800,
  },
  {
    id: 2,
    name: 'Afternoon',
    time: '3:30 PM',
    emoji: '🍗',
    foods: [
      { name: 'Chicken breast mince (raw)', amount: '180g' },
      { name: 'Jasmine rice (dry)', amount: '100g' },
      { name: 'Mixed veggies (frozen)', amount: '100g' },
      { name: 'Canola oil', amount: '10ml' },
    ],
    protein: 41,
    carbs: 89,
    fat: 24,
    calories: 740,
  },
  {
    id: 3,
    name: 'Pre-Workout',
    time: '7:00 PM',
    emoji: '💪',
    foods: [
      { name: 'Oats (dry)', amount: '80g' },
      { name: 'Zymil low fat milk', amount: '300ml' },
      { name: 'Frozen blueberries', amount: '100g' },
      { name: 'Peanut butter', amount: '25g' },
    ],
    protein: 28,
    carbs: 86,
    fat: 23,
    calories: 660,
  },
  {
    id: 4,
    name: 'Post-Workout',
    time: '11:00 PM',
    emoji: '🥤',
    foods: [
      { name: 'Protein powder', amount: '2 scoops (60g)' },
      { name: 'Zymil low fat milk', amount: '250ml' },
    ],
    protein: 55,
    carbs: 14,
    fat: 5,
    calories: 315,
  },
]

export const SUPPLEMENTS = [
  { id: 'zinc', name: 'Zinc', timing: 'With Meal 1', icon: '🔵' },
  { id: 'vitD', name: 'Vitamin D', timing: 'With Meal 1', icon: '☀️' },
  { id: 'fishOil', name: 'Fish Oil', timing: 'Post-workout shake', icon: '🐟' },
  { id: 'magnesium', name: 'Magnesium Glycinate', timing: 'Before bed', icon: '🌙' },
  { id: 'gaba', name: 'GABA', timing: 'Before bed', icon: '🌙' },
  { id: 'theanine', name: 'L-Theanine', timing: 'Before bed', icon: '🌙' },
]
