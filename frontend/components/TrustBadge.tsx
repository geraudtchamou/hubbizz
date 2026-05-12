'use client';

import { TRUST_THRESHOLDS } from '@/lib/config';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

interface TrustBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const TrustBadge = ({ score, showLabel = true, size = 'md' }: TrustBadgeProps) => {
  const { color, label, Icon } = getTrustInfo(score);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClasses[size]} ${color}`}
      title={`Trust Score: ${score}/100`}
    >
      <Icon size={iconSizes[size]} />
      {showLabel && <span>{label}</span>}
      {!showLabel && <span>{score}</span>}
    </div>
  );
};

const getTrustInfo = (score: number) => {
  if (score >= TRUST_THRESHOLDS.HIGH) {
    return {
      color: 'bg-green-100 text-green-800',
      label: 'High Trust',
      Icon: ShieldCheck,
    };
  } else if (score >= TRUST_THRESHOLDS.MEDIUM) {
    return {
      color: 'bg-yellow-100 text-yellow-800',
      label: 'Medium Trust',
      Icon: Shield,
    };
  } else {
    return {
      color: 'bg-red-100 text-red-800',
      label: 'Low Trust',
      Icon: ShieldAlert,
    };
  }
};

export const TrustScoreBreakdown = ({ business }: { business: any }) => {
  if (!business.trust_score) return null;

  const breakdown = [
    {
      label: 'Verification',
      score: business.verification_level === 'premium' ? 100 : 
             business.verification_level === 'enhanced' ? 75 :
             business.verification_level === 'basic' ? 50 : 0,
      weight: '30%',
    },
    {
      label: 'Response Time',
      score: business.stats.response_time_hours 
        ? Math.max(0, 100 - (business.stats.response_time_hours * 2))
        : 50,
      weight: '25%',
    },
    {
      label: 'Reviews',
      score: business.stats.average_rating * 20,
      weight: '25%',
    },
    {
      label: 'Completion Rate',
      score: business.stats.completion_rate || 50,
      weight: '20%',
    },
  ];

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-semibold text-gray-900 mb-3">Trust Score Breakdown</h4>
      
      <div className="space-y-3">
        {breakdown.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{item.label}</span>
              <span className="text-gray-900 font-medium">{item.weight}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  item.score >= 80 ? 'bg-green-500' :
                  item.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-gray-900">Overall Score</span>
          <TrustBadge score={business.trust_score} size="lg" />
        </div>
      </div>
    </div>
  );
};
