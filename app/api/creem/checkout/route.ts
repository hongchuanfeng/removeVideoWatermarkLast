import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, user_id, email } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const creemApiKey = process.env.CREEM_API_KEY;
    const creemApiUrl =
      (process.env.CREEM_API_URL || process.env.NEXT_PUBLIC_CREEM_API_URL || '').replace(/\/+$/, '') ||
      'https://api.creem.io';
    const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000';

    if (!creemApiKey) {
      console.error('CREEM_API_KEY not configured');
      return NextResponse.json({ error: 'Creem API key not configured' }, { status: 500 });
    }

    const requestPayload = {
      product_id: product_id,
      metadata: {
        internal_customer_id: user_id || user.id,
        email: email || (user.email ?? undefined),
      },
    };

    console.log('Creating Creem checkout with payload:', JSON.stringify(requestPayload, null, 2));
    console.log('API Key present:', !!creemApiKey, 'Length:', creemApiKey?.length);
    console.log('Using Creem API URL:', creemApiUrl);

    try {
      const response = await axios.post(
        `${creemApiUrl}/v1/checkouts`,
        requestPayload,
        {
          headers: {
            'x-api-key': creemApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Creem API response status:', response.status);
      console.log('Creem API response data:', JSON.stringify(response.data, null, 2));

      const checkoutUrl = response.data.checkout_url || response.data.url;
      if (!checkoutUrl) {
        console.error('No checkout URL in response:', response.data);
        return NextResponse.json(
          { error: 'No checkout URL returned from Creem API' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        checkout_url: checkoutUrl,
      });
    } catch (axiosError: any) {
      // 详细的错误日志
      console.error('Creem API request failed:');
      console.error('  Status:', axiosError.response?.status);
      console.error('  Status Text:', axiosError.response?.statusText);
      console.error('  Response Data:', JSON.stringify(axiosError.response?.data, null, 2));
      console.error('  Request Payload:', JSON.stringify(requestPayload, null, 2));
      console.error('  Error Message:', axiosError.message);
      console.error('  Full Error:', axiosError);

      // 返回更详细的错误信息
      const errorMessage = axiosError.response?.data?.message || 
                          axiosError.response?.data?.error ||
                          axiosError.message ||
                          'Failed to create checkout';
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: axiosError.response?.data,
          status: axiosError.response?.status,
        },
        { status: axiosError.response?.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error in checkout route:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create checkout',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

