import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: creditsData, error } = await supabase
      .from('user_credits')
      .select('credits, has_used_free_trial')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching credits:', error);
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    return NextResponse.json({
      credits: creditsData?.credits || 0,
      has_used_free_trial: creditsData?.has_used_free_trial || false,
    });
  } catch (error: any) {
    console.error('Error in credits API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

