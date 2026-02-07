import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    if (creditsError || !userCredits || userCredits.credits < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 });
    }

    let audioUrl: string | undefined;
    try {
      const body = await request.json();
      audioUrl = body?.audioUrl;

      if (!audioUrl) {
        return NextResponse.json({ error: 'Invalid request data: missing audioUrl' }, { status: 400 });
      }
    } catch (bodyErr) {
      console.error('Error parsing request body:', bodyErr);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Deduct credits first
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ credits: userCredits.credits - 1 })
      .eq('user_id', user.id);
    if (updateError) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    try {
      // Mock audio watermark removal processing
      // In production, this would call Tencent Cloud CI Audio Watermark Removal API
      const outputKey = `audio/watermarked/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
      const processedAudioUrl = `https://accelerate.removewatermarker.com/${outputKey}`;

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { error: recordError } = await supabase.from('conversion_records').insert({
        user_id: user.id,
        input_type: 'audio',
        type: 'audio_watermark_removal',
        file_name: 'audio-watermark-removal.mp3',
        input_url: audioUrl,
        output_url: processedAudioUrl,
        status: 'completed',
        credits_used: 1,
      });
      if (recordError) {
        console.error('Failed to save conversion record:', recordError);
      }

      return NextResponse.json({
        processedUrl: processedAudioUrl,
        creditsRemaining: userCredits.credits - 1,
      });
    } catch (processError) {
      console.error('Audio watermark removal processing error:', processError);
      await supabase.from('user_credits').update({ credits: userCredits.credits }).eq('user_id', user.id);
      return NextResponse.json({ error: 'Audio processing failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

