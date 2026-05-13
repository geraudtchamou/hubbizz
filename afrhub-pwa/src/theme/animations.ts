/**
 * AfrHub PWA - Animation & Interaction System
 * Smooth, performant animations optimized for mobile devices
 */

export type AnimationType = 
  | 'fade'
  | 'slide'
  | 'scale'
  | 'bounce'
  | 'shake'
  | 'pulse'
  | 'rotate'
  | 'flip'
  | 'swing'
  | 'zoom';

export interface AnimationConfig {
  duration: number;        // ms
  delay?: number;          // ms
  easing: string;          // CSS easing function
  iterations?: number;     // Number of times to repeat
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

export const defaultEasings = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  cubicBezier: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
  smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
};

export const animationPresets: Record<AnimationType, AnimationConfig> = {
  fade: {
    duration: 300,
    easing: defaultEasings.easeInOut,
    fillMode: 'forwards'
  },
  slide: {
    duration: 400,
    easing: defaultEasings.smooth,
    fillMode: 'forwards'
  },
  scale: {
    duration: 250,
    easing: defaultEasings.spring,
    fillMode: 'forwards'
  },
  bounce: {
    duration: 600,
    easing: defaultEasings.bounce,
    fillMode: 'forwards'
  },
  shake: {
    duration: 500,
    easing: defaultEasings.easeInOut,
    iterations: 1
  },
  pulse: {
    duration: 1000,
    easing: defaultEasings.easeInOut,
    iterations: Infinity,
    direction: 'alternate'
  },
  rotate: {
    duration: 400,
    easing: defaultEasings.easeInOut,
    fillMode: 'forwards'
  },
  flip: {
    duration: 500,
    easing: defaultEasings.spring,
    fillMode: 'forwards'
  },
  swing: {
    duration: 500,
    easing: defaultEasings.elastic,
    fillMode: 'forwards'
  },
  zoom: {
    duration: 300,
    easing: defaultEasings.cubicBezier,
    fillMode: 'forwards'
  }
};

export const generateKeyframes = (type: AnimationType, options?: Partial<AnimationConfig>): string => {
  const config = { ...animationPresets[type], ...options };
  
  switch (type) {
    case 'fade':
      return `
        @keyframes fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
    
    case 'slide':
      return `
        @keyframes slideInUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
    
    case 'scale':
      return `
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes scaleOut {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(0.9); opacity: 0; }
        }
      `;
    
    case 'bounce':
      return `
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `;
    
    case 'shake':
      return `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
      `;
    
    case 'pulse':
      return `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
    
    case 'rotate':
      return `
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
    
    case 'flip':
      return `
        @keyframes flipIn {
          from { transform: perspective(400px) rotateY(90deg); opacity: 0; }
          to { transform: perspective(400px) rotateY(0); opacity: 1; }
        }
        @keyframes flipOut {
          from { transform: perspective(400px) rotateY(0); opacity: 1; }
          to { transform: perspective(400px) rotateY(90deg); opacity: 0; }
        }
      `;
    
    case 'swing':
      return `
        @keyframes swing {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          80% { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
        }
      `;
    
    case 'zoom':
      return `
        @keyframes zoomIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `;
    
    default:
      return '';
  }
};

export const getAnimationStyle = (
  type: AnimationType,
  variant?: string,
  options?: Partial<AnimationConfig>
): React.CSSProperties => {
  const config = { ...animationPresets[type], ...options };
  const animationName = variant ? `${type}${variant}` : type;
  
  return {
    animation: `${animationName} ${config.duration}ms ${config.easing}`,
    animationIterationCount: config.iterations || 1,
    animationDirection: config.direction || 'normal',
    animationFillMode: config.fillMode || 'none',
    animationDelay: config.delay ? `${config.delay}ms` : '0s'
  };
};

