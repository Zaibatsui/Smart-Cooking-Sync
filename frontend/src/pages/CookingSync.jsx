import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Clock, Flame, Settings, Trash2, Play, Pause, RotateCcw, Edit2, Check, X } from 'lucide-react';
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
import { dishesAPI, cookingPlanAPI } from '../services/api';

const CookingSync = () => {
  // Load saved user settings from localStorage (not dishes - those come from backend)
  const loadSavedSettings = () => {
    const saved = localStorage.getItem('cookingSyncSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Error loading saved settings:', error);
        return null;
      }
    }
    return null;
  };

  const savedSettings = loadSavedSettings();
  
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userOvenType, setUserOvenType] = useState(savedSettings?.userOvenType || 'Fan');
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(savedSettings?.theme || 'light');
  const [alarmEnabled, setAlarmEnabled] = useState(savedSettings?.alarmEnabled !== undefined ? savedSettings.alarmEnabled : true);
  const hasLoadedRef = useRef(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    temperature: '',
    unit: 'C',
    cookingTime: '',
    ovenType: 'Fan'
  });

  // Simplified timer state - no localStorage persistence for active timers
  const [timers, setTimers] = useState({}); // { [dishId]: { remaining: seconds, total: seconds } }
  const [finishedDishIds, setFinishedDishIds] = useState([]); // Dishes with timer = 0, alarm needs to be stopped
  const [alarmIntervalRef, setAlarmIntervalRef] = useState(null); // Store alarm interval ID
  const [cookingStarted, setCookingStarted] = useState(false); // Has cooking plan been started
  const [completedDishIds, setCompletedDishIds] = useState([]); // IDs of dishes that completed their cooking
  const [editingDish, setEditingDish] = useState(null); // Dish being edited
  const [editTime, setEditTime] = useState(''); // Edited time value

  // Load dishes from backend on mount
  useEffect(() => {
    const fetchDishes = async () => {
      try {
        setLoading(true);
        const fetchedDishes = await dishesAPI.getAll();
        setDishes(fetchedDishes);
      } catch (error) {
        console.error('Error fetching dishes:', error);
        toast({
          title: 'Error',
          description: 'Failed to load dishes from server',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDishes();
  }, []);

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
  const startAlarm = () => {
    if (alarmIntervalId) return; // Already playing
    
    // Play initial beep
    playSingleBeep();
    
    // Continue playing beeps every 500ms
    const intervalId = setInterval(() => {
      playSingleBeep();
    }, 500);
    
    setAlarmIntervalId(intervalId);
  };

  // Function to stop alarm
  const stopAlarm = () => {
    if (alarmIntervalId) {
      clearInterval(alarmIntervalId);
      setAlarmIntervalId(null);
    }
  };

  // Save user settings to localStorage (dishes are in backend, timers not persisted)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }

    // Save settings separately
    const settingsToSave = {
      userOvenType,
      theme,
      alarmEnabled
    };
    localStorage.setItem('cookingSyncSettings', JSON.stringify(settingsToSave));
  }, [userOvenType, theme, alarmEnabled]);

  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Calculate optimal cooking plan using backend API
  const [cookingPlan, setCookingPlan] = useState(null);
  const [calculatingPlan, setCalculatingPlan] = useState(false);

  useEffect(() => {
    const calculatePlan = async () => {
      if (dishes.length === 0) {
        setCookingPlan(null);
        return;
      }

      try {
        setCalculatingPlan(true);
        const planData = await cookingPlanAPI.calculate(userOvenType);
        
        // Transform backend response to match frontend format
        const timeline = planData.adjusted_dishes.map(dish => {
          const originalDish = dishes.find(d => d.id === dish.id);
          return {
            ...originalDish,
            id: dish.id,
            name: dish.name,
            adjustedTime: dish.adjustedTime,
            originalTime: dish.originalTime,
            normalizedTemp: dish.originalTemp,
            timeDifference: dish.adjustedTime - dish.originalTime,
            startDelay: planData.total_time - dish.adjustedTime,
            finishTime: planData.total_time
          };
        });

        setCookingPlan({
          commonTemp: planData.optimal_temp,
          timeline,
          totalTime: planData.total_time
        });
      } catch (error) {
        console.error('Error calculating cooking plan:', error);
        toast({
          title: 'Calculation Error',
          description: 'Failed to calculate cooking plan',
          variant: 'destructive'
        });
        setCookingPlan(null);
      } finally {
        setCalculatingPlan(false);
      }
    };

    calculatePlan();
  }, [dishes, userOvenType]);

  const handleAddDish = async () => {
    if (!formData.name || !formData.temperature || !formData.cookingTime) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      const dishData = {
        name: formData.name,
        temperature: parseFloat(formData.temperature),
        unit: formData.unit,
        cookingTime: parseInt(formData.cookingTime),
        ovenType: formData.ovenType
      };

      const newDish = await dishesAPI.create(dishData);
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
    } catch (error) {
      console.error('Error adding dish:', error);
      toast({
        title: 'Error',
        description: 'Failed to add dish',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveDish = async (id) => {
    try {
      await dishesAPI.delete(id);
      setDishes(dishes.filter(d => d.id !== id));
      const newTimers = { ...timers };
      delete newTimers[id];
      setTimers(newTimers);
      
      toast({
        title: 'Dish Removed',
        description: 'Dish has been removed from your plan'
      });
    } catch (error) {
      console.error('Error removing dish:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove dish',
        variant: 'destructive'
      });
    }
  };

  // Get dishes that should start next (not completed, earliest startDelay)
  const getNextDishesToStart = () => {
    if (!cookingPlan) return [];
    
    // Find dishes that haven't completed yet and don't have active timers
    const notCompleted = cookingPlan.timeline.filter(
      d => !completedDishIds.includes(d.id) && !timers[d.id]
    );
    
    if (notCompleted.length === 0) return [];
    
    // Find the earliest startDelay among not-completed dishes
    const earliestDelay = Math.min(...notCompleted.map(d => d.startDelay));
    
    // Return all dishes with that delay (could be multiple if they start together)
    return notCompleted.filter(d => d.startDelay === earliestDelay);
  };

  const clearAll = async () => {
    try {
      await dishesAPI.clearAll();
      setDishes([]);
      setTimers({});
      setCookingStarted(false);
      setCompletedDishIds([]);
      setActiveAlarmDishId(null);
      stopAlarm();
      toast({
        title: 'All Cleared',
        description: 'All dishes and timers have been removed'
      });
    } catch (error) {
      console.error('Error clearing dishes:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear dishes',
        variant: 'destructive'
      });
    }
  };

  // Start the cooking plan - starts first dish(es) automatically
  const startCookingPlan = () => {
    if (!cookingPlan || cookingPlan.timeline.length === 0) return;
    
    setCookingStarted(true);
    setCompletedDishIds([]);
    setActiveAlarmDishId(null);
    setTimers({});
    
    // Find first dishes to start (those with earliest startDelay)
    const firstDishes = getNextDishesToStart();
    
    if (firstDishes.length > 0) {
      // Start timers for first dish(es)
      const newTimers = {};
      firstDishes.forEach(dish => {
        newTimers[dish.id] = {
          remaining: dish.adjustedTime * 60, // Convert minutes to seconds
          total: dish.adjustedTime * 60
        };
      });
      setTimers(newTimers);
      
      const dishNames = firstDishes.map(d => d.name).join(', ');
      toast({
        title: 'Cooking Plan Started!',
        description: `Timer started for: ${dishNames}`
      });
    }
  };

  // Stop cooking plan
  const stopCookingPlan = () => {
    setCookingStarted(false);
    setCompletedDishIds([]);
    setActiveAlarmDishId(null);
    setTimers({});
    stopAlarm();
    
    toast({
      title: 'Cooking Stopped',
      description: 'All timers have been stopped'
    });
  };

  // Stop the alarm for a specific dish
  const stopDishAlarm = (dishId) => {
    // Stop the alarm sound
    stopAlarm();
    
    // Clear the alarming dish
    setActiveAlarmDishId(null);
    
    // Remove timer for this dish and mark as completed
    setTimers(prev => {
      const updated = { ...prev };
      delete updated[dishId];
      return updated;
    });
    
    setCompletedDishIds(prev => [...prev, dishId]);
    
    const dish = cookingPlan?.timeline.find(d => d.id === dishId);
    toast({
      title: 'Alarm Stopped',
      description: `${dish?.name} complete! ${getNextDishesToStart().length > 0 ? 'Start next dish when ready.' : ''}`
    });
  };

  // Start timer for next dish(es)
  const startNextDish = () => {
    const nextDishes = getNextDishesToStart();
    
    if (nextDishes.length === 0) return;
    
    // Start timers for next dish(es)
    const newTimers = { ...timers };
    nextDishes.forEach(dish => {
      newTimers[dish.id] = {
        remaining: dish.adjustedTime * 60,
        total: dish.adjustedTime * 60
      };
    });
    setTimers(newTimers);
    
    const dishNames = nextDishes.map(d => d.name).join(', ');
    toast({
      title: 'Timer Started',
      description: `Cooking: ${dishNames}`
    });
  };

  // Handle edit button click
  const handleEditClick = (dish) => {
    setEditingDish(dish.id);
    setEditTime(dish.adjustedTime.toString());
  };

  // Handle edit save
  const handleEditSave = async (dishId) => {
    const newTime = parseInt(editTime);
    
    if (isNaN(newTime) || newTime < 1) {
      toast({
        title: 'Invalid Time',
        description: 'Please enter a valid cooking time (minimum 1 minute)',
        variant: 'destructive'
      });
      return;
    }

    try {
      await dishesAPI.updateTime(dishId, newTime);
      
      // Refetch dishes to update the cooking plan
      const fetchedDishes = await dishesAPI.getAll();
      setDishes(fetchedDishes);
      
      setEditingDish(null);
      setEditTime('');
      
      toast({
        title: 'Time Updated',
        description: 'Cooking time has been updated'
      });
    } catch (error) {
      console.error('Error updating dish time:', error);
      toast({
        title: 'Error',
        description: 'Failed to update cooking time',
        variant: 'destructive'
      });
    }
  };

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditingDish(null);
    setEditTime('');
  };

  // Timer countdown effect - handles all countdown timers
  useEffect(() => {
    // Don't run if cooking hasn't started or if an alarm is already active
    if (!cookingStarted || activeAlarmDishId) return;
    
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        let alarmTriggeredDishId = null;

        Object.keys(updated).forEach(dishId => {
          const timer = updated[dishId];
          
          // Countdown if timer has time remaining
          if (timer.remaining > 0) {
            updated[dishId] = {
              ...timer,
              remaining: timer.remaining - 1
            };
            hasChanges = true;

            // Check if this timer just hit 0
            if (updated[dishId].remaining === 0) {
              alarmTriggeredDishId = dishId;
            }
          }
        });

        // If a timer hit 0, trigger alarm
        if (alarmTriggeredDishId) {
          const dish = cookingPlan?.timeline.find(d => d.id === alarmTriggeredDishId);
          
          // Set this as the currently alarming dish
          setActiveAlarmDishId(alarmTriggeredDishId);
          
          // Play alarm sound
          if (alarmEnabled) {
            startAlarm();
          }
          
          toast({
            title: `${dish?.name} Ready! 🔔`,
            description: 'Click "Stop Alarm" to continue',
            variant: 'default'
          });
        }

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cookingStarted, activeAlarmDishId, cookingPlan, alarmEnabled]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#111827]' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-2 sm:p-3 rounded-xl shadow-lg ${theme === 'dark' ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                <Flame className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-slate-800 dark:text-white">
                  Smart Cooking Sync
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400">
                  Multi-dish timer & optimiser
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-full border-slate-300 dark:border-gray-700 h-10 w-10 sm:h-11 sm:w-11"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <Card className="mb-4 border-emerald-200 dark:border-gray-700 dark:bg-gray-800">
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-sm">Your Oven Type</Label>
                    <Select value={userOvenType} onValueChange={setUserOvenType}>
                      <SelectTrigger className="mt-1.5 h-11">
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
                    <Label className="text-sm">Appearance</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="mt-1.5 h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Timer Alarm</Label>
                    <Select value={alarmEnabled ? 'on' : 'off'} onValueChange={(value) => setAlarmEnabled(value === 'on')}>
                      <SelectTrigger className="mt-1.5 h-11">
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

        <Tabs defaultValue="add" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-11 sm:h-10">
            <TabsTrigger value="add" className="text-sm sm:text-base">Add Dishes</TabsTrigger>
            <TabsTrigger value="plan" className="text-sm sm:text-base">Cooking Plan</TabsTrigger>
          </TabsList>

          {/* Add Dish Tab */}
          <TabsContent value="add">
            <Card className="border-emerald-200 dark:border-gray-700 dark:bg-gray-800">
              <CardHeader className="px-3 sm:px-6 py-4 sm:py-6">
                <CardTitle className="text-lg sm:text-xl">Add New Dish</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Enter cooking details from package
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm">Dish Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Roast Potatoes"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1.5 h-11 text-base"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="temperature" className="text-sm">Temperature</Label>
                      <Input
                        id="temperature"
                        type="number"
                        placeholder="200"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                        className="mt-1.5 h-11 text-base"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit" className="text-sm">Unit</Label>
                      <Select
                        value={formData.unit}
                        onValueChange={(value) => setFormData({ ...formData, unit: value })}
                      >
                        <SelectTrigger className="mt-1.5 h-11">
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="time" className="text-sm">Time (min)</Label>
                      <Input
                        id="time"
                        type="number"
                        placeholder="35"
                        value={formData.cookingTime}
                        onChange={(e) => setFormData({ ...formData, cookingTime: e.target.value })}
                        className="mt-1.5 h-11 text-base"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ovenType" className="text-sm">Oven Type</Label>
                      <Select
                        value={formData.ovenType}
                        onValueChange={(value) => setFormData({ ...formData, ovenType: value })}
                      >
                        <SelectTrigger className="mt-1.5 h-11">
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
                    className="w-full h-12 sm:h-11 text-base bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 mt-2"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Dish
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Current Dishes List */}
            {dishes.length > 0 && (
              <Card className="mt-4 sm:mt-6 border-emerald-200 dark:border-gray-700 dark:bg-gray-800">
                <CardHeader className="px-3 sm:px-6 py-4 sm:py-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg sm:text-xl">Your Dishes ({dishes.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAll}
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="space-y-3">
                    {dishes.map(dish => (
                      <div
                        key={dish.id}
                        className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 dark:bg-gray-700 rounded-lg border border-slate-200 dark:border-gray-600"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-semibold text-sm sm:text-base text-slate-800 dark:text-white truncate">{dish.name}</p>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 mt-0.5">
                            {dish.temperature}°{dish.unit} ({convertToFahrenheit(dish.unit === 'C' ? dish.temperature : convertToCelsius(dish.temperature))}°F) • {dish.cookingTime} min
                          </p>
                          <p className="text-xs text-slate-500 dark:text-gray-500">{dish.ovenType}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDish(dish.id)}
                          className="hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0 h-10 w-10"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
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
                <CardContent className="pt-8 pb-8 sm:pt-12 sm:pb-12 text-center px-3">
                  <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-slate-300 dark:text-gray-600 mb-3 sm:mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-700 dark:text-gray-300 mb-2">
                    No dishes added yet
                  </h3>
                  <p className="text-sm sm:text-base text-slate-500 dark:text-gray-400">
                    Add some dishes to generate your cooking plan
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {/* Cooking Summary */}
                <Card className="border-emerald-200 dark:border-gray-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-900">
                  <CardHeader className="px-3 sm:px-6 py-4 sm:py-6">
                    <CardTitle className="dark:text-white text-lg sm:text-xl">Optimised Plan</CardTitle>
                    <CardDescription className="dark:text-gray-400 text-xs sm:text-sm">
                      All finish together • Temp rounded to 10°C
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <div className="p-3 sm:p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 mb-1">Oven</p>
                        <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{userOvenType}</p>
                      </div>
                      <div className="p-3 sm:p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 mb-1">Temp</p>
                        <p className="text-base sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {cookingPlan.commonTemp}°C
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-500">{convertToFahrenheit(cookingPlan.commonTemp)}°F</p>
                      </div>
                      <div className="p-3 sm:p-4 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 mb-1">Time</p>
                        <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{cookingPlan.totalTime} min</p>
                      </div>
                    </div>

                    {/* Master Timer Controls */}
                    <div className="mt-4 sm:mt-6 space-y-3">
                      {!cookingStarted ? (
                        <Button
                          onClick={startCookingPlan}
                          className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-base font-semibold"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Start Cooking Plan
                        </Button>
                      ) : (
                        <Button
                          onClick={stopCookingPlan}
                          variant="destructive"
                          className="w-full h-12 text-base font-semibold"
                        >
                          <Pause className="w-5 h-5 mr-2" />
                          Stop Cooking
                        </Button>
                      )}
                      
                      <div className="flex gap-3">
                        <Button
                          onClick={clearAll}
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear All
                        </Button>
                      </div>

                      {/* Alarm Active Indicator */}
                      {activeAlarmDishId && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-3 text-center">
                          <p className="text-red-800 dark:text-red-300 font-medium text-sm">
                            🔔 Alarm Ringing - Stop alarm to continue
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <div className="space-y-3 sm:space-y-4">
                  {cookingPlan.timeline.map((dish, index) => {
                    const timer = timers[dish.id];
                    const isCompleted = completedDishIds.includes(dish.id);
                    const isEditing = editingDish === dish.id;
                    const hasAlarm = activeAlarmDishId === dish.id;
                    const nextDishes = getNextDishesToStart();
                    const isNextToStart = nextDishes.some(d => d.id === dish.id);
                    const isMultipleStart = nextDishes.length > 1 && isNextToStart;
                    const isLastDish = index === cookingPlan.timeline.length - 1;
                    const allDishesCompleted = completedDishIds.length === cookingPlan.timeline.length;

                    return (
                      <Card key={dish.id} className={`border-emerald-200 dark:border-gray-700 dark:bg-gray-800 overflow-hidden ${hasAlarm ? 'ring-4 ring-red-500 animate-pulse' : ''} ${isMultipleStart ? 'ring-2 ring-blue-500' : ''}`}>
                        <CardContent className="p-4 sm:p-6">
                          <div className="mb-3 sm:mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 text-xs sm:text-sm">
                                  Step {index + 1}
                                </Badge>
                                <h3 className="text-base sm:text-xl font-semibold text-slate-800 dark:text-white">
                                  {dish.name}
                                </h3>
                                {timer && (
                                  <Badge className="bg-orange-500 text-white text-xs">
                                    🔥 Cooking
                                  </Badge>
                                )}
                                {isCompleted && (
                                  <Badge className="bg-green-500 text-white text-xs">
                                    ✓ Done
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Edit Time Button */}
                              {!isEditing && !cookingStarted && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditClick(dish)}
                                  className="dark:hover:bg-gray-700"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            {/* Multi-dish indicator */}
                            {isMultipleStart && (
                              <div className="mb-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded p-2">
                                <p className="text-blue-700 dark:text-blue-300 text-xs font-medium">
                                  ⚡ Add {nextDishes.length} dishes together!
                                </p>
                              </div>
                            )}

                            {/* Time Edit Mode */}
                            {isEditing ? (
                              <div className="flex items-center gap-2 bg-slate-50 dark:bg-gray-700 p-3 rounded-lg">
                                <Label className="text-sm">Cooking time:</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="w-20 dark:bg-gray-600"
                                />
                                <span className="text-sm">min</span>
                                <Button
                                  size="sm"
                                  onClick={() => handleEditSave(dish.id)}
                                  className="bg-emerald-500 hover:bg-emerald-600"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleEditCancel}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-gray-400">
                                <span>
                                  Temp: {cookingPlan.commonTemp}°C
                                </span>
                                <span className="hidden sm:inline">•</span>
                                <span>
                                  Cook: {dish.adjustedTime} min
                                </span>
                                {!cookingStarted && dish.startDelay > 0 && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span>Starts after {dish.startDelay} min</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Timer Display */}
                          {cookingStarted && (
                            <div className="space-y-3">
                              {hasAlarm ? (
                                // Alarm is ringing - show stop alarm button
                                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg p-4">
                                  <p className="text-red-700 dark:text-red-300 font-bold text-center mb-3 text-lg">
                                    🔔 ALARM RINGING!
                                  </p>
                                  <Button
                                    onClick={() => stopDishAlarm(dish.id)}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-12"
                                  >
                                    Stop Alarm
                                  </Button>
                                </div>
                              ) : timer ? (
                                // Timer counting down
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600 dark:text-gray-400">
                                      Time remaining:
                                    </span>
                                    <span className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                                      {formatTime(timer.remaining)}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={100 - (timer.remaining / timer.total) * 100} 
                                    className="h-2.5 sm:h-2"
                                  />
                                  <p className="text-xs text-slate-500 dark:text-gray-500 text-center">
                                    ⏳ Timer running - alarm will sound when ready
                                  </p>
                                </div>
                              ) : isNextToStart && !activeAlarmDishId && Object.keys(timers).length === 0 ? (
                                // This dish should be started next - but only show after previous alarm stopped
                                <Button
                                  onClick={startNextDish}
                                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-base font-semibold"
                                >
                                  <Play className="w-5 h-5 mr-2" />
                                  {nextDishes.length > 1 ? `Start ${nextDishes.length} Dishes` : 'Start Timer'}
                                </Button>
                              ) : isCompleted ? (
                                // Dish completed
                                <div className="text-center py-3">
                                  <Badge className="bg-green-500 text-white text-base py-2 px-4">
                                    ✓ Completed
                                  </Badge>
                                </div>
                              ) : (
                                // Waiting
                                <div className="text-center py-3 text-slate-500 dark:text-gray-500 text-sm">
                                  ⏸️ Waiting...
                                </div>
                              )}

                              {/* Show success message if all dishes completed */}
                              {isCompleted && isLastDish && allDishesCompleted && (
                                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-4">
                                  <p className="text-green-700 dark:text-green-300 font-bold text-center text-lg">
                                    🎉 Enjoy Your Meal!
                                  </p>
                                  <p className="text-green-600 dark:text-green-400 text-center text-sm mt-1">
                                    Bon appétit!
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Not Started Yet Message */}
                          {!cookingStarted && (
                            <div className="text-center py-3 text-slate-500 dark:text-gray-500 text-sm">
                              Click "Start Cooking Plan" above to begin
                            </div>
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