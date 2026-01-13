import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional, for security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const timestamp = new Date().toISOString();
    const logData = `Keep-alive heartbeat at ${timestamp}`;

    // Insert log record directly into database
    const { data, error } = await supabase
      .from('system_logs')
      .insert({
        log_time: timestamp,
        log_data: logData,
        created_at: timestamp,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting keep-alive log:', error);
      return NextResponse.json(
        { error: 'Failed to insert log', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Keep-alive log inserted successfully',
      log: {
        id: data.id,
        log_time: data.log_time,
        log_data: data.log_data,
        created_at: data.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error in keep-alive cron job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Also support POST method for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}

