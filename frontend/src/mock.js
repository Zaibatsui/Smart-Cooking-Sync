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

// Oven type conversions (to Fan baseline)
export const normalizeToFan = (temp, ovenType, unit = 'C') => {
  let celsius = unit === 'F' ? convertToCelsius(temp) : temp;
  
  switch(ovenType) {
    case 'Electric':
      return celsius - 20;
    case 'Gas':
      // Approximate conversion from gas mark
      return celsius - 10;
    case 'Fan':
    default:
      return celsius;
  }
};

// Calculate adjusted cooking time based on temperature difference
export const adjustCookingTime = (originalTime, originalTemp, newTemp) => {
  // Higher temp = shorter time, lower temp = longer time
  const tempRatio = originalTemp / newTemp;
  return Math.round(originalTime * tempRatio);
};