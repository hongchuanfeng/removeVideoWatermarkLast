import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as crypto from 'crypto';

export const dynamic = 'force-dynamic';

function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  const requestId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] ========================================`);
  console.log(`[${requestId}] Webhook request received at ${new Date().toISOString()}`);
  console.log(`[${requestId}] Request URL: ${request.url}`);
  console.log(`[${requestId}] Request method: ${request.method}`);
  
  try {
    const creemSecret = process.env.CREEM_WEBHOOK_SECRET;
    
    if (!creemSecret) {
      console.error(`[${requestId}] ERROR: CREEM_WEBHOOK_SECRET not configured`);
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    
    console.log(`[${requestId}] CREEM_WEBHOOK_SECRET configured: ${creemSecret ? 'Yes' : 'No'}`);

    // Log all headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log(`[${requestId}] Request headers:`, JSON.stringify(headers, null, 2));

    const signature = request.headers.get('creem-signature');
    console.log(`[${requestId}] Signature header: ${signature ? 'Present' : 'Missing'}`);
    
    const rawBody = await request.text();
    console.log(`[${requestId}] Raw body length: ${rawBody.length} bytes`);
    console.log(`[${requestId}] Raw body preview: ${rawBody.substring(0, 500)}...`);
    
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
      console.log(`[${requestId}] Payload parsed successfully`);
      console.log(`[${requestId}] Payload structure:`, {
        hasEventType: !!payload.eventType,
        hasObject: !!payload.object,
        objectId: payload.object?.id,
        objectType: payload.object?.object,
      });
    } catch (parseError: any) {
      console.error(`[${requestId}] ERROR: Failed to parse JSON payload:`, parseError.message);
      console.error(`[${requestId}] Raw body:`, rawBody);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Verify signature
    if (signature) {
      console.log(`[${requestId}] Verifying signature...`);
      const computedSignature = generateSignature(rawBody, creemSecret);
      console.log(`[${requestId}] Computed signature: ${computedSignature.substring(0, 20)}...`);
      console.log(`[${requestId}] Received signature: ${signature.substring(0, 20)}...`);
      
      if (signature !== computedSignature) {
        console.error(`[${requestId}] ERROR: Invalid signature`);
        console.error(`[${requestId}] Expected: ${computedSignature}`);
        console.error(`[${requestId}] Received: ${signature}`);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log(`[${requestId}] Signature verification passed`);
    } else {
      console.warn(`[${requestId}] WARNING: No signature header, skipping verification`);
    }

    const { eventType, object } = payload;

    console.log(`[${requestId}] ========================================`);
    console.log(`[${requestId}] Processing webhook event`);
    console.log(`[${requestId}] Event type: ${eventType}`);
    console.log(`[${requestId}] Object ID: ${object?.id}`);
    console.log(`[${requestId}] Object type: ${object?.object}`);
    console.log(`[${requestId}] Full payload:`, JSON.stringify(payload, null, 2));

    // Determine transaction ID based on event type
    let transactionId: string | null = null;
    let userId: string | null = null;
    let credits: number = 0;
    let productId: string | null = null;

    // Map product IDs to credits (defined once for reuse)
    const basicProductId = process.env.CREEM_PRODUCT_BASIC_ID || 'prod_N6rm4KG1ZeGvfnNOIzkjt';
    const standardProductId = process.env.CREEM_PRODUCT_STANDARD_ID || 'prod_3CQsZ5gNb1Nhkl9a3Yxhs2';
    const premiumProductId = process.env.CREEM_PRODUCT_PREMIUM_ID || 'prod_5h3JThYd4iw4SIDm6L5sCO';
    
    console.log(`[${requestId}] Environment product IDs:`, {
      CREEM_PRODUCT_BASIC_ID: process.env.CREEM_PRODUCT_BASIC_ID || 'Not set (using default)',
      CREEM_PRODUCT_STANDARD_ID: process.env.CREEM_PRODUCT_STANDARD_ID || 'Not set (using default)',
      CREEM_PRODUCT_PREMIUM_ID: process.env.CREEM_PRODUCT_PREMIUM_ID || 'Not set (using default)',
      basicProductId,
      standardProductId,
      premiumProductId,
    });
    
    const productCreditsMap: Record<string, number> = {
      [basicProductId]: 30, // Basic - $39.9
      [standardProductId]: 100, // Standard - $119.9
      [premiumProductId]: 210, // Premium - $239.9
      'prod_1l9cjsowPhSJlsfrTTXlKb': 30, // Test product
    };

    console.log(`[${requestId}] Product credits map:`, JSON.stringify(productCreditsMap, null, 2));

    if (eventType === 'subscription.paid' && object?.last_transaction_id) {
      console.log(`[${requestId}] Processing subscription.paid event`);
      transactionId = object.last_transaction_id;
      userId = object.metadata?.internal_customer_id || null;
      productId = object.product?.id || null;
      
      console.log(`[${requestId}] subscription.paid event details:`, {
        transactionId,
        userId,
        productId,
        lastTransactionId: object.last_transaction_id,
        productObject: object.product,
        metadata: object.metadata,
        fullObject: JSON.stringify(object, null, 2),
      });
      
      credits = productCreditsMap[productId || ''] || 0;
      
      console.log(`[${requestId}] Calculated credits for subscription.paid:`, {
        productId,
        credits,
        matched: productId && productCreditsMap[productId] !== undefined,
        productInMap: productId ? Object.keys(productCreditsMap).includes(productId) : false,
      });
    } else if (eventType === 'checkout.completed' && object?.order?.status === 'paid') {
      console.log(`[${requestId}] Processing checkout.completed event`);
      transactionId = object.order.transaction;
      userId = object.customer?.metadata?.internal_customer_id || 
               object.metadata?.internal_customer_id || 
               null;
      productId = object.product?.id || object.order?.product || null;
      
      console.log(`[${requestId}] checkout.completed event details:`, {
        transactionId,
        userId,
        productId,
        orderTransaction: object.order.transaction,
        orderStatus: object.order.status,
        productObject: object.product,
        orderProduct: object.order?.product,
        customerMetadata: object.customer?.metadata,
        metadata: object.metadata,
        fullObject: JSON.stringify(object, null, 2),
      });
      
      credits = productCreditsMap[productId || ''] || 0;
      
      console.log(`[${requestId}] Calculated credits for checkout.completed:`, {
        productId,
        credits,
        matched: productId && productCreditsMap[productId] !== undefined,
        productInMap: productId ? Object.keys(productCreditsMap).includes(productId) : false,
      });
    } else {
      console.log(`[${requestId}] Unhandled event type or missing required fields:`, {
        eventType,
        hasLastTransactionId: !!object?.last_transaction_id,
        hasOrder: !!object?.order,
        orderStatus: object?.order?.status,
        objectKeys: object ? Object.keys(object) : [],
        fullPayload: JSON.stringify(payload, null, 2),
      });
    }

    if (!transactionId || !userId) {
      console.log(`[${requestId}] ERROR: Missing transaction ID or user ID, skipping. Details:`, {
        transactionId,
        userId,
        eventType,
        hasTransactionId: !!transactionId,
        hasUserId: !!userId,
      });
      return NextResponse.json({ received: true, message: 'Missing transaction ID or user ID' });
    }

    console.log(`[${requestId}] Validation passed:`, {
      transactionId,
      userId,
      credits,
      productId,
    });

    if (credits === 0 && productId) {
      console.warn(`[${requestId}] WARNING: Credits is 0 but productId exists. Product may not be configured:`, {
        productId,
        availableProductIds: Object.keys(productCreditsMap),
        eventType,
        productCreditsMap,
      });
      // Still continue processing, but log the issue
    } else if (credits === 0 && !productId) {
      console.warn(`[${requestId}] WARNING: Credits is 0 and productId is null. Cannot determine credits to add:`, {
        eventType,
        objectProduct: object?.product,
        objectOrderProduct: object?.order?.product,
      });
    }

    console.log(`[${requestId}] Creating Supabase client...`);
    const supabase = await createClient();
    console.log(`[${requestId}] Supabase client created successfully`);

    // Check if transaction already exists
    console.log(`[${requestId}] Checking for existing transaction: ${transactionId}`);
    const { data: existingOrder, error: checkError } = await supabase
      .from('subscription_orders')
      .select('id, transaction_id, user_id, created_at')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`[${requestId}] Error checking existing order:`, checkError);
    }

    if (existingOrder) {
      console.log(`[${requestId}] Transaction already processed:`, {
        transactionId,
        existingOrderId: existingOrder.id,
        existingOrderCreatedAt: existingOrder.created_at,
      });
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    console.log(`[${requestId}] No existing transaction found, proceeding with insert`);

    // Insert order record (even if credits is 0, for audit purposes)
    const orderData = {
      transaction_id: transactionId,
      user_id: userId,
      product_id: productId,
      credits: credits,
      event_type: eventType,
      payload: payload,
      created_at: new Date().toISOString(),
    };
    
    console.log(`[${requestId}] Inserting subscription order:`, {
      ...orderData,
      payloadSize: JSON.stringify(payload).length,
    });

    const { data: insertedOrder, error: insertError } = await supabase
      .from('subscription_orders')
      .insert(orderData)
      .select();

    if (insertError) {
      console.error(`[${requestId}] ERROR: Failed to insert order:`, insertError);
      console.error(`[${requestId}] Insert error details:`, JSON.stringify(insertError, null, 2));
      console.error(`[${requestId}] Order data attempted:`, JSON.stringify(orderData, null, 2));
      return NextResponse.json({ 
        error: 'Failed to save order',
        details: insertError.message 
      }, { status: 500 });
    }

    console.log(`[${requestId}] Successfully inserted subscription order:`, {
      insertedOrderId: insertedOrder?.[0]?.id,
      insertedOrder: JSON.stringify(insertedOrder, null, 2),
    });

    // Update user credits
    console.log(`[${requestId}] Fetching current user credits for user: ${userId}`);
    const { data: userData, error: userError } = await supabase
      .from('user_credits')
      .select('credits, has_used_free_trial, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) {
      if (userError.code === 'PGRST116') {
        console.log(`[${requestId}] No existing user credits record found (will create new)`);
      } else {
        console.error(`[${requestId}] ERROR: Failed to fetch user credits:`, userError);
        console.error(`[${requestId}] User error details:`, JSON.stringify(userError, null, 2));
        // Continue anyway, will create new record if needed
      }
    } else {
      console.log(`[${requestId}] Current user credits data:`, {
        credits: userData?.credits,
        hasUsedFreeTrial: userData?.has_used_free_trial,
        createdAt: userData?.created_at,
        updatedAt: userData?.updated_at,
      });
    }

    const currentCredits = userData?.credits || 0;
    const newCredits = currentCredits + credits;
    const hasUsedFreeTrial = userData?.has_used_free_trial || false;

    console.log(`[${requestId}] Credit calculation:`, {
      userId,
      currentCredits,
      creditsToAdd: credits,
      newCredits,
      hasExistingRecord: !!userData,
      willIncrease: credits > 0,
      hasUsedFreeTrial,
    });

    // Always update credits (even if 0, to ensure record exists)
    // This ensures the user_credits record is created/updated for audit purposes
    const creditUpdateData = {
      user_id: userId,
      credits: newCredits,
      has_used_free_trial: hasUsedFreeTrial, // Preserve free trial status
      updated_at: new Date().toISOString(),
    };
    
    console.log(`[${requestId}] Upserting user credits:`, creditUpdateData);
    
    const { data: updatedData, error: updateError } = await supabase
      .from('user_credits')
      .upsert(creditUpdateData, {
        onConflict: 'user_id',
      })
      .select();

    if (updateError) {
      console.error(`[${requestId}] ERROR: Failed to update credits:`, updateError);
      console.error(`[${requestId}] Update error details:`, JSON.stringify(updateError, null, 2));
      console.error(`[${requestId}] Credit update data attempted:`, JSON.stringify(creditUpdateData, null, 2));
      return NextResponse.json({ 
        error: 'Failed to update credits',
        details: updateError.message 
      }, { status: 500 });
    }

    console.log(`[${requestId}] Upsert response:`, {
      updatedDataCount: updatedData?.length || 0,
      updatedData: JSON.stringify(updatedData, null, 2),
    });

    // Verify the update was successful
    if (!updatedData || updatedData.length === 0) {
      console.warn(`[${requestId}] WARNING: Credit update returned no data, verifying...`);
      // Try to fetch again to verify
      const { data: verifyData, error: verifyError } = await supabase
        .from('user_credits')
        .select('credits, has_used_free_trial, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (verifyError) {
        console.error(`[${requestId}] ERROR: Verification fetch failed:`, verifyError);
      } else {
        console.log(`[${requestId}] Verification fetch result:`, verifyData);
      }
      
      if (verifyData && verifyData.credits !== newCredits) {
        console.error(`[${requestId}] ERROR: Credit update verification failed:`, {
          expected: newCredits,
          actual: verifyData.credits,
          difference: verifyData.credits - newCredits,
        });
        return NextResponse.json({ 
          error: 'Credit update verification failed',
          expected: newCredits,
          actual: verifyData.credits,
        }, { status: 500 });
      } else if (verifyData) {
        console.log(`[${requestId}] Verification passed: credits match expected value`);
      }
    } else {
      const updatedRecord = updatedData[0];
      console.log(`[${requestId}] Credit update successful (from upsert response):`, {
        userId: updatedRecord.user_id,
        credits: updatedRecord.credits,
        hasUsedFreeTrial: updatedRecord.has_used_free_trial,
        updatedAt: updatedRecord.updated_at,
      });
    }

    console.log(`[${requestId}] ========================================`);
    console.log(`[${requestId}] Successfully processed transaction:`, {
      transactionId,
      userId,
      creditsAdded: credits,
      previousCredits: currentCredits,
      newCredits,
      eventType,
      productId,
    });
    console.log(`[${requestId}] Transaction ${transactionId} for user ${userId}: added ${credits} credits (${currentCredits} -> ${newCredits})`);
    console.log(`[${requestId}] ========================================`);

    return NextResponse.json({ received: true, success: true });
  } catch (error: any) {
    console.error(`[${requestId}] ========================================`);
    console.error(`[${requestId}] ERROR: Webhook processing failed`);
    console.error(`[${requestId}] Error type: ${error?.constructor?.name || 'Unknown'}`);
    console.error(`[${requestId}] Error message: ${error?.message || 'No message'}`);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    console.error(`[${requestId}] Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error(`[${requestId}] ========================================`);
    
    return NextResponse.json(
      { 
        error: error.message || 'Webhook processing failed',
        requestId,
      },
      { status: 500 }
    );
  }
}

