export const SHOPPING_LIST = [
  {
    category: '🥩 Meat',
    items: [
      { name: 'Chicken Breast Mince', qty: '2.5kg (5 × 500g packs)', note: 'Lilydale or Coles brand · ~$7-8/500g · 1.25kg per cook (Sun + Wed)', store: 'both' },
    ],
  },
  {
    category: '🍌 Produce',
    items: [
      { name: 'Bananas', qty: '7 per week (1/day)', note: '~$0.30-0.50 each · post-workout shake · keep on bench, not fridge', store: 'both' },
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
      { name: 'MasterFoods Chicken Alfredo Recipe Base (170g pouches)', qty: '2 pouches per week', note: '~$3-4 per pouch · 1 full pouch (170g) mixed into the pan during cooking · 2 cooks per week (Sun + Wed)', store: 'both' },
      { name: 'Uncle Tobys Quick Oats Sachets (or Weetbix)', qty: '8-pack box / 750g Weetbix', note: '~$4-5 each · pre-workout base', store: 'both' },
      { name: 'Milk Powder', qty: 'Small tin', note: '~$5-8 · for morning coffee', store: 'both' },
      { name: 'Sugar', qty: '1kg bag', note: '~$2 · 2 tsp per day · lasts weeks', store: 'both' },
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
    subtitle: '1.25kg raw per cook → 7 serves (covers 3.5 days of lunch + dinner)',
    prepTime: '20 min',
    stores: 7,
    seasonings: ['Garlic powder', 'Smoked paprika', 'Mixed Italian herbs', 'Salt', 'Black pepper'],
    steps: [
      'WEEKLY BATCH: Cook twice — Sunday + Wednesday. Each cook: 1.25kg raw → ~940g cooked → 7 containers of 135g each',
      'RECIPE BASE: 1 full pouch (170g) MasterFoods Chicken Alfredo Recipe Base per cook — mixed into the pan DURING cooking, not added after. Weekly total: 2 pouches.',
      'Heat a large non-stick pan over medium-high heat with a small dash of oil or cooking spray',
      'Add 1.25kg chicken breast mince — break up immediately with a wooden spoon',
      'Season: 1.5 tsp garlic powder, 1.5 tsp smoked paprika, 1.5 tsp Italian herbs, salt and pepper to taste',
      'Cook 6-8 mins, stirring every 2 mins, until mostly cooked through and no longer pink',
      'Pour in 1 full pouch (170g) MasterFoods Chicken Alfredo Recipe Base — stir through until evenly coated through the mince',
      'Cook a further 3-4 mins, stirring, until sauce is absorbed and mince is golden. Taste and adjust seasoning.',
      'Let cool 10 mins. Weigh into 7 containers of 135g cooked chicken each — sauce is already evenly distributed through the meat',
      'Refrigerate up to 4 days. Repeat Wednesday.',
    ],
    tip: '💡 Raw:cooked ratio is ~4:3 (1.25kg raw → ~940g cooked). Weigh AFTER cooking — the sauce is cooked in, so just weigh the full cooked mixture and divide equally. 135g per container = chicken + sauce combined. Per container: ~24g recipe base (P~0.6g, C~4g, F~0.3g, ~22kcal).',
  },
  {
    id: 'rice',
    emoji: '🍚',
    title: 'Jasmine Rice',
    subtitle: '700g dry per cook → 7 serves of 280g cooked (covers 3.5 days)',
    prepTime: '20 min',
    stores: 7,
    seasonings: [],
    steps: [
      'WEEKLY BATCH: Cook twice — Sunday + Wednesday. Each cook: 700g dry → ~1,960g cooked → 7 containers of 280g each',
      'Weigh 700g jasmine rice dry (100g dry = ~280g cooked)',
      'Rinse under cold water until water runs mostly clear (~30 seconds)',
      'Add to pot with 1,050ml cold water (1:1.5 ratio)',
      'Bring to boil uncovered, then reduce to lowest heat, cover with lid',
      'Cook 12 mins — do not lift the lid',
      'Remove from heat, leave covered 5 more mins — still don\'t lift the lid',
      'Fluff with a fork. Divide into 7 containers of 280g cooked each',
      'Refrigerate up to 4 days. Repeat Wednesday.',
    ],
    tip: '💡 100g dry = ~280g cooked. Weigh AFTER cooking: 280g per container. Sunday batch covers 3.5 days, Wednesday batch covers the rest of the week.',
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
      'Option A — Uncle Tobys Quick Oats: Empty 1 sachet into a bowl, add 200ml Zymil milk, microwave 90 seconds, stir',
      'Option B — Weetbix: Place 2 biscuits in a bowl, pour 200ml Zymil milk over them, let sit 1-2 mins to soften',
      'Mix in 1 scoop (30g) protein powder — stir well so it doesn\'t clump',
      'Add 100g frozen blueberries on top — they thaw in a couple of minutes from the warm bowl',
      'Eat at 9pm — 1 hour before your 10pm session',
    ],
    tip: '💡 At 1hr out, keep fat low — that\'s why peanut butter is removed from this meal. Fat slows digestion and can make you feel heavy in the gym.',
  },
  {
    id: 'post_workout',
    emoji: '🥤',
    title: 'Post-Workout Shake (11pm)',
    subtitle: 'Protein + milk + banana — 2 min, no cooking',
    prepTime: '2 min',
    stores: 0,
    seasonings: [],
    steps: [
      'Add 1 scoop (30g) protein powder to a large glass or shaker',
      'Pour 250ml Zymil milk — shake or stir until smooth',
      'Eat 1 medium banana (~120g) alongside — don\'t blend it in, just eat it',
      'Take fish oil supplement with this shake',
      'Drink within 30 mins of finishing training — don\'t wait',
    ],
    tip: '💡 The banana adds 25g carbs for glycogen replenishment post-training. Keep bananas on the bench — they ripen faster in the fridge. Buy 7 on Sunday.',
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
      'Pour 150g (Lunch) or 100g (Dinner) frozen veggies straight from the bag into a microwave-safe bowl',
      'Microwave on high 3-4 mins — no water needed',
      'Season with salt and pepper — that\'s it',
      'No oil needed — the MasterFoods Chicken Alfredo sauce is cooked into the chicken and provides all the flavour',
    ],
    tip: '💡 Frozen veggies keep almost all their nutrients — no reason to buy fresh. Cheaper and no prep.',
  },
]
