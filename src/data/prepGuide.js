export const SHOPPING_LIST = [
  {
    category: '🥩 Meat',
    items: [
      { name: 'Chicken Breast Mince', qty: '2.5kg (5 × 500g packs)', note: 'Lilydale or Coles brand · ~$7-8/500g', store: 'both' },
    ],
  },
  {
    category: '🧊 Frozen',
    items: [
      { name: 'Frozen Mixed Vegetables', qty: '2kg (2 × 1kg bags)', note: '~$3.50/kg', store: 'both' },
      { name: 'Frozen Blueberries', qty: '1kg bag', note: '~$8-10 · usually cheaper at Woolworths', store: 'woolworths' },
    ],
  },
  {
    category: '🥛 Dairy',
    items: [
      { name: 'Zymil Low Fat Lactose Free Milk', qty: '4L (2 × 2L bottles)', note: '~$5/2L · lactose-free section', store: 'both' },
    ],
  },
  {
    category: '🌾 Pantry',
    items: [
      { name: 'Jasmine Rice', qty: '2kg bag', note: '~$5-8 · lasts ~2 weeks', store: 'both' },
      { name: 'Uncle Tobys Quick Oats Sachets', qty: '8-pack box', note: '~$4-5 · or swap for Weetbix 375g · pre-workout base', store: 'both' },
      { name: 'Peanut Butter (natural)', qty: '375g jar', note: '~$5-6 · Mayver\'s or Fix & Fogg · lasts ~3 weeks', store: 'both' },
      { name: 'Canola Oil', qty: '1L bottle', note: '~$4-5 · lasts months', store: 'both' },
    ],
  },
  {
    category: '💪 Supplements',
    items: [
      { name: 'Protein Powder (whey)', qty: '1kg bag', note: 'Not at supermarket — MyProtein or Bulk Nutrients online is cheapest', store: 'online' },
    ],
  },
]

export const COOK_GUIDES = [
  {
    id: 'chicken',
    emoji: '🍗',
    title: 'Chicken Breast Mince',
    subtitle: '1kg = 3 days of meals (2 serves per day)',
    prepTime: '15 min',
    stores: 4,
    seasonings: ['Garlic powder', 'Smoked paprika', 'Mixed Italian herbs', 'Salt', 'Black pepper'],
    steps: [
      'Heat 1 tsp canola oil in a large non-stick pan over medium-high heat',
      'Add 1kg chicken breast mince — break it up with a wooden spoon immediately',
      'Season: 1 tsp garlic powder, 1 tsp smoked paprika, 1 tsp Italian herbs, salt and pepper to taste',
      'Cook 8-10 mins, stirring every 2 mins, until no pink remains and mince is slightly golden',
      'Taste and adjust seasoning — don\'t under-season, it\'ll be eaten cold from the fridge',
      'Let cool 10 mins before portioning into 6 containers (~165g each)',
      'Refrigerate up to 4 days — cook again Wednesday to stay fresh',
    ],
    tip: '💡 Cook Sunday + Wednesday. 2 sessions covers your whole week.',
  },
  {
    id: 'rice',
    emoji: '🍚',
    title: 'Jasmine Rice',
    subtitle: '440g dry = 4 days of rice (2 serves per day)',
    prepTime: '20 min',
    stores: 4,
    seasonings: [],
    steps: [
      'Weigh 440g jasmine rice dry (220g × 2 meals/day = your daily amount for 4 days — but cook as one big batch)',
      'Rinse under cold water until water runs mostly clear (~30 seconds)',
      'Add to pot with 660ml cold water (1:1.5 ratio)',
      'Bring to boil uncovered, then reduce to lowest heat, cover with lid',
      'Cook 12 mins — do not lift the lid',
      'Remove from heat, leave covered 5 more mins — still don\'t lift the lid',
      'Fluff with a fork. Divide into 8 containers (~150g cooked each = ~55g dry equivalent)',
      'Refrigerate up to 4 days',
    ],
    tip: '💡 Always weigh rice DRY before cooking. 120g dry = ~310g cooked. Cooked weights vary too much to track accurately.',
  },
  {
    id: 'oats',
    emoji: '🥣',
    title: 'Pre-Workout Meal (9pm · 1hr before training)',
    subtitle: 'Uncle Tobys sachet or Weetbix + protein — fast and easy',
    prepTime: '3 min',
    stores: 0,
    seasonings: [],
    steps: [
      'Option A — Uncle Tobys Quick Oats: Empty 1 sachet into a bowl, add 250ml Zymil milk, microwave 90 seconds, stir',
      'Option B — Weetbix: Place 2 biscuits in a bowl, pour 250ml Zymil milk over them, let sit 1-2 mins to soften',
      'Mix in 1 scoop (30g) protein powder — stir well so it doesn\'t clump',
      'Add 100g frozen blueberries on top — they thaw in a couple of minutes from the warm bowl',
      'Eat at 9pm — 1 hour before your 10pm session',
    ],
    tip: '💡 At 1hr out, keep fat low — that\'s why peanut butter is removed from this meal. Fat slows digestion and can make you feel heavy in the gym.',
  },
  {
    id: 'veggies',
    emoji: '🥦',
    title: 'Mixed Vegetables',
    subtitle: 'No prep needed — cook straight from frozen',
    prepTime: '4 min',
    stores: 0,
    seasonings: ['Salt', 'Black pepper'],
    steps: [
      'Pour 150g (Meal 1) or 100g (Meal 2) frozen veggies straight from the bag into a microwave-safe bowl',
      'Microwave on high 3-4 mins — no water needed',
      'Season with salt and pepper — that\'s it',
      'No oil needed here — you\'re already getting fat from the canola oil in the chicken',
    ],
    tip: '💡 Frozen veggies keep almost all their nutrients — no reason to buy fresh. Cheaper and no prep.',
  },
]
