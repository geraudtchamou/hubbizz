import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import useAppStore from '../store/appStore';

const Dashboard: React.FC = () => {
  const { currency } = useAppStore();

  // Mock data - replace with actual data from database/API
  const stats = {
    todaySales: 125000,
    yesterdaySales: 98000,
    todayProfit: 35000,
    yesterdayProfit: 28000,
    totalProducts: 245,
    lowStockProducts: 12,
    totalClients: 189,
    newClientsToday: 5,
  };

  const salesTrend = [
    { day: 'Mon', amount: 85000 },
    { day: 'Tue', amount: 92000 },
    { day: 'Wed', amount: 78000 },
    { day: 'Thu', amount: 105000 },
    { day: 'Fri', amount: 125000 },
    { day: 'Sat', amount: 145000 },
    { day: 'Sun', amount: 98000 },
  ];

  const topProducts = [
    { name: 'Rice 5kg', sales: 45000, profit: 12000 },
    { name: 'Cooking Oil 1L', sales: 38000, profit: 9500 },
    { name: 'Sugar 1kg', sales: 32000, profit: 8000 },
    { name: 'Tomato Paste', sales: 28000, profit: 7200 },
    { name: 'Onions 1kg', sales: 25000, profit: 6500 },
  ];

  const recentSales = [
    { id: 'TXN001', customer: 'Walk-in', amount: 15000, time: '10:45 AM', status: 'completed' },
    { id: 'TXN002', customer: 'John Doe', amount: 28000, time: '11:20 AM', status: 'completed' },
    { id: 'TXN003', customer: 'Walk-in', amount: 8500, time: '12:05 PM', status: 'completed' },
    { id: 'TXN004', customer: 'Mary Smith', amount: 42000, time: '12:30 PM', status: 'pending' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            New Sale
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <span className={`flex items-center text-sm font-medium ${
              stats.todaySales >= stats.yesterdaySales 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {stats.todaySales >= stats.yesterdaySales ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              {Math.round(((stats.todaySales - stats.yesterdaySales) / stats.yesterdaySales) * 100)}%
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-1">Today's Sales</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(stats.todaySales, currency)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Yesterday: {formatCurrency(stats.yesterdaySales, currency)}
          </p>
        </div>

        {/* Profit */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-green-600">
              +{Math.round(((stats.todayProfit - stats.yesterdayProfit) / stats.yesterdayProfit) * 100)}%
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-1">Today's Profit</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(stats.todayProfit, currency)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Yesterday: {formatCurrency(stats.yesterdayProfit, currency)}
          </p>
        </div>

        {/* Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            {stats.lowStockProducts > 0 && (
              <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                {stats.lowStockProducts} low stock
              </span>
            )}
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Products</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.lowStockProducts} products need restocking
          </p>
        </div>

        {/* Clients */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-green-600">
              +{stats.newClientsToday} today
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Clients</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.newClientsToday} new clients today
          </p>
        </div>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Sales Trend</h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {salesTrend.map((day) => {
              const maxAmount = Math.max(...salesTrend.map(d => d.amount));
              const height = (day.amount / maxAmount) * 100;
              
              return (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-primary-500 rounded-t-lg transition-all hover:bg-primary-600"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-gray-600">{day.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h3>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={product.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      Profit: {formatCurrency(product.profit, currency)}
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(product.sales, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Sales</h3>
          <button className="text-primary-600 text-sm font-medium hover:text-primary-700">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Transaction ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Time</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => (
                <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{sale.id}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{sale.customer}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                    {formatCurrency(sale.amount, currency)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{sale.time}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      sale.status === 'completed' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {sale.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
