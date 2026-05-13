/**
 * Solar/Battery Power Saver Mode
 * Ultra-lite mode for areas with unstable electricity
 * Features: Dark mode, disabled animations, deferred sync, battery monitoring
 */

export interface PowerStatus {
  isCharging: boolean;
  batteryLevel: number; // 0-100
  estimatedTime: number | null; // minutes until full/empty
  powerSaveMode: boolean;
  networkType: 'offline' | '2g' | '3g' | '4g' | '5g' | 'wifi';
}

export interface PowerSaverConfig {
  disableAnimations: boolean;
  enableDarkMode: boolean;
  deferNonCriticalSync: boolean;
  reduceScreenBrightness: boolean;
  limitBackgroundTasks: boolean;
  compressImageData: boolean;
  cacheStrategy: 'aggressive' | 'balanced' | 'minimal';
}

class PowerSaverService {
  private status: PowerStatus = {
    isCharging: false,
    batteryLevel: 100,
    estimatedTime: null,
    powerSaveMode: false,
    networkType: 'wifi'
  };

  private config: PowerSaverConfig = {
    disableAnimations: false,
    enableDarkMode: false,
    deferNonCriticalSync: false,
    reduceScreenBrightness: false,
    limitBackgroundTasks: false,
    compressImageData: false,
    cacheStrategy: 'balanced'
  };

