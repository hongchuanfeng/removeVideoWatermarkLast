import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError);
      return NextResponse.redirect(new URL('/?error=auth_failed', requestUrl.origin));
    }

    // After successful login, create user_credits record if it doesn't exist
    // Get user info after session is established
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting user after login:', userError);
    } else if (user) {
      const userId = user.id;
      console.log(`Processing login for user: ${userId}`);
      
      try {
        // Check if user_credits record exists
        const { data: existingCredits, error: selectError } = await supabase
          .from('user_credits')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        // Only insert if user doesn't exist
        // maybeSingle() returns null if no rows found, instead of throwing error
        if (!existingCredits && (!selectError || selectError.code === 'PGRST116')) {
          console.log(`User ${userId} not found in user_credits, creating record...`);
          
          // Try using the database function first (bypasses RLS)
          const { error: functionError } = await supabase.rpc('ensure_user_credits', {
            p_user_id: userId
          });

          if (functionError) {
            // Fallback to direct insert if function doesn't exist or fails
            console.log('Function call failed, trying direct insert:', functionError);
            
            const { data: insertData, error: insertError } = await supabase
              .from('user_credits')
              .insert({
                user_id: userId,
                credits: 0,
                has_used_free_trial: false,
              })
              .select();

            if (insertError) {
              console.error('Error creating user_credits record:', {
                error: insertError,
                message: insertError.message,
                code: insertError.code,
                details: insertError.details,
                hint: insertError.hint,
                userId: userId
              });
              // Don't fail the login if this fails, just log the error
            } else {
              console.log(`Successfully created user_credits record for user: ${userId}`, insertData);
            }
          } else {
            console.log(`Successfully created user_credits record for user: ${userId} using database function`);
          }
        } else {
          console.log(`User ${userId} already exists in user_credits, skipping creation`);
        }
      } catch (error: any) {
        console.error('Unexpected error while processing user_credits:', {
          error,
          message: error?.message,
          userId: userId
        });
      }
    } else {
      console.warn('No user found after successful code exchange');
    }
  }

  // Get the locale from the URL or default to 'en'
  const pathname = requestUrl.pathname;
  const localeMatch = pathname.match(/^\/(en|zh)/);
  const locale = localeMatch ? localeMatch[1] : 'en';
  
  return NextResponse.redirect(new URL(`/${locale}${next}`, requestUrl.origin));
}

