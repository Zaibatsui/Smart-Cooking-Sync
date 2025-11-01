// Mock data for Smart Cooking Sync app

export const mockDishes = [
  {
    id: '1',
    name: 'Roast Potatoes',
    temperature: 220,
    unit: 'C',
    cookingTime: 35,
    ovenType: 'Electric'
  },
  {
    id: '2',
    name: 'Salmon Fillet',
    temperature: 200,
    unit: 'C',
    cookingTime: 15,
    ovenType: 'Fan'
  },
  {
    id: '3',
    name: 'Roasted Carrots',
    temperature: 180,
    unit: 'C',
    cookingTime: 25,
    ovenType: 'Gas'
  }
];

export const ovenTypes = ['Fan', 'Electric', 'Gas'];

export const temperatureUnits = ['C', 'F'];

// Temperature conversion utilities
export const convertToFahrenheit = (celsius) => {
  return Math.round((celsius * 9/5) + 32);
};

export const convertToCelsius = (fahrenheit) => {
  return Math.round((fahrenheit - 32) * 5/9);
};

// Round to nearest 10 (ovens work in 10°C increments)
export const roundToNearestTen = (temp) => {
  return Math.round(temp / 10) * 10;
};

// Oven type conversions (to Fan baseline)
// Standard conversion rules:
// - Fan ovens run ~20°C cooler than conventional/electric ovens
// - Gas marks are roughly equivalent to: Mark 4 = 180°C, Mark 5 = 190°C, Mark 6 = 200°C
export const normalizeToFan = (temp, ovenType, unit = 'C') => {
  let celsius = unit === 'F' ? convertToCelsius(temp) : temp;
  
  switch(ovenType) {
    case 'Electric':
      // Electric to Fan: subtract 20°C
      return celsius - 20;
    case 'Gas':
      // Gas marks are usually conventional temps, so subtract 20°C for fan
      return celsius - 20;
    case 'Fan':
    default:
      return celsius;
  }
};

// Calculate adjusted cooking time based on temperature difference
// Rule of thumb: Every 10°C difference = ~10-15% time adjustment
export const adjustCookingTime = (originalTime, originalTemp, newTemp) => {
  if (originalTemp === newTemp) return originalTime;
  
  // Calculate percentage difference
  const tempDiff = newTemp - originalTemp;
  const percentChange = (tempDiff / originalTemp) * 100;
  
  // Adjust time inversely: higher temp = shorter time
  // Roughly 1.5% time change per 1% temp change
  const timeAdjustment = percentChange * -1.5;
  const adjustedTime = originalTime * (1 + timeAdjustment / 100);
  
  return Math.round(adjustedTime);
};