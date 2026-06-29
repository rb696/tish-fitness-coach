export const MACRO_TARGETS = {
  calories: 2070,
  protein: 155,
  carbs: 246,
  fat: 50,
}

export const MEAL_PLAN = [
  {
    id: 1,
    name: 'Lunch',
    time: '12:00 PM',
    emoji: '🍚',
    foods: [
      { name: 'Chicken breast mince (raw)', amount: '150g' },
      { name: 'Jasmine rice (dry)', amount: '100g' },
      { name: 'Mixed veggies (frozen)', amount: '150g' },
      { name: 'Canola oil', amount: '10ml' },
    ],
    protein: 47,
    carbs: 93,
    fat: 17,
    calories: 730,
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
    time: '9:00 PM',
    emoji: '💪',
    foods: [
      { name: 'Uncle Tobys Quick Oats sachet (or 2 Weetbix)', amount: '1 sachet / 2 biscuits' },
      { name: 'Zymil low fat milk', amount: '250ml' },
      { name: 'Protein powder', amount: '1 scoop (30g)' },
      { name: 'Frozen blueberries', amount: '100g' },
    ],
    protein: 36,
    carbs: 52,
    fat: 6,
    calories: 395,
  },
  {
    id: 4,
    name: 'Post-Workout',
    time: '11:00 PM',
    emoji: '🥤',
    foods: [
      { name: 'Protein powder', amount: '1 scoop (30g)' },
      { name: 'Zymil low fat milk', amount: '250ml' },
    ],
    protein: 31,
    carbs: 12,
    fat: 3,
    calories: 205,
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
