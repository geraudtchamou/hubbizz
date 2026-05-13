/**
 * AfrHub PWA - Animated UI Components
 * Reusable components with built-in animations and interactions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimationType, getAnimationStyle, microInteractions, prefersReducedMotion } from '../theme/animations';
import { useTheme } from '../theme/useThemeManager';

// ============================================================================
// Animated Button Component
// ============================================================================

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  animation?: AnimationType;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  animation = 'scale',
  className = '',
  disabled,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { palette, animationsEnabled } = useTheme();
  const reducedMotion = prefersReducedMotion();

  const baseStyles = "relative overflow-hidden font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: `bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] focus:ring-[var(--color-primary-500)]`,
    secondary: `bg-[var(--color-secondary-500)] text-white hover:bg-[var(--color-secondary-600)] focus:ring-[var(--color-secondary-500)]`,
    accent: `bg-[var(--color-accent-500)] text-white hover:bg-[var(--color-accent-600)] focus:ring-[var(--color-accent-500)]`,
    outline: `border-2 border-[var(--color-primary-500)] text-[var(--color-primary-500)] hover:bg-[var(--color-primary-50)] focus:ring-[var(--color-primary-500)]`,
    ghost: `text-[var(--color-primary-500)] hover:bg-[var(--color-primary-50)] focus:ring-[var(--color-primary-500)]`
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const handlePress = () => {
    if (!disabled && !isLoading) {
      setIsPressed(true);
    }
  };

  const handleRelease = () => {
    setIsPressed(false);
  };

  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current || reducedMotion || !animationsEnabled) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Date.now();

    setRipples(prev => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  };

  const animationStyle = animationsEnabled && !reducedMotion ? {
    transform: isPressed ? 'scale(0.95)' : 'scale(1)',
    transition: 'transform 100ms ease-out'
  } : {};

  return (
    <button
      ref={buttonRef}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      onMouseDown={(e) => {
        createRipple(e);
        handlePress();
      }}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      style={animationStyle}
      {...props}
    >
      {/* Ripples */}
      {animationsEnabled && !reducedMotion && ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 animate-ping"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
            transform: 'translate(-50%, -50%)',
            animation: 'ripple 600ms linear'
          }}
        />
      ))}

      {/* Content */}
      <span className="relative flex items-center justify-center gap-2">
        {isLoading ? (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <>
            {leftIcon && <span>{leftIcon}</span>}
            {children}
            {rightIcon && <span>{rightIcon}</span>}
          </>
        )}
      </span>
    </button>
  );
};

// ============================================================================
// Animated Card Component
// ============================================================================

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  animation?: AnimationType;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = true,
  animation = 'slide'
}) => {
  const { palette, animationsEnabled } = useTheme();
  const reducedMotion = prefersReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  const cardStyle: React.CSSProperties = animationsEnabled && !reducedMotion && hoverable ? {
    transition: 'all 200ms ease-out',
    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
    boxShadow: isHovered 
      ? '0 12px 24px rgba(0,0,0,0.1)' 
      : '0 4px 8px rgba(0,0,0,0.05)',
    cursor: onClick ? 'pointer' : 'default'
  } : {};

  return (
    <div
      className={`bg-[var(--bg-paper)] rounded-xl border border-[var(--border-light)] overflow-hidden ${className}`}
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Animated List Item Component
// ============================================================================

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  className?: string;
  onClick?: () => void;
  staggerDelay?: number;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  index,
  className = '',
  onClick,
  staggerDelay = 50
}) => {
  const { animationsEnabled } = useTheme();
  const reducedMotion = prefersReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, index * staggerDelay);

    return () => clearTimeout(timer);
  }, [index, staggerDelay]);

  const itemStyle: React.CSSProperties = animationsEnabled && !reducedMotion ? {
    transition: 'all 300ms ease-out',
    transform: isVisible ? 'translateX(0)' : 'translateX(-10px)',
    opacity: isVisible ? 1 : 0
  } : {
    opacity: 1,
    transform: 'translateX(0)'
  };

  return (
    <div
      className={`p-4 border-b border-[var(--border-light)] last:border-b-0 hover:bg-[var(--bg-surface)] transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={itemStyle}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// ============================================================================
// Animated Modal Component
// ============================================================================

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md'
}) => {
  const { animationsEnabled } = useTheme();
  const reducedMotion = prefersReducedMotion();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  const backdropStyle: React.CSSProperties = animationsEnabled && !reducedMotion ? {
    transition: 'opacity 200ms ease-out',
    opacity: isVisible ? 1 : 0
  } : { opacity: 1 };

  const contentStyle: React.CSSProperties = animationsEnabled && !reducedMotion ? {
    transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
    transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
    opacity: isVisible ? 1 : 0
  } : { opacity: 1, transform: 'scale(1) translateY(0)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={backdropStyle}
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div
        className={`relative bg-[var(--bg-paper)] rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden`}
        style={contentStyle}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-light)]">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--bg-surface)] rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Animated Toast Notification Component
// ============================================================================

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  const { animationsEnabled } = useTheme();
  const reducedMotion = prefersReducedMotion();

  const typeStyles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] ${typeStyles[toast.type]}`}
          style={animationsEnabled && !reducedMotion ? {
            animation: 'slideInRight 300ms ease-out',
            animationDelay: `${index * 100}ms`,
            animationFillMode: 'forwards'
          } : {}}
        >
          {toast.type === 'success' && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.type === 'warning' && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {toast.type === 'info' && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          
          <span className="flex-1">{toast.message}</span>
          
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Number Counter Component (Animated)
// ============================================================================

interface NumberCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export const NumberCounter: React.FC<NumberCounterProps> = ({
  value,
  prefix = '',
  suffix = '',
  duration = 500,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const { animationsEnabled } = useTheme();
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (!animationsEnabled || reducedMotion) {
      setDisplayValue(value);
      return;
    }

    const startTime = Date.now();
    const startValue = displayValue;
    const change = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setDisplayValue(startValue + change * easeOutQuart);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, animationsEnabled, reducedMotion, duration]);

  return (
    <span className={className}>
      {prefix}{Math.round(displayValue).toLocaleString()}{suffix}
    </span>
  );
};

// Export all components
export default {
  AnimatedButton,
  AnimatedCard,
  AnimatedListItem,
  AnimatedModal,
  ToastContainer,
  NumberCounter
};