// Micro-interaction patterns for common UI actions
export const microInteractions = {
  buttonPress: {
    active: { transform: 'scale(0.95)' },
    release: { transform: 'scale(1)' },
    transition: 'transform 100ms ease-out'
  },
  
  cardHover: {
    hover: { 
      transform: 'translateY(-4px)',
      boxShadow: '0 12px 24px rgba(0,0,0,0.1)'
    },
    leave: { 
      transform: 'translateY(0)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.05)'
    },
    transition: 'all 200ms ease-out'
  },
  
  listItemEnter: {
    enter: { 
      transform: 'translateX(-10px)',
      opacity: 0
    },
    entered: { 
      transform: 'translateX(0)',
      opacity: 1
    },
    transition: 'all 300ms ease-out'
  },
  
  modalOpen: {
    backdrop: { 
      opacity: 0,
      transition: 'opacity 200ms ease-out'
    },
    content: { 
      transform: 'scale(0.9) translateY(20px)',
      opacity: 0,
      transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)'
    },
    opened: { 
      opacity: 1,
      transform: 'scale(1) translateY(0)'
    }
  },
  
  toastSlide: {
    enter: { 
      transform: 'translateX(100%)',
      opacity: 0
    },
    entered: { 
      transform: 'translateX(0)',
      opacity: 1
    },
    exit: { 
      transform: 'translateX(100%)',
      opacity: 0
    },
    transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  successCheckmark: {
    draw: { 
      strokeDashoffset: 100,
      transition: 'stroke-dashoffset 400ms ease-out'
    },
    drawn: { 
      strokeDashoffset: 0
    },
    scale: { 
      transform: 'scale(0)',
      transition: 'transform 200ms ease-out'
    },
    scaled: { 
      transform: 'scale(1)'
    }
  },
  
  loadingSpinner: {
    spin: {
      animation: 'spin 1s linear infinite',
      '@keyframes spin': {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' }
      }
    }
  },
  
  ripple: {
    create: {
      position: 'absolute',
      borderRadius: '50%',
      transform: 'scale(0)',
      animation: 'ripple 600ms linear',
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      '@keyframes ripple': {
        to: {
          transform: 'scale(4)',
          opacity: 0
        }
      }
    }
  },
  
  numberCounter: {
    countUp: {
      transition: 'all 500ms ease-out'
    }
  },
  
  progressBar: {
    fill: {
      transition: 'width 300ms ease-out'
    }
  }
};

// Gesture-based animations
export const gestureAnimations = {
  swipeLeft: {
    start: { x: 0, opacity: 1 },
    end: { x: -200, opacity: 0, rotate: -10 },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  
  swipeRight: {
    start: { x: 0, opacity: 1 },
    end: { x: 200, opacity: 0, rotate: 10 },
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  
  pullToRefresh: {
    pulling: { y: 0 },
    pulled: { y: 100 },
    releasing: { y: 0, scale: 1 },
    refreshing: { rotate: '360deg' }
  },
  
  dragAndDrop: {
    dragging: { 
      scale: 1.05,
      boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
      zIndex: 1000
    },
    dropped: { 
      scale: 1,
      boxShadow: '0 4px 8px rgba(0,0,0,0.05)',
      zIndex: 1
    }
  },
  
  longPress: {
    pressing: { 
      scale: 0.95,
      opacity: 0.8
    },
    released: { 
      scale: 1,
      opacity: 1
    }
  }
};

// Page transition animations
export const pageTransitions = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 }
  },
  
  slideLeft: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
    transition: { duration: 0.3, ease: 'easeInOut' }
  },
  
  slideRight: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
    transition: { duration: 0.3, ease: 'easeInOut' }
  },
  
  slideUp: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '-100%' },
    transition: { duration: 0.3, ease: 'easeInOut' }
  },
  
  zoomFade: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { duration: 0.2 }
  },
  
  flip: {
    initial: { rotateY: -90, opacity: 0 },
    animate: { rotateY: 0, opacity: 1 },
    exit: { rotateY: 90, opacity: 0 },
    transition: { duration: 0.3 }
  }
};

// Utility functions
export const createAnimationClass = (
  type: AnimationType,
  variant?: string,
  options?: Partial<AnimationConfig>
): string => {
  const name = variant ? `${type}-${variant}` : type;
  return `animate-${name}`;
};

export const combineAnimations = (
  ...animations: Array<{ type: AnimationType; delay?: number }>
): string => {
  return animations.map(a => createAnimationClass(a.type, undefined, { delay: a.delay })).join(' ');
};

// Performance optimization: Reduce motion for users who prefer it
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const getOptimizedAnimation = (
  type: AnimationType,
  options?: Partial<AnimationConfig>
): Partial<AnimationConfig> => {
  if (prefersReducedMotion()) {
    return {
      duration: 1,
      easing: 'linear',
      ...options
    };
  }
  return { ...animationPresets[type], ...options };
};
