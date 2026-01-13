import { createClient } from '@/lib/supabase/server';

export interface UserCredits {
  credits: number;
  hasUsedFreeTrial: boolean;
}

export async function getUserCredits(userId: string): Promise<UserCredits> {
  const supabase = await createClient();
  
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

export async function canUseFreeTrial(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId);
  return !credits.hasUsedFreeTrial && credits.credits === 0;
}

export async function useFreeTrial(userId: string): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('user_credits')
    .upsert({
      user_id: userId,
      has_used_free_trial: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });
}

export async function consumeCredits(userId: string, amount: number): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: currentCredits } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();

  const credits = currentCredits?.credits || 0;
  
  if (credits < amount) {
    return false;
  }

  const { error } = await supabase
    .from('user_credits')
    .update({
      credits: credits - amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return !error;
}

