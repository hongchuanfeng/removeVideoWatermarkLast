'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface Order {
  id: string;
  transaction_id: string;
  product_id: string;
  credits: number;
  created_at: string;
  event_type: string;
}

interface Conversion {
  id: string;
  type: string;
  file_name: string;
  status: string;
  created_at: string;
  result_file_url?: string | null;
}

interface Credits {
  credits: number;
  has_used_free_trial: boolean;
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'conversions' | 'credits'>('credits');
  const [orders, setOrders] = useState<Order[]>([]);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const supabase = createClient();

  const loadData = async (userId: string) => {
    if (!userId) return;

    setLoadingData(true);
    try {
      // Load orders
      const ordersRes = await fetch('/api/profile/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      }

      // Load conversions
      const conversionsRes = await fetch('/api/profile/conversions');
      if (conversionsRes.ok) {
        const conversionsData = await conversionsRes.json();
        setConversions(conversionsData.conversions || []);
      }

      // Load credits
      const creditsRes = await fetch('/api/profile/credits');
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        setCredits(creditsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        loadData(currentUser.id);
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      loadData(user.id);
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-6">{t('title')}</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">{t('loginRequired')}</p>
          <Link
            href="/"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold inline-block"
          >
            {t('login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-8 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {t('title')}
        </h1>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-8 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('credits')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'credits'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            {t('tabs.credits')}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'orders'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            {t('tabs.orders')}
          </button>
          <button
            onClick={() => setActiveTab('conversions')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'conversions'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            {t('tabs.conversions')}
          </button>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {loadingData ? (
            <div className="flex justify-center items-center py-16">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Credits Tab */}
              {activeTab === 'credits' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6">{t('credits.title')}</h2>
                  {credits ? (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl">
                        <h3 className="text-lg font-semibold mb-2">{t('credits.currentCredits')}</h3>
                        <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{credits.credits}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                        <h3 className="text-lg font-semibold mb-2">{t('credits.freeTrialUsed')}</h3>
                        <p className="text-2xl font-semibold">
                          {credits.has_used_free_trial ? (
                            <span className="text-red-600 dark:text-red-400">✓ {t('credits.freeTrialUsed')}</span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">✓ {t('credits.freeTrialAvailable')}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400">{t('credits.loading')}</p>
                  )}
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6">{t('orders.title')}</h2>
                  {orders.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400 text-center py-8">{t('orders.noOrders')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 font-semibold">{t('orders.transactionId')}</th>
                            <th className="text-left py-3 px-4 font-semibold">{t('orders.productId')}</th>
                            <th className="text-left py-3 px-4 font-semibold">{t('orders.credits')}</th>
                            <th className="text-left py-3 px-4 font-semibold">{t('orders.date')}</th>
                            <th className="text-left py-3 px-4 font-semibold">{t('orders.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="py-3 px-4 text-sm">{order.transaction_id}</td>
                              <td className="py-3 px-4 text-sm">{order.product_id}</td>
                              <td className="py-3 px-4 text-sm font-semibold text-blue-600 dark:text-blue-400">{order.credits}</td>
                              <td className="py-3 px-4 text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm">
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded text-xs">
                                  Paid
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Conversions Tab */}
              {activeTab === 'conversions' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6">{t('conversions.title')}</h2>
                  {conversions.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400 text-center py-8">{t('conversions.noConversions')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 font-semibold">{t('conversions.type')}</th>
                            <th className="text-left py-3 px-4 font-semibold">{t('conversions.fileName')}</th>
                            <th className="text-left py-3 px-4 font-semibold">{t('conversions.status')}</th>
                            <th className="text-left py-3 px-4 font-semibold">{t('conversions.date')}</th>
                            <th className="text-left py-3 px-4 font-semibold">{t('conversions.result')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conversions.map((conversion) => (
                            <tr key={conversion.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="py-3 px-4 text-sm">{conversion.type}</td>
                              <td className="py-3 px-4 text-sm">{conversion.file_name}</td>
                              <td className="py-3 px-4 text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  conversion.status === 'completed' 
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                                }`}>
                                  {conversion.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm">{new Date(conversion.created_at).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm">
                                {conversion.result_file_url ? (
                                  <a
                                    href={conversion.result_file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {t('conversions.download')}
                                  </a>
                                ) : (
                                  <span className="text-gray-400 text-xs">
                                    {t('conversions.noResult')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

