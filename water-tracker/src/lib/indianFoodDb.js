// A small local lookup table of common Indian foods so people can log
// calories by typing a food name instead of guessing a number.
//
// Calories are approximate, per the stated typical serving — these are
// estimates for everyday tracking, not lab-grade nutrition data. Feel free
// to extend this list; it's plain data, no API required.
//
// serving: a short human label shown in the UI (e.g. "1 roti", "1 bowl").
export const INDIAN_FOODS = [
  { name: 'Roti / Chapati', serving: '1 piece', calories: 80 },
  { name: 'Naan', serving: '1 piece', calories: 260 },
  { name: 'Paratha (plain)', serving: '1 piece', calories: 210 },
  { name: 'Aloo Paratha', serving: '1 piece', calories: 300 },
  { name: 'Puri', serving: '1 piece', calories: 100 },
  { name: 'Steamed rice', serving: '1 cup (150g)', calories: 200 },
  { name: 'Jeera rice', serving: '1 cup', calories: 250 },
  { name: 'Biryani (veg)', serving: '1 plate', calories: 450 },
  { name: 'Biryani (chicken)', serving: '1 plate', calories: 550 },
  { name: 'Dal tadka', serving: '1 bowl', calories: 180 },
  { name: 'Dal makhani', serving: '1 bowl', calories: 320 },
  { name: 'Rajma', serving: '1 bowl', calories: 250 },
  { name: 'Chole', serving: '1 bowl', calories: 280 },
  { name: 'Paneer butter masala', serving: '1 bowl', calories: 380 },
  { name: 'Palak paneer', serving: '1 bowl', calories: 300 },
  { name: 'Chicken curry', serving: '1 bowl', calories: 320 },
  { name: 'Butter chicken', serving: '1 bowl', calories: 450 },
  { name: 'Egg curry', serving: '1 bowl', calories: 260 },
  { name: 'Mixed veg sabzi', serving: '1 bowl', calories: 150 },
  { name: 'Aloo sabzi', serving: '1 bowl', calories: 180 },
  { name: 'Bhindi fry', serving: '1 bowl', calories: 160 },
  { name: 'Curd / Dahi', serving: '1 bowl (100g)', calories: 60 },
  { name: 'Raita', serving: '1 bowl', calories: 90 },
  { name: 'Idli', serving: '1 piece', calories: 40 },
  { name: 'Dosa (plain)', serving: '1 piece', calories: 130 },
  { name: 'Masala Dosa', serving: '1 piece', calories: 230 },
  { name: 'Uttapam', serving: '1 piece', calories: 160 },
  { name: 'Sambar', serving: '1 bowl', calories: 100 },
  { name: 'Upma', serving: '1 bowl', calories: 200 },
  { name: 'Poha', serving: '1 bowl', calories: 180 },
  { name: 'Samosa', serving: '1 piece', calories: 260 },
  { name: 'Pakora (mixed veg)', serving: '4 pieces', calories: 200 },
  { name: 'Vada', serving: '1 piece', calories: 150 },
  { name: 'Chai (with sugar)', serving: '1 cup', calories: 60 },
  { name: 'Coffee (with milk & sugar)', serving: '1 cup', calories: 70 },
  { name: 'Lassi (sweet)', serving: '1 glass', calories: 220 },
  { name: 'Buttermilk / Chaas', serving: '1 glass', calories: 40 },
  { name: 'Gulab jamun', serving: '1 piece', calories: 150 },
  { name: 'Rasgulla', serving: '1 piece', calories: 106 },
  { name: 'Jalebi', serving: '1 piece', calories: 150 },
  { name: 'Kheer', serving: '1 bowl', calories: 200 },
  { name: 'Banana', serving: '1 medium', calories: 105 },
  { name: 'Apple', serving: '1 medium', calories: 95 },
  { name: 'Boiled egg', serving: '1 piece', calories: 78 },
  { name: 'Roasted peanuts', serving: '1 small handful (30g)', calories: 170 },
  { name: 'Mixed nuts', serving: '1 small handful (30g)', calories: 190 },
  { name: 'Ghee', serving: '1 tsp', calories: 45 },
  { name: 'Milk (full fat)', serving: '1 glass (200ml)', calories: 130 }
]

export function searchIndianFoods(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return INDIAN_FOODS.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8)
}
