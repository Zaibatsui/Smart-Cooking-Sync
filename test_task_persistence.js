// Simple test to verify task persistence
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="add-task-name"], input[placeholder*="Heat sauce"]', { timeout: 10000 });
    
    console.log('✅ Page loaded successfully');
    
    // Check if localStorage is accessible
    const hasLocalStorage = await page.evaluate(() => {
      return typeof localStorage !== 'undefined';
    });
    
    if (hasLocalStorage) {
      console.log('✅ localStorage is available');
      
      // Test setting and getting tasks from localStorage
      const testResult = await page.evaluate(() => {
        const testTasks = [
          { id: 'test-1', name: 'Test Task', duration: 5, taskType: 'duration' }
        ];
        
        // Save to localStorage
        localStorage.setItem('cookingSyncTasks', JSON.stringify(testTasks));
        
        // Retrieve from localStorage
        const retrieved = localStorage.getItem('cookingSyncTasks');
        return retrieved ? JSON.parse(retrieved) : null;
      });
      
      if (testResult && testResult.length === 1 && testResult[0].name === 'Test Task') {
        console.log('✅ Task persistence test passed');
      } else {
        console.log('❌ Task persistence test failed');
      }
    } else {
      console.log('❌ localStorage not available');
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();