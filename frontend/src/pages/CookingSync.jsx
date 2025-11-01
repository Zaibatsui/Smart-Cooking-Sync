import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Clock, Flame, Settings, Trash2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Progress } from '../components/ui/progress';
import { toast } from '../hooks/use-toast';
import { 
  ovenTypes, 
  temperatureUnits, 
  convertToFahrenheit, 
  convertToCelsius,
  normalizeToFan,
  adjustCookingTime,
  roundToNearestTen 
} from '../mock';

const CookingSync = () => {
  const [dishes, setDishes] = useState([]);
  const [userOvenType, setUserOvenType] = useState('Fan');
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState('light');
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    temperature: '',
    unit: 'C',
    cookingTime: '',
    ovenType: 'Fan'
  });

  // Cooking timers state
  const [timers, setTimers] = useState({});
  const [activeAlarms, setActiveAlarms] = useState({}); // Track which timers have active alarms
  const [alarmIntervals, setAlarmIntervals] = useState({}); // Store alarm interval IDs

  // Load saved data from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cookingSyncData');
    if (saved) {
      const data = JSON.parse(saved);
      setDishes(data.dishes || []);
      setUserOvenType(data.userOvenType || 'Fan');
      setTheme(data.theme || 'light');
      setAlarmEnabled(data.alarmEnabled !== undefined ? data.alarmEnabled : true);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('cookingSyncData', JSON.stringify({
      dishes,
      userOvenType,
      theme,
      alarmEnabled
    }));
  }, [dishes, userOvenType, theme, alarmEnabled]);

  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Calculate optimal cooking plan
  const cookingPlan = useMemo(() => {
    if (dishes.length === 0) return null;

    // Normalize all temperatures to user's oven type baseline
    const normalizedDishes = dishes.map(dish => {
      const normalizedTemp = normalizeToFan(dish.temperature, dish.ovenType, dish.unit);
      return {
        ...dish,
        normalizedTemp
      };
    });

    // Find optimal common temperature (average of normalized temps)
    const avgTemp = Math.round(
      normalizedDishes.reduce((sum, d) => sum + d.normalizedTemp, 0) / normalizedDishes.length
    );
    
    // Round to nearest 10°C (ovens work in 10°C increments)
    const commonTemp = roundToNearestTen(avgTemp);

    // Adjust cooking times based on temperature difference
    const adjustedDishes = normalizedDishes.map(dish => {
      const adjustedTime = adjustCookingTime(
        dish.cookingTime,
        dish.normalizedTemp,
        commonTemp
      );
      return {
        ...dish,
        adjustedTime,
        timeDifference: adjustedTime - dish.cookingTime
      };
    });

    // Sort by adjusted cooking time (longest first)
    const sorted = [...adjustedDishes].sort((a, b) => b.adjustedTime - a.adjustedTime);

    // Calculate start times (all finish together)
    const maxTime = sorted[0].adjustedTime;
    const timeline = sorted.map(dish => ({
      ...dish,
      startDelay: maxTime - dish.adjustedTime,
      finishTime: maxTime
    }));

    return {
      commonTemp,
      timeline,
      totalTime: maxTime
    };
  }, [dishes, userOvenType]);

  const handleAddDish = () => {
    if (!formData.name || !formData.temperature || !formData.cookingTime) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }

    const newDish = {
      id: Date.now().toString(),
      name: formData.name,
      temperature: parseFloat(formData.temperature),
      unit: formData.unit,
      cookingTime: parseInt(formData.cookingTime),
      ovenType: formData.ovenType
    };

    setDishes([...dishes, newDish]);
    setFormData({
      name: '',
      temperature: '',
      unit: 'C',
      cookingTime: '',
      ovenType: 'Fan'
    });
    
    toast({
      title: 'Dish Added',
      description: `${newDish.name} has been added to your cooking plan`
    });
  };

  const handleRemoveDish = (id) => {
    setDishes(dishes.filter(d => d.id !== id));
    const newTimers = { ...timers };
    delete newTimers[id];
    setTimers(newTimers);
    
    toast({
      title: 'Dish Removed',
      description: 'Dish has been removed from your plan'
    });
  };

  const startCooking = (dishId) => {
    const dish = cookingPlan.timeline.find(d => d.id === dishId);
    if (!dish) return;

    setTimers(prev => ({
      ...prev,
      [dishId]: {
        remaining: dish.adjustedTime * 60, // Convert to seconds
        total: dish.adjustedTime * 60,
        isRunning: true
      }
    }));

    toast({
      title: 'Cooking Started',
      description: `Timer started for ${dish.name}`
    });
  };

  const toggleTimer = (dishId) => {
    setTimers(prev => ({
      ...prev,
      [dishId]: {
        ...prev[dishId],
        isRunning: !prev[dishId].isRunning
      }
    }));
  };

  const resetTimer = (dishId) => {
    const newTimers = { ...timers };
    delete newTimers[dishId];
    setTimers(newTimers);
    stopAlarm(dishId); // Stop alarm if it's ringing
  };

  const resetAll = () => {
    setTimers({});
    setCookingStarted(false);
    stopAllAlarms();
    toast({
      title: 'Reset Complete',
      description: 'All timers have been reset'
    });
  };

  // Function to play single beep
  const playSingleBeep = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 880;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  };

  // Function to start continuous alarm
  const startAlarm = (dishId) => {
    if (alarmIntervals[dishId]) return; // Already playing
    
    setActiveAlarms(prev => ({ ...prev, [dishId]: true }));
    
    // Play initial beep
    playSingleBeep();
    
    // Continue playing beeps every 500ms
    const intervalId = setInterval(() => {
      playSingleBeep();
    }, 500);
    
    setAlarmIntervals(prev => ({ ...prev, [dishId]: intervalId }));
  };

  // Function to stop alarm for specific dish
  const stopAlarm = (dishId) => {
    if (alarmIntervals[dishId]) {
      clearInterval(alarmIntervals[dishId]);
      setAlarmIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[dishId];
        return newIntervals;
      });
    }
    setActiveAlarms(prev => {
      const newAlarms = { ...prev };
      delete newAlarms[dishId];
      return newAlarms;
    });
  };

  // Function to stop all alarms
  const stopAllAlarms = () => {
    Object.keys(alarmIntervals).forEach(dishId => {
      clearInterval(alarmIntervals[dishId]);
    });
    setAlarmIntervals({});
    setActiveAlarms({});
  };

  // Timer countdown effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(dishId => {
          if (updated[dishId].isRunning && updated[dishId].remaining > 0) {
            updated[dishId].remaining -= 1;
            hasChanges = true;

            // Alert when done
            if (updated[dishId].remaining === 0) {
              const dish = dishes.find(d => d.id === dishId);
              
              // Play alarm sound if enabled
              if (alarmEnabled) {
                startAlarm(dishId);
              }
              
              toast({
                title: 'Dish Ready! 🔔',
                description: `${dish?.name || 'Your dish'} is done cooking!`,
                variant: 'default'
              });
              updated[dishId].isRunning = false;
            }
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [dishes, alarmEnabled]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#111827]' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl shadow-lg ${theme === 'dark' ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                <Flame className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
                  Smart Cooking Sync
                </h1>
                <p className="text-slate-600 dark:text-gray-400 text-sm">
                  Multi-dish timer & temperature optimizer
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-full border-slate-300 dark:border-gray-700"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <Card className="mb-4 border-emerald-200 dark:border-gray-700 dark:bg-gray-800">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Your Oven Type</Label>
                    <Select value={userOvenType} onValueChange={setUserOvenType}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ovenTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Appearance</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Timer Alarm</Label>
                    <Select value={alarmEnabled ? 'on' : 'off'} onValueChange={(value) => setAlarmEnabled(value === 'on')}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">Enabled</SelectItem>
                        <SelectItem value="off">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="add" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="add">Add Dishes</TabsTrigger>
            <TabsTrigger value="plan">Cooking Plan</TabsTrigger>
          </TabsList>

          {/* Add Dish Tab */}
          <TabsContent value="add">
            <Card className="border-emerald-200 dark:border-gray-700 dark:bg-gray-800">
              <CardHeader>
                <CardTitle>Add New Dish</CardTitle>
                <CardDescription>
                  Enter the cooking details from your package instructions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">Dish Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Roast Potatoes"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="temperature">Temperature</Label>
                      <Input
                        id="temperature"
                        type="number"
                        placeholder="200"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit">Unit</Label>
                      <Select
                        value={formData.unit}
                        onValueChange={(value) => setFormData({ ...formData, unit: value })}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {temperatureUnits.map(unit => (
                            <SelectItem key={unit} value={unit}>°{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="time">Cooking Time (minutes)</Label>
                      <Input
                        id="time"
                        type="number"
                        placeholder="35"
                        value={formData.cookingTime}
                        onChange={(e) => setFormData({ ...formData, cookingTime: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ovenType">Package Oven Type</Label>
                      <Select
                        value={formData.ovenType}
                        onValueChange={(value) => setFormData({ ...formData, ovenType: value })}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ovenTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleAddDish}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Dish
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Current Dishes List */}
            {dishes.length > 0 && (
              <Card className="mt-6 border-emerald-200 dark:border-gray-700 dark:bg-gray-800">
                <CardHeader>
                  <CardTitle>Your Dishes ({dishes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dishes.map(dish => (
                      <div
                        key={dish.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-700 rounded-lg border border-slate-200 dark:border-gray-600"
                      >
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white">{dish.name}</p>
                          <p className="text-sm text-slate-600 dark:text-gray-400">
                            {dish.temperature}°{dish.unit} ({convertToFahrenheit(dish.unit === 'C' ? dish.temperature : convertToCelsius(dish.temperature))}°F) • {dish.cookingTime} min • {dish.ovenType}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDish(dish.id)}
                          className="hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Cooking Plan Tab */}
          <TabsContent value="plan">
            {!cookingPlan ? (
              <Card className="border-emerald-200 dark:border-gray-700 dark:bg-gray-800">
                <CardContent className="pt-12 pb-12 text-center">
                  <Clock className="w-16 h-16 mx-auto text-slate-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 dark:text-gray-300 mb-2">
                    No dishes added yet
                  </h3>
                  <p className="text-slate-500 dark:text-gray-400">
                    Add some dishes to generate your cooking plan
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Cooking Summary */}
                <Card className="border-emerald-200 dark:border-gray-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-900">
                  <CardHeader>
                    <CardTitle className="dark:text-white">Optimized Cooking Plan</CardTitle>
                    <CardDescription className="dark:text-gray-400">
                      All dishes will finish at the same time • Temperature rounded to nearest 10°C
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-1">Your Oven</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{userOvenType}</p>
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-1">Common Temperature</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {cookingPlan.commonTemp}°C / {convertToFahrenheit(cookingPlan.commonTemp)}°F
                        </p>
                      </div>
                      <div className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-1">Total Time</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{cookingPlan.totalTime} min</p>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                      <Button
                        onClick={resetAll}
                        variant="outline"
                        className="border-emerald-300 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset All
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <div className="space-y-4">
                  {cookingPlan.timeline.map((dish, index) => {
                    const timer = timers[dish.id];
                    const progress = timer ? ((timer.total - timer.remaining) / timer.total) * 100 : 0;

                    return (
                      <Card key={dish.id} className="border-emerald-200 dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
                                  Step {index + 1}
                                </Badge>
                                <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
                                  {dish.name}
                                </h3>
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-gray-400">
                                <span>
                                  Original: {dish.temperature}°{dish.unit} ({convertToFahrenheit(dish.unit === 'C' ? dish.temperature : convertToCelsius(dish.temperature))}°F)
                                </span>
                                <span>•</span>
                                <span>
                                  Adjusted: {dish.adjustedTime} min
                                  {dish.timeDifference !== 0 && (
                                    <Badge
                                      variant="secondary"
                                      className="ml-2 dark:bg-gray-700"
                                    >
                                      {dish.timeDifference > 0 ? '+' : ''}{dish.timeDifference} min
                                    </Badge>
                                  )}
                                </span>
                                {dish.startDelay > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>Start after {dish.startDelay} min</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Timer Controls */}
                          {timer ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatTime(timer.remaining)}
                                </span>
                                <div className="flex gap-2">
                                  {activeAlarms[dish.id] ? (
                                    <Button
                                      size="sm"
                                      onClick={() => stopAlarm(dish.id)}
                                      className="bg-red-500 hover:bg-red-600 text-white animate-pulse"
                                    >
                                      🔔 Stop Alarm
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => toggleTimer(dish.id)}
                                        disabled={timer.remaining === 0}
                                        className="dark:border-gray-600 dark:hover:bg-gray-700"
                                      >
                                        {timer.isRunning ? (
                                          <Pause className="w-4 h-4" />
                                        ) : (
                                          <Play className="w-4 h-4" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => resetTimer(dish.id)}
                                        className="dark:border-gray-600 dark:hover:bg-gray-700"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Progress value={progress} className="h-2" />
                              {timer.remaining === 0 && !activeAlarms[dish.id] && (
                                <Badge className="bg-green-500 text-white">Done!</Badge>
                              )}
                              {activeAlarms[dish.id] && (
                                <Badge className="bg-red-500 text-white animate-pulse">🔔 ALARM RINGING!</Badge>
                              )}
                            </div>
                          ) : (
                            <Button
                              onClick={() => startCooking(dish.id)}
                              size="sm"
                              variant="outline"
                              className="border-emerald-300 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Start Timer
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CookingSync;