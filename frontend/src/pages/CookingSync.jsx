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
    cookingMethod: 'Oven',
    temperature: '',
    unit: 'C',
    cookingTime: '',
    ovenType: 'Fan',
    instructions: [],
    convertFromOven: false,
    ovenTemp: '',
    ovenTime: ''
  });
  
  const [instructionInput, setInstructionInput] = useState({ label: '', afterMinutes: '' });
  
  // Air Fryer Conversion (from research: -15°C and ×0.8)
  const convertOvenToAirFryer = (ovenTemp, ovenTime) => {
    const airFryerTemp = Math.round(ovenTemp - 15); // Reduce by 15°C
    const airFryerTime = Math.round(ovenTime * 0.8); // Reduce by 20%
    return { airFryerTemp, airFryerTime };
  };

  // Simplified timer state - no localStorage persistence for active timers
  const [timers, setTimers] = useState({}); // { [dishId]: { remaining: seconds, total: seconds } }
  const [finishedDishIds, setFinishedDishIds] = useState([]); // Dishes with timer = 0, alarm needs to be stopped
  const [alarmIntervalRef, setAlarmIntervalRef] = useState(null); // Store alarm interval ID
  const [cookingStarted, setCookingStarted] = useState(false); // Has cooking plan been started
  const [completedDishIds, setCompletedDishIds] = useState([]); // IDs of dishes that completed their cooking
  const [showAlarmModal, setShowAlarmModal] = useState(false); // Show alarm modal popup
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

  // Ref to store alarm interval (using ref to avoid stale closure issues)
  const alarmIntervalRefObj = useRef(null);

  // Function to start continuous alarm
  const startAlarm = () => {
    if (alarmIntervalRefObj.current) return; // Already playing
    
    // Play initial beep
    playSingleBeep();
    
    // Continue playing beeps every 500ms
    const intervalId = setInterval(() => {
      playSingleBeep();
    }, 500);
    
    alarmIntervalRefObj.current = intervalId;
    setAlarmIntervalRef(intervalId);
  };

  // Function to stop alarm
  const stopAlarm = () => {
    if (alarmIntervalRefObj.current) {
      clearInterval(alarmIntervalRefObj.current);
      alarmIntervalRefObj.current = null;
      setAlarmIntervalRef(null);
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
        
        // Use the timeline from backend (includes dishes and instructions)
        const timeline = planData.timeline || [];

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

  // Add instruction to the form
  const handleAddInstruction = () => {
    if (!instructionInput.label || !instructionInput.afterMinutes) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in instruction label and time',
        variant: 'destructive'
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      instructions: [...prev.instructions, {
        label: instructionInput.label,
        afterMinutes: parseInt(instructionInput.afterMinutes)
      }]
    }));

    setInstructionInput({ label: '', afterMinutes: '' });
  };

  // Remove instruction from form
  const handleRemoveInstruction = (index) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index)
    }));
  };

  const handleAddDish = async () => {
    // Validate based on cooking method
    const isMicrowave = formData.cookingMethod === 'Microwave';
    const isAirFryer = formData.cookingMethod === 'Air Fryer';
    
    if (!formData.name || !formData.cookingTime) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in dish name and cooking time',
        variant: 'destructive'
      });
      return;
    }
    
    if (!isMicrowave && !formData.temperature) {
      toast({
        title: 'Missing Temperature',
        description: 'Please enter cooking temperature',
        variant: 'destructive'
      });
      return;
    }

    try {
      let dishData = {
        name: formData.name,
        cookingMethod: formData.cookingMethod,
        cookingTime: parseInt(formData.cookingTime),
        instructions: formData.instructions
      };
      
      // Add temperature and oven type only if not microwave
      if (!isMicrowave) {
        dishData.temperature = parseFloat(formData.temperature);
        dishData.unit = formData.unit;
        dishData.ovenType = formData.ovenType;
      }
      
      // If Air Fryer with conversion enabled
      if (isAirFryer && formData.convertFromOven && formData.ovenTemp && formData.ovenTime) {
        const { airFryerTemp, airFryerTime } = convertOvenToAirFryer(
          parseFloat(formData.ovenTemp),
          parseInt(formData.ovenTime)
        );
        dishData.temperature = airFryerTemp;
        dishData.cookingTime = airFryerTime;
        dishData.convertedFromOven = true;
        dishData.originalOvenTemp = parseFloat(formData.ovenTemp);
        dishData.originalOvenTime = parseInt(formData.ovenTime);
      }

      const newDish = await dishesAPI.create(dishData);
      setDishes([...dishes, newDish]);
      
      setFormData({
        name: '',
        cookingMethod: 'Oven',
        temperature: '',
        unit: 'C',
        cookingTime: '',
        ovenType: 'Fan',
        instructions: [],
        convertFromOven: false,
        ovenTemp: '',
        ovenTime: ''
      });
      
      setInstructionInput({ label: '', afterMinutes: '' });
      
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
      setFinishedDishIds([]);
      setShowAlarmModal(false);
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

  // Start the cooking plan - first dish(es) go in oven and timer starts
  const startCookingPlan = () => {
    if (!cookingPlan || cookingPlan.timeline.length === 0) return;
    
    setCookingStarted(true);
    setFinishedDishIds([]);
    setShowAlarmModal(false);
    setCompletedDishIds([]);
    setTimers({});
    stopAlarm();
    
    // Find first items (those with earliest startDelay)
    const allItems = cookingPlan.timeline;
    const earliestDelay = Math.min(...allItems.map(d => d.startDelay));
    const firstItems = allItems.filter(d => d.startDelay === earliestDelay);
    
    // Mark first items as in oven (only dishes, not instructions)
    const firstDishes = firstItems.filter(d => d.type === 'dish');
    setCompletedDishIds(firstDishes.map(d => d.id));
    
    // Find NEXT item in timeline after first items
    const remainingItems = allItems.filter(item => !firstItems.some(f => f.id === item.id));
    
    if (remainingItems.length > 0) {
      // Find next earliest item
      const nextEarliestDelay = Math.min(...remainingItems.map(d => d.startDelay));
      const nextItems = remainingItems.filter(d => d.startDelay === nextEarliestDelay);
      
      // Calculate time until next items (nextDelay - currentDelay)
      const timeUntilNext = nextEarliestDelay - earliestDelay;
      
      // Start timer for first items - counting down to NEXT items
      const newTimers = {};
      firstItems.forEach(item => {
        newTimers[item.id] = {
          remaining: timeUntilNext * 60,
          total: timeUntilNext * 60
        };
      });
      setTimers(newTimers);
    } else {
      // No more items - just these ones, use their cooking time
      const newTimers = {};
      firstItems.forEach(item => {
        newTimers[item.id] = {
          remaining: item.adjustedTime * 60,
          total: item.adjustedTime * 60
        };
      });
      setTimers(newTimers);
    }
    
    const itemNames = firstItems.map(d => d.name).join(', ');
    toast({
      title: 'Cooking Started!',
      description: `${itemNames} now in oven. Timer started.`
    });
  };

  // Stop cooking plan
  const stopCookingPlan = () => {
    setCookingStarted(false);
    setCompletedDishIds([]);
    setFinishedDishIds([]);
    setShowAlarmModal(false);
    setTimers({});
    stopAlarm();
    
    toast({
      title: 'Cooking Stopped',
      description: 'All timers have been stopped'
    });
  };

  // Stop alarm - user will manually add dishes and start next timer
  const stopAllAlarms = () => {
    // Stop the alarm sound
    stopAlarm();
    
    // Hide alarm modal
    setShowAlarmModal(false);
    
    // Check if this is the final alarm (all dishes done)
    const isAllDone = completedDishIds.length + finishedDishIds.length === cookingPlan?.timeline.length;
    
    if (isAllDone) {
      // Final alarm - all dishes done!
      setFinishedDishIds([]);
      toast({
        title: '🎉 Enjoy Your Meal!',
        description: 'All dishes finished cooking together!'
      });
    } else {
      // Intermediate alarm - time to add next dishes
      // Clear the timers that finished
      setTimers(prev => {
        const updated = { ...prev };
        finishedDishIds.forEach(id => {
          delete updated[id];
        });
        return updated;
      });
      
      // Clear finished dishes list
      setFinishedDishIds([]);
      
      toast({
        title: 'Alarm Stopped',
        description: 'Add dishes to oven, then click "Start Timer" to continue'
      });
    }
  };

  // Start timer for next item(s) after user has performed the action
  const startNextDishes = () => {
    const nextItems = getNextDishesToStart();
    if (nextItems.length === 0) return;
    
    const hasInstructions = nextItems.some(item => item.type === 'instruction');
    const hasDishes = nextItems.some(item => item.type === 'dish');
    
    // Mark dishes (not instructions) as now in oven
    // Instructions are marked as completed immediately
    const nextDishes = nextItems.filter(item => item.type === 'dish');
    const nextInstructions = nextItems.filter(item => item.type === 'instruction');
    
    setCompletedDishIds(prev => [...prev, ...nextDishes.map(d => d.id), ...nextInstructions.map(i => i.id)]);
    
    // Find what comes AFTER these items
    const allItems = cookingPlan.timeline;
    const currentDelay = nextItems[0].startDelay;
    const remainingItems = allItems.filter(item => 
      item.startDelay > currentDelay && !completedDishIds.includes(item.id) && !nextInstructions.some(ni => ni.id === item.id)
    );
    
    const newTimers = {};
    
    if (remainingItems.length > 0) {
      // Find next items to trigger
      const nextEarliestDelay = Math.min(...remainingItems.map(d => d.startDelay));
      const timeUntilNext = nextEarliestDelay - currentDelay;
      
      // Start countdown to NEXT items
      nextItems.forEach(item => {
        newTimers[item.id] = {
          remaining: timeUntilNext * 60,
          total: timeUntilNext * 60
        };
      });
    } else {
      // No more items - these are the last ones
      // For dishes, use their cooking time; for instructions at the end, use 0
      nextItems.forEach(item => {
        if (item.type === 'dish') {
          newTimers[item.id] = {
            remaining: item.adjustedTime * 60,
            total: item.adjustedTime * 60
          };
        }
      });
    }
    
    setTimers(newTimers);
    
    const itemNames = nextItems.map(d => d.name).join(', ');
    const actionType = hasInstructions ? 'completed' : 'now in oven';
    toast({
      title: 'Timer Started',
      description: `${itemNames} ${actionType}. Timer continues.`
    });
  };

  // This function is no longer needed - timers auto-start after alarm

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
    if (!cookingStarted || finishedDishIds.length > 0) return;
    
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        const newlyFinishedDishIds = [];

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
              newlyFinishedDishIds.push(dishId);
            }
          }
        });

        // If any timer hit 0, trigger alarm
        if (newlyFinishedDishIds.length > 0) {
          setFinishedDishIds(newlyFinishedDishIds);
          setShowAlarmModal(true);
          
          // Play alarm sound
          if (alarmEnabled) {
            startAlarm();
          }
          
          const dishNames = newlyFinishedDishIds
            .map(id => cookingPlan?.timeline.find(d => d.id === id)?.name)
            .join(', ');
          
          toast({
            title: `${dishNames} Ready! 🔔`,
            description: 'Click "Stop Alarm" to continue',
            variant: 'default'
          });
        }

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cookingStarted, finishedDishIds, cookingPlan, alarmEnabled]);

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

                  {/* Cooking Method Selector */}
                  <div>
                    <Label className="text-sm">Cooking Method</Label>
                    <Select
                      value={formData.cookingMethod}
                      onValueChange={(value) => setFormData({ ...formData, cookingMethod: value, convertFromOven: false })}
                    >
                      <SelectTrigger className="mt-1.5 h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Oven">🔥 Oven</SelectItem>
                        <SelectItem value="Air Fryer">💨 Air Fryer</SelectItem>
                        <SelectItem value="Microwave">⚡ Microwave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Air Fryer Conversion Option */}
                  {formData.cookingMethod === 'Air Fryer' && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.convertFromOven}
                          onChange={(e) => setFormData({ ...formData, convertFromOven: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          Convert from Oven Instructions
                        </span>
                      </label>
                      
                      {formData.convertFromOven && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Oven Temp (°C)</Label>
                            <Input
                              type="number"
                              placeholder="200"
                              value={formData.ovenTemp}
                              onChange={(e) => {
                                const ovenTemp = e.target.value;
                                setFormData({ ...formData, ovenTemp });
                                if (ovenTemp && formData.ovenTime) {
                                  const { airFryerTemp, airFryerTime } = convertOvenToAirFryer(parseFloat(ovenTemp), parseInt(formData.ovenTime));
                                  setFormData(prev => ({ ...prev, ovenTemp, temperature: airFryerTemp.toString(), cookingTime: airFryerTime.toString() }));
                                }
                              }}
                              className="mt-1 h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Oven Time (min)</Label>
                            <Input
                              type="number"
                              placeholder="30"
                              value={formData.ovenTime}
                              onChange={(e) => {
                                const ovenTime = e.target.value;
                                setFormData({ ...formData, ovenTime });
                                if (formData.ovenTemp && ovenTime) {
                                  const { airFryerTemp, airFryerTime } = convertOvenToAirFryer(parseFloat(formData.ovenTemp), parseInt(ovenTime));
                                  setFormData(prev => ({ ...prev, ovenTime, temperature: airFryerTemp.toString(), cookingTime: airFryerTime.toString() }));
                                }
                              }}
                              className="mt-1 h-9 text-sm"
                            />
                          </div>
                          {formData.ovenTemp && formData.ovenTime && (
                            <div className="col-span-2 text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
                              → Air Fryer: {convertOvenToAirFryer(parseFloat(formData.ovenTemp), parseInt(formData.ovenTime)).airFryerTemp}°C, {convertOvenToAirFryer(parseFloat(formData.ovenTemp), parseInt(formData.ovenTime)).airFryerTime} min
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Temperature - Hidden for Microwave, Auto-filled for Air Fryer with conversion */}
                  {formData.cookingMethod !== 'Microwave' && (
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
                          disabled={formData.cookingMethod === 'Air Fryer' && formData.convertFromOven}
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
                  )}

                  <div className={`grid gap-3 ${formData.cookingMethod === 'Oven' ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
                        disabled={formData.cookingMethod === 'Air Fryer' && formData.convertFromOven}
                      />
                    </div>
                    
                    {/* Oven Type - Only shown for Oven cooking method */}
                    {formData.cookingMethod === 'Oven' && (
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
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Instructions Section */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Cooking Instructions (Optional)</Label>
                    
                    {/* Show added instructions */}
                    {formData.instructions.length > 0 && (
                      <div className="space-y-2">
                        {formData.instructions.map((instruction, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-gray-700 rounded border border-slate-200 dark:border-gray-600">
                            <span className="flex-1 text-sm">
                              <strong>After {instruction.afterMinutes} min:</strong> {instruction.label}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveInstruction(index)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add instruction input */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Input
                          placeholder="e.g., Turn over, Add sauce"
                          value={instructionInput.label}
                          onChange={(e) => setInstructionInput(prev => ({ ...prev, label: e.target.value }))}
                          className="h-10"
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          placeholder="After (min)"
                          value={instructionInput.afterMinutes}
                          onChange={(e) => setInstructionInput(prev => ({ ...prev, afterMinutes: e.target.value }))}
                          className="h-10"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={handleAddInstruction}
                      variant="outline"
                      className="w-full h-10"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Instruction
                    </Button>
                  </div>

                  <Button
                    onClick={handleAddDish}
                    className="w-full h-12 sm:h-11 text-base bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 mt-4"
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
                  <CardContent className="px-3 sm:px-6 py-3 sm:py-6">
                    {/* Check which cooking methods are used */}
                    {(() => {
                      const hasOven = dishes.some(d => d.cookingMethod === 'Oven' || !d.cookingMethod);
                      const hasAirFryer = dishes.some(d => d.cookingMethod === 'Air Fryer');
                      const hasMicrowave = dishes.some(d => d.cookingMethod === 'Microwave');
                      const methodCount = [hasOven, hasAirFryer, hasMicrowave].filter(Boolean).length;
                      
                      return (
                        <div className="flex gap-2 w-full">
                          {/* Temperature cards - expand to fill width */}
                          {hasOven && (
                            <div className="flex-1 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                              <p className="text-xs text-orange-700 dark:text-orange-400 font-medium mb-0.5">🔥 Oven</p>
                              <p className="text-xs text-slate-600 dark:text-gray-400">{userOvenType}</p>
                              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                {cookingPlan.optimal_oven_temp || cookingPlan.commonTemp}°
                              </p>
                            </div>
                          )}
                          
                          {hasAirFryer && (
                            <div className="flex-1 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-0.5">💨 Fryer</p>
                              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {cookingPlan.optimal_airfryer_temp || cookingPlan.commonTemp}°
                              </p>
                            </div>
                          )}
                          
                          {hasMicrowave && (
                            <div className="flex-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                              <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">⚡ Wave</p>
                              <p className="text-xs text-slate-600 dark:text-gray-400">Time only</p>
                            </div>
                          )}
                          
                          {/* Total Time */}
                          <div className="flex-1 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-0.5">Total</p>
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{cookingPlan.totalTime}m</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Master Timer Controls */}
                    <div className="mt-3 sm:mt-6 space-y-2 sm:space-y-3">
                      {!cookingStarted ? (
                        <Button
                          onClick={startCookingPlan}
                          className="w-full h-10 sm:h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-sm sm:text-base font-semibold"
                        >
                          <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                          Start Cooking
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

                      {/* Alarm Modal Popup */}
                      {showAlarmModal && finishedDishIds.length > 0 && (
                        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-pulse border-4 border-red-500">
                            <div className="text-center mb-6">
                              {(() => {
                                // Find next dishes to add (not yet in oven)
                                const allDishes = cookingPlan?.timeline || [];
                                const notInOven = allDishes.filter(d => !completedDishIds.includes(d.id) && !finishedDishIds.includes(d.id));
                                
                                if (notInOven.length === 0) {
                                  // All dishes in oven or done - final alarm
                                  return (
                                    <>
                                      <div className="text-6xl mb-3">🎉</div>
                                      <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                                        MEAL READY!
                                      </h2>
                                      <p className="text-lg font-semibold text-slate-800 dark:text-white mb-3">
                                        All dishes finished together!
                                      </p>
                                      <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        Enjoy your meal! 🍽️
                                      </p>
                                    </>
                                  );
                                } else {
                                  // Intermediate alarm - show NEXT items (dishes or instructions)
                                  const nextEarliestDelay = Math.min(...notInOven.map(d => d.startDelay));
                                  const nextItems = notInOven.filter(d => d.startDelay === nextEarliestDelay);
                                  const isInstruction = nextItems[0]?.type === 'instruction';
                                  
                                  return (
                                    <>
                                      <div className="text-7xl mb-4">{isInstruction ? '📋' : '🔔'}</div>
                                      <h2 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-3">
                                        ALARM!
                                      </h2>
                                      <p className="text-xl font-semibold text-slate-800 dark:text-white mb-3">
                                        {isInstruction ? 'Time to:' : 'Time to Add:'}
                                      </p>
                                      <div className="space-y-2 mb-4">
                                        {nextItems.map(item => {
                                          // Get cooking method for dishes
                                          const dish = item.type === 'dish' ? dishes.find(d => d.id === item.id) : null;
                                          const method = dish?.cookingMethod || 'Oven';
                                          const methodConfig = {
                                            'Oven': { icon: '🔥', label: 'Oven', color: 'text-orange-600 dark:text-orange-400' },
                                            'Air Fryer': { icon: '💨', label: 'Air Fryer', color: 'text-blue-600 dark:text-blue-400' },
                                            'Microwave': { icon: '⚡', label: 'Microwave', color: 'text-yellow-600 dark:text-yellow-400' }
                                          };
                                          const config = methodConfig[method];
                                          
                                          return (
                                            <div key={item.id} className="bg-slate-50 dark:bg-gray-700 rounded-lg p-3">
                                              <p className={`text-2xl font-bold ${isInstruction ? 'text-purple-600 dark:text-purple-400' : config.color}`}>
                                                {!isInstruction && `${config.icon} `}{item.name}
                                              </p>
                                              {!isInstruction && (
                                                <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                                                  → {config.label}
                                                </p>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <p className="text-sm text-slate-600 dark:text-gray-400">
                                        {isInstruction ? 'Complete this instruction then continue' : `Add to ${nextItems[0].type === 'dish' ? dishes.find(d => d.id === nextItems[0].id)?.cookingMethod || 'oven' : 'appliance'} with other dishes`}
                                      </p>
                                    </>
                                  );
                                }
                              })()}
                            </div>
                            <Button
                              onClick={stopAllAlarms}
                              className={`w-full h-14 text-white text-lg font-bold ${
                                (() => {
                                  const allDishes = cookingPlan?.timeline || [];
                                  const notInOven = allDishes.filter(d => !completedDishIds.includes(d.id) && !finishedDishIds.includes(d.id));
                                  return notInOven.length === 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';
                                })()
                              }`}
                            >
                              {(() => {
                                const allDishes = cookingPlan?.timeline || [];
                                const notInOven = allDishes.filter(d => !completedDishIds.includes(d.id) && !finishedDishIds.includes(d.id));
                                return notInOven.length === 0 ? 'Enjoy Your Meal! 🎉' : 'Stop Alarm';
                              })()}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <div className="space-y-2 sm:space-y-4">
                  {cookingPlan.timeline.map((item, index) => {
                    const isInstruction = item.type === 'instruction';
                    const isDish = item.type === 'dish';
                    
                    const timer = timers[item.id];
                    const isInOven = completedDishIds.includes(item.id);
                    const isEditing = editingDish === item.id;
                    const isFinished = finishedDishIds.includes(item.id);
                    const nextDishes = getNextDishesToStart();
                    const isNextToStart = nextDishes.some(d => d.id === item.id);
                    const isMultipleStart = nextDishes.length > 1;
                    const allDishesInOven = completedDishIds.length === cookingPlan.timeline.filter(t => t.type === 'dish').length;

                    return (
                      <Card key={item.id} className={`${isInstruction ? 'border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/10' : 'border-emerald-200 dark:border-gray-700'} dark:bg-gray-800 overflow-hidden ${isFinished ? 'ring-4 ring-red-500 animate-pulse' : ''} ${isMultipleStart && isNextToStart ? 'ring-2 ring-blue-500' : ''}`}>
                        <CardContent className="p-3 sm:p-6">
                          <div className="mb-2 sm:mb-3">
                            {/* All Badges Grouped Together */}
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                              {/* Step Badge */}
                              <Badge variant="outline" className={`${isInstruction ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'} text-xs px-2 py-1 font-medium`}>
                                {isInstruction ? '📋 Instruction' : `Step ${item.order}`}
                              </Badge>
                              
                              {/* Cooking Method Badge */}
                              {isDish && (() => {
                                const dish = dishes.find(d => d.id === item.id);
                                const method = dish?.cookingMethod || 'Oven';
                                const methodConfig = {
                                  'Oven': { icon: '🔥', label: 'Oven', color: 'bg-orange-500' },
                                  'Air Fryer': { icon: '💨', label: 'Air Fryer', color: 'bg-blue-500' },
                                  'Microwave': { icon: '⚡', label: 'Microwave', color: 'bg-yellow-500' }
                                };
                                const config = methodConfig[method];
                                return (
                                  <Badge className={`${config.color} text-white text-xs px-2 py-1 font-medium`}>
                                    {config.icon} {config.label}
                                  </Badge>
                                );
                              })()}
                              
                              {/* Status Badges */}
                              {timer && (
                                <Badge className="bg-blue-500 text-white text-xs px-2 py-1 font-medium">
                                  ⏳ Countdown
                                </Badge>
                              )}
                            </div>
                            
                            {/* Dish Name on Separate Line */}
                            <div className="flex items-center justify-between">
                              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
                                {item.name}
                              </h3>
                              
                              {/* Edit Time Button - only for dishes */}
                              {isDish && !isEditing && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditClick(item)}
                                  className="dark:hover:bg-gray-700"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>

                            {/* Multi-dish indicator */}
                            {isMultipleStart && isNextToStart && (
                              <div className="mb-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded px-2 py-1.5">
                                <p className="text-blue-700 dark:text-blue-300 text-xs font-semibold">
                                  ⚡ Start {nextDishes.length} dishes together
                                </p>
                              </div>
                            )}

                            {/* Time Edit Mode - only for dishes */}
                            {isDish && isEditing ? (
                              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                                <Label className="text-xs sm:text-sm">Time:</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="w-16 sm:w-20 dark:bg-gray-600 h-8 text-sm"
                                />
                                <span className="text-xs sm:text-sm">min</span>
                                <Button
                                  size="sm"
                                  onClick={() => handleEditSave(item.id)}
                                  className="bg-emerald-500 hover:bg-emerald-600 h-7 w-7 p-0"
                                >
                                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
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
                              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-gray-400">
                                {isDish && (() => {
                                  const dish = dishes.find(d => d.id === item.id);
                                  const method = dish?.cookingMethod || 'Oven';
                                  
                                  // Get appropriate temp
                                  let temp = cookingPlan.commonTemp;
                                  if (method === 'Oven' && cookingPlan.optimal_oven_temp) {
                                    temp = cookingPlan.optimal_oven_temp;
                                  } else if (method === 'Air Fryer' && cookingPlan.optimal_airfryer_temp) {
                                    temp = cookingPlan.optimal_airfryer_temp;
                                  }
                                  
                                  return (
                                    <>
                                      {method !== 'Microwave' && <span className="font-medium">{temp}°C</span>}
                                      <span>•</span>
                                      <span className="font-medium">{item.adjustedTime} min</span>
                                      {!cookingStarted && item.startDelay > 0 && (
                                        <>
                                          <span>•</span>
                                          <span className="text-slate-500">Starts +{item.startDelay}min</span>
                                        </>
                                      )}
                                    </>
                                  );
                                })()}
                                {isInstruction && (
                                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                                    Triggers after {item.startDelay}min
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Timer Display */}
                          {cookingStarted && (
                            <div className="space-y-2 sm:space-y-3">
                              {timer ? (
                                // Timer counting down
                                <div className="space-y-1 sm:space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs sm:text-sm text-slate-600 dark:text-gray-400">
                                      {isInstruction ? 'Action in:' : (isInOven ? 'Next in:' : 'Time:')}
                                    </span>
                                    <span className="text-2xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                                      {formatTime(timer.remaining)}
                                    </span>
                                  </div>
                                  <Progress 
                                    value={100 - (timer.remaining / timer.total) * 100} 
                                    className="h-1.5 sm:h-2"
                                  />
                                  <p className="text-xs text-slate-500 dark:text-gray-500 text-center hidden sm:block">
                                    {isInstruction ? '⏳ Alarm for instruction' : (isInOven ? '⏳ Alarm when ready' : '⏳ Running')}
                                  </p>
                                </div>
                              ) : isInOven && isDish ? (
                                // Dish is cooking in appliance, no timer (cooking until all done)
                                <div className="text-center py-2 sm:py-3">
                                  {(() => {
                                    const dish = dishes.find(d => d.id === item.id);
                                    const method = dish?.cookingMethod || 'Oven';
                                    const methodConfig = {
                                      'Oven': { icon: '🔥', label: 'In Oven', color: 'bg-orange-500' },
                                      'Air Fryer': { icon: '💨', label: 'In Air Fryer', color: 'bg-blue-500' },
                                      'Microwave': { icon: '⚡', label: 'In Microwave', color: 'bg-yellow-500' }
                                    };
                                    const config = methodConfig[method];
                                    return (
                                      <Badge className={`${config.color} text-white text-sm sm:text-base py-1.5 sm:py-2 px-3 sm:px-4`}>
                                        {config.icon} {config.label}
                                      </Badge>
                                    );
                                  })()}
                                  <p className="text-xs text-slate-500 dark:text-gray-500 mt-1 hidden sm:block">
                                    Finishes with all dishes
                                  </p>
                                </div>
                              ) : isInstruction && isInOven ? (
                                // Instruction completed
                                <div className="text-center py-2 sm:py-3">
                                  <Badge className="bg-purple-500 text-white text-sm sm:text-base py-1.5 sm:py-2 px-3 sm:px-4">
                                    ✓ Done
                                  </Badge>
                                </div>
                              ) : isNextToStart && !finishedDishIds.length ? (
                                // Show Start Timer button for next item(s) (dish or instruction) after alarm stopped
                                <Button
                                  onClick={startNextDishes}
                                  className={`w-full h-10 sm:h-12 text-sm sm:text-base font-semibold ${
                                    isInstruction 
                                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
                                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                                  }`}
                                >
                                  <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                                  {isInstruction ? 'Continue' : (isMultipleStart ? `Start ${nextDishes.length}` : 'Start Timer')}
                                </Button>
                              ) : (
                                // Waiting for alarm or previous action
                                <div className="text-center py-2 sm:py-3 text-slate-500 dark:text-gray-500 text-xs sm:text-sm">
                                  ⏸️ Waiting...
                                </div>
                              )}
                            </div>
                          )}

                          {/* Not Started Yet Message */}
                          {!cookingStarted && (
                            <div className="text-center py-2 sm:py-3 text-slate-500 dark:text-gray-500 text-xs sm:text-sm">
                              Start cooking plan to begin
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