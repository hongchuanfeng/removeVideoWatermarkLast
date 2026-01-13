'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UserCredits {
  credits: number;
  hasUsedFreeTrial: boolean;
}

export async function getUserCredits(userId: string): Promise<UserCredits> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_credits')
    .select('credits, has_used_free_trial')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user credits:', error);
  }

  return {
    credits: data?.credits || 0,
    hasUsedFreeTrial: data?.has_used_free_trial || false,
  };
}

export function useCredits() {
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshCredits = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const userCredits = await getUserCredits(user.id);
        setCredits(userCredits.credits);
      }
    } catch (error) {
      console.error('Error refreshing credits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCredits();
  }, []);

  return {
    credits,
    loading,
    refreshCredits,
  };
}