  private listeners: Set<(status: PowerStatus) => void> = new Set();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initBatteryMonitoring();
    this.initNetworkMonitoring();
  }

  /**
   * Initialize battery status monitoring
   */
  private initBatteryMonitoring() {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.updateBatteryStatus(battery);

        battery.addEventListener('chargingchange', () => this.updateBatteryStatus(battery));
        battery.addEventListener('levelchange', () => this.updateBatteryStatus(battery));
        battery.addEventListener('chargingtimechange', () => this.updateBatteryStatus(battery));
        battery.addEventListener('dischargingtimechange', () => this.updateBatteryStatus(battery));
      });
    } else {
      // Fallback: assume plugged in for desktop
      this.status.batteryLevel = 100;
      this.status.isCharging = true;
    }
  }

  private updateBatteryStatus(battery: any) {
    const wasLowPower = this.isLowPower();
    
    this.status.isCharging = battery.charging;
    this.status.batteryLevel = Math.round(battery.level * 100);
    this.status.estimatedTime = battery.charging 
      ? (battery.chargingTime === Infinity ? null : battery.chargingTime / 60)
      : (battery.dischargingTime === Infinity ? null : battery.dischargingTime / 60);

    // Auto-enable power save mode below 20%
    if (this.isLowPower() && !wasLowPower) {
      this.enablePowerSaveMode(true);
    }

    this.notifyListeners();
  }

  /**
   * Monitor network connection type and speed
   */
  private initNetworkMonitoring() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      this.updateNetworkType(connection.effectiveType);

      connection.addEventListener('change', () => {
        this.updateNetworkType(connection.effectiveType);
      });
    }

    // Also monitor online/offline status
    window.addEventListener('online', () => {
      this.status.networkType = this.detectNetworkType();
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.status.networkType = 'offline';
      this.notifyListeners();
    });
  }

  private updateNetworkType(effectiveType: string) {
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        this.status.networkType = '2g';
        break;
      case '3g':
        this.status.networkType = '3g';
        break;
      case '4g':
        this.status.networkType = '4g';
        break;
      default:
        this.status.networkType = 'wifi';
    }
    
    // Adjust config based on network
    if (['2g', '3g'].includes(this.status.networkType)) {
      this.config.compressImageData = true;
      this.config.deferNonCriticalSync = true;
    }

    this.notifyListeners();
  }

  private detectNetworkType(): '2g' | '3g' | '4g' | '5g' | 'wifi' {
    return 'wifi'; // Default assumption
  }

  /**
   * Check if device is in low power state
   */
  isLowPower(): boolean {
    return this.status.batteryLevel < 20 && !this.status.isCharging;
  }

  /**
   * Enable or disable power save mode
   */
  enablePowerSaveMode(enable: boolean) {
    this.config.powerSaveMode = enable;
    
    if (enable) {
      this.config.disableAnimations = true;
      this.config.enableDarkMode = true;
      this.config.deferNonCriticalSync = true;
      this.config.limitBackgroundTasks = true;
      this.config.compressImageData = true;
      this.config.cacheStrategy = 'aggressive';
      
      // Request screen brightness reduction (if supported)
      this.reduceBrightness(0.5);
    } else {
      this.config.disableAnimations = false;
      this.config.enableDarkMode = false;
      this.config.deferNonCriticalSync = false;
      this.config.limitBackgroundTasks = false;
      this.config.compressImageData = false;
      this.config.cacheStrategy = 'balanced';
      
      this.restoreBrightness();
    }

    // Apply CSS class to document
    if (enable) {
      document.documentElement.classList.add('power-save-mode');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('power-save-mode');
      document.documentElement.classList.remove('dark');
    }

    this.notifyListeners();
  }

  /**
   * Reduce screen brightness using Screen Wake Lock API
   */
  private async reduceBrightness(level: number) {
    try {
      // Note: Full brightness control requires specific APIs not widely supported
      // This is a placeholder for future implementation
      console.log(`Requesting brightness reduction to ${level * 100}%`);
    } catch (error) {
      console.warn('Brightness control not supported');
    }
  }

  private restoreBrightness() {
    console.log('Restoring normal brightness');
  }

  /**
   * Check if a task should be deferred due to power/network constraints
   */
  shouldDeferTask(priority: 'critical' | 'normal' | 'low'): boolean {
    if (!this.config.powerSaveMode) return false;
    
    if (priority === 'critical') return false;
    if (priority === 'low') return true;
    
    // Normal priority: defer if on slow network or very low battery
    return this.status.networkType === '2g' || this.status.batteryLevel < 10;
  }

  /**
   * Get optimal image quality based on power/network
   */
  getImageQuality(): number {
    if (this.config.compressImageData) {
      return 0.6; // 60% quality
    }
    return 0.9; // 90% quality
  }

  /**
   * Subscribe to power status changes
   */
  subscribe(callback: (status: PowerStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.status); // Immediate callback with current status
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener({ ...this.status }));
  }

  /**
   * Get current configuration
   */
  getConfig(): PowerSaverConfig {
    return { ...this.config };
  }

  /**
   * Manually override specific config options
   */
  updateConfig(updates: Partial<PowerSaverConfig>) {
    this.config = { ...this.config, ...updates };
    this.notifyListeners();
  }

  /**
   * Start periodic checks for power optimization
   */
  startOptimizationChecks() {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      // Check if we should auto-enable/disable power save
      if (this.isLowPower() && !this.config.powerSaveMode) {
        this.enablePowerSaveMode(true);
      } else if (!this.isLowPower() && this.status.batteryLevel > 50 && this.config.powerSaveMode) {
        this.enablePowerSaveMode(false);
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop periodic checks
   */
  stopOptimizationChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Singleton instance
export const powerSaverService = new PowerSaverService();

// React Hook for components
export const usePowerStatus = () => {
  const [status, setStatus] = React.useState<PowerStatus>(powerSaverService.status);
  const [config, setConfig] = React.useState<PowerSaverConfig>(powerSaverService.getConfig());

  React.useEffect(() => {
    const unsubscribe = powerSaverService.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return { status, config };
};

// Example usage in a component:
/*
function POSDashboard() {
  const { status, config } = usePowerStatus();

  return (
    <div className={config.disableAnimations ? 'no-animations' : ''}>
      {status.batteryLevel < 20 && !status.isCharging && (
        <div className="bg-yellow-100 p-2 text-sm">
          ⚠️ Low battery ({status.batteryLevel}%). Power saver mode enabled.
        </div>
      )}
      
      <button onClick={() => powerSaverService.enablePowerSaveMode(!config.powerSaveMode)}>
        {config.powerSaveMode ? '🔋 Normal Mode' : '🌙 Power Saver'}
      </button>
    </div>
  );
}
*/

// Add required import for the hook
import React from 'react';
