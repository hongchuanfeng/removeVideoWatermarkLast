'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// 统一读取产品 ID：优先 NEXT_PUBLIC，其次服务端变量，最后默认值
// 注意：客户端组件只能访问 NEXT_PUBLIC_ 开头的环境变量
const resolveProductId = (publicKey: string | undefined, serverKey: string | undefined, fallback: string) => {
  const result = publicKey || serverKey || fallback;
  // 调试日志（仅在开发环境）
  if (process.env.NODE_ENV === 'development' && !publicKey && !serverKey) {
    console.warn('Using fallback product ID. Please set NEXT_PUBLIC_CREEM_PRODUCT_*_ID in .env.local');
  }
  return result;
};

const PLANS = [
  {
    id: 'basic',
    productId: resolveProductId(
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_BASIC_ID,
      process.env.CREEM_PRODUCT_BASIC_ID,
      'prod_N6rm4KG1ZeGvfnNOIzkjt'
    ),
    nameKey: 'basic.name',
    price: '$39.9',
    periodKey: 'basic.period',
    credits: '30',
    creditsKey: 'basic.credits',
    descriptionKey: 'basic.description',
    popular: false,
  },
  {
    id: 'standard',
    productId: resolveProductId(
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_STANDARD_ID,
      process.env.CREEM_PRODUCT_STANDARD_ID,
      'prod_3CQsZ5gNb1Nhkl9a3Yxhs2'
    ),
    nameKey: 'standard.name',
    price: '$119.9',
    periodKey: 'standard.period',
    credits: '100',
    creditsKey: 'standard.credits',
    descriptionKey: 'standard.description',
    popular: true,
  },
  {
    id: 'premium',
    productId: resolveProductId(
      process.env.NEXT_PUBLIC_CREEM_PRODUCT_PREMIUM_ID,
      process.env.CREEM_PRODUCT_PREMIUM_ID,
      'prod_5h3JThYd4iw4SIDm6L5sCO'
    ),
    nameKey: 'premium.name',
    price: '$239.9',
    periodKey: 'premium.period',
    credits: '210',
    creditsKey: 'premium.credits',
    descriptionKey: 'premium.description',
    popular: false,
  },
];

export default function SubscriptionPage() {
  const t = useTranslations('subscription');
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    
    // 开发环境：打印实际使用的产品 ID
    if (process.env.NODE_ENV === 'development') {
      console.log('Product IDs being used:');
      PLANS.forEach(plan => {
        console.log(`  ${plan.id}: ${plan.productId}`);
      });
      console.log('Environment variables:');
      console.log('  NEXT_PUBLIC_CREEM_PRODUCT_BASIC_ID:', process.env.NEXT_PUBLIC_CREEM_PRODUCT_BASIC_ID || 'not set');
      console.log('  CREEM_PRODUCT_BASIC_ID:', process.env.CREEM_PRODUCT_BASIC_ID || 'not set (client components cannot access server env vars)');
    }
  }, [supabase.auth]);

  const handleSubscribe = async (plan: typeof PLANS[0]) => {
    if (!user) {
      alert(t('loginRequired'));
      return;
    }

    setProcessing(plan.id);

    try {
      const response = await fetch('/api/creem/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: plan.productId,
          user_id: user.id,
          email: user.email,
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        setProcessing(null);
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert(t('error'));
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
            {t('subtitle')}
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-500">
            {t('description')}
          </p>
        </div>

        {/* Free Trial Notice */}
        {!user && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-12 text-center">
            <h3 className="text-xl font-semibold mb-2">{t('freeTrial.title')}</h3>
            <p className="text-gray-700 dark:text-gray-300">{t('freeTrial.description')}</p>
          </div>
        )}

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 ${
                plan.popular ? 'ring-2 ring-blue-600 scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {t('standard.popular')}
                  </span>
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{t(plan.nameKey)}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-600 dark:text-gray-400">{t(plan.periodKey)}</span>
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {t(plan.creditsKey)}
                </div>
                <p className="text-gray-600 dark:text-gray-400">{t(plan.descriptionKey)}</p>
              </div>
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={processing === plan.id}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processing === plan.id ? t('processing') : t(`${plan.id}.button`)}
              </button>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 mb-8">
          <h2 className="text-3xl font-bold text-center mb-8">{t('features.title')}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="font-semibold mb-1">{t('features.videoToSubtitle')}</h3>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="font-semibold mb-1">{t('features.creditBased')}</h3>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="font-semibold mb-1">{t('features.monthlyRenewal')}</h3>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="font-semibold mb-1">{t('features.cancelAnytime')}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Rules */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">{t('pricingRules.title')}</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">{t('pricingRules.subtitle')}</p>
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{t('pricingRules.rule1')}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{t('pricingRules.rule2')}</p>
                </div>
              </div>
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('pricingRules.note')}</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">{t('faq.title')}</h2>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((num) => (
              <FAQItem
                key={num}
                question={t(`faq.q${num}`)}
                answer={t(`faq.a${num}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// FAQ Accordion Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gray-800 dark:bg-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
      >
        <span className="text-white font-medium pr-4">{question}</span>
        <svg
          className={`w-5 h-5 text-white flex-shrink-0 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-6 py-4 bg-gray-900 dark:bg-gray-800 text-gray-300 dark:text-gray-400">
          {answer}
        </div>
      )}
    </div>
  );
}

