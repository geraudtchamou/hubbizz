// Placeholder pages - to be implemented
import React from 'react';

const POS: React.FC = () => (
  <div className="space-y-4">
    <h1 className="text-2xl font-bold text-gray-900">POS Terminal</h1>
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <p className="text-gray-600">Point of Sale interface for processing transactions offline-first.</p>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Product cards will go here */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="w-full h-32 bg-gray-100 rounded-lg mb-3"></div>
            <h3 className="font-medium text-gray-900">Product {i + 1}</h3>
            <p className="text-sm text-gray-500">FCFA {(Math.random() * 10000).toFixed(0)}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default POS;
