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

    const { data: conversions, error } = await supabase
      .from('conversion_records')
      .select('id, type, file_name, status, created_at, result_file_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return NextResponse.json({ conversions: [] });
      }
      console.error('Error fetching conversions:', error);
      return NextResponse.json({ error: 'Failed to fetch conversions' }, { status: 500 });
    }

    return NextResponse.json({ conversions: conversions || [] });
  } catch (error: any) {
    console.error('Error in conversions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

